import pg from 'pg';
import { env } from '../config/env.js';
const { Pool } = pg;
const isLocalhost = env.DATABASE_URL.includes('localhost') || env.DATABASE_URL.includes('127.0.0.1');
const primarySslConfig = isLocalhost ? undefined : { rejectUnauthorized: false };
export const primaryPool = new Pool({
    connectionString: env.DATABASE_URL,
    max: process.env.VERCEL ? 3 : 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
    ssl: primarySslConfig
});
export const backupPool = env.DATABASE_BACKUP_URL
    ? new Pool({
        connectionString: env.DATABASE_BACKUP_URL,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        ssl: { rejectUnauthorized: false }
    })
    : null;
primaryPool.on('error', (err) => {
    console.error('[DB Primary] Unexpected pool error on idle client:', err.message);
});
if (backupPool) {
    backupPool.on('error', (err) => {
        console.error('[DB Backup] Unexpected pool error on idle client:', err.message);
    });
}
function isConnectionError(err) {
    if (!err)
        return false;
    const code = String(err.code || '');
    const msg = String(err.message || '').toLowerCase();
    return (code === 'ECONNREFUSED' ||
        code === 'ECONNRESET' ||
        code === 'ETIMEDOUT' ||
        code === 'EHOSTUNREACH' ||
        code === 'ENOTFOUND' ||
        code.startsWith('08') || // Class 08 - Connection Exception
        code.startsWith('57P') || // Class 57 - Operator Intervention
        msg.includes('connection terminated') ||
        msg.includes('connection timeout') ||
        msg.includes('client has encountered a connection error') ||
        msg.includes('timeout exceeded'));
}
let schemaMigrationAttempted = false;
export async function ensureSchema() {
    if (schemaMigrationAttempted)
        return;
    schemaMigrationAttempted = true;
    try {
        await primaryPool.query(`
      ALTER TABLE auth_core.users ADD COLUMN IF NOT EXISTS username VARCHAR(100);
      UPDATE auth_core.users SET username = LOWER(email) WHERE username IS NULL;
    `);
        console.log('[DB Schema] Verified/migrated username column on auth_core.users');
    }
    catch (err) {
        console.warn('[DB Schema] Auto-migration notice:', err.message);
    }
}
/**
 * Execute a query with automatic failover to the secondary pool if primary fails.
 */
export async function query(text, params) {
    if (!schemaMigrationAttempted) {
        ensureSchema().catch(() => { });
    }
    try {
        return await primaryPool.query(text, params);
    }
    catch (primaryError) {
        if (env.DB_FAILOVER_ENABLED && backupPool && isConnectionError(primaryError)) {
            console.warn('[DB Failover] Primary connection failed. Routing to backup database:', primaryError.message);
            try {
                return await backupPool.query(text, params);
            }
            catch (backupError) {
                console.error('[DB Failover] Backup query failed as well:', backupError.message);
                throw primaryError;
            }
        }
        throw primaryError;
    }
}
/**
 * Get a client from the pool (prefers primary pool).
 */
export async function getClient() {
    try {
        return await primaryPool.connect();
    }
    catch (err) {
        if (env.DB_FAILOVER_ENABLED && backupPool) {
            console.warn('[DB Failover] Primary connect failed. Returning client from backup pool.');
            return await backupPool.connect();
        }
        throw err;
    }
}
/**
 * Health check utility returning status of primary and secondary databases.
 */
export async function checkDatabaseHealth() {
    const result = {
        primary: { status: 'down', latencyMs: 0, error: null },
        backup: { status: 'disabled', latencyMs: 0, error: null },
        activeSource: 'primary'
    };
    // Test Primary
    const startPrimary = Date.now();
    try {
        await primaryPool.query('SELECT 1 AS health');
        result.primary.status = 'healthy';
        result.primary.latencyMs = Date.now() - startPrimary;
    }
    catch (err) {
        result.primary.status = 'down';
        result.primary.error = err.message;
        result.activeSource = 'backup';
        console.error('[DB Primary Error]:', err.message);
    }
    // Test Backup if configured
    if (backupPool) {
        const startBackup = Date.now();
        try {
            await backupPool.query('SELECT 1 AS health');
            result.backup.status = 'healthy';
            result.backup.latencyMs = Date.now() - startBackup;
        }
        catch (err) {
            result.backup.status = 'down';
            result.backup.error = err.message;
        }
    }
    return result;
}
