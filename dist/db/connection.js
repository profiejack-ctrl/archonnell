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

      ALTER TABLE shop.products ADD COLUMN IF NOT EXISTS brand VARCHAR(150);
      ALTER TABLE shop.products ADD COLUMN IF NOT EXISTS unit VARCHAR(20) DEFAULT 'PCS';
      ALTER TABLE shop.products ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'PHP';
      ALTER TABLE shop.products ADD COLUMN IF NOT EXISTS publishable BOOLEAN DEFAULT TRUE;

      ALTER TABLE shop.orders ADD COLUMN IF NOT EXISTS external_order_id VARCHAR(100) UNIQUE;
      ALTER TABLE shop.orders ADD COLUMN IF NOT EXISTS order_date DATE DEFAULT CURRENT_DATE;
      ALTER TABLE shop.orders ADD COLUMN IF NOT EXISTS required_delivery_date DATE;
      ALTER TABLE shop.orders ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'PHP';
      ALTER TABLE shop.orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
      ALTER TABLE shop.orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;

      ALTER TABLE shop.order_items ADD COLUMN IF NOT EXISTS external_line_id VARCHAR(100);

      CREATE TABLE IF NOT EXISTS shop.return_requests (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          return_reference VARCHAR(100) UNIQUE NOT NULL,
          external_request_id VARCHAR(100) UNIQUE NOT NULL,
          order_id UUID REFERENCES shop.orders(id) ON DELETE SET NULL,
          external_order_id VARCHAR(100) NOT NULL,
          external_line_id VARCHAR(100) NOT NULL,
          quantity INT NOT NULL CHECK (quantity > 0),
          reason TEXT NOT NULL,
          status VARCHAR(50) DEFAULT 'REQUESTED',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE SCHEMA IF NOT EXISTS smartchain;

      CREATE TABLE IF NOT EXISTS smartchain.delivery_requests (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          delivery_request_id UUID UNIQUE NOT NULL,
          order_reference VARCHAR(100) NOT NULL,
          shipment_reference VARCHAR(100) NOT NULL,
          partner_code VARCHAR(50) NOT NULL,
          partner_delivery_request_id VARCHAR(100),
          pickup JSONB DEFAULT '{}',
          recipient JSONB DEFAULT '{}',
          required_delivery_at TIMESTAMP WITH TIME ZONE,
          items JSONB DEFAULT '[]',
          callback_url TEXT,
          status VARCHAR(50) DEFAULT 'SCHEDULED',
          idempotency_key VARCHAR(100),
          correlation_id VARCHAR(100),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS smartchain.logistics_status_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          schema_version VARCHAR(20) NOT NULL DEFAULT '1.0',
          event_id VARCHAR(100) NOT NULL,
          partner_code VARCHAR(50) NOT NULL,
          delivery_request_id UUID NOT NULL,
          partner_delivery_request_id VARCHAR(100) NOT NULL,
          status VARCHAR(30) NOT NULL,
          occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
          note TEXT,
          proof_reference VARCHAR(255),
          payload_hash VARCHAR(64) NOT NULL,
          result VARCHAR(30) NOT NULL DEFAULT 'APPLIED',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE (partner_code, event_id)
      );

      CREATE TABLE IF NOT EXISTS smartchain.financial_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          schema_version VARCHAR(20) NOT NULL DEFAULT '1.0',
          event_id VARCHAR(100) UNIQUE NOT NULL,
          event_type VARCHAR(100) NOT NULL,
          occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
          reference VARCHAR(100) NOT NULL,
          status VARCHAR(50) NOT NULL,
          amount NUMERIC(14, 2),
          currency VARCHAR(10) DEFAULT 'PHP',
          outcome VARCHAR(50) DEFAULT 'PENDING_REVIEW',
          payload_hash VARCHAR(64) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS smartchain.purchase_orders (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          message_id UUID UNIQUE NOT NULL,
          external_reference_id VARCHAR(100) UNIQUE NOT NULL,
          source_system VARCHAR(50) DEFAULT 'SMARTCHAIN',
          category_type VARCHAR(100) NOT NULL,
          currency VARCHAR(10) DEFAULT 'PHP',
          total_amount NUMERIC(14, 2) NOT NULL,
          supplier JSONB DEFAULT '{}',
          items JSONB DEFAULT '[]',
          idempotency_key VARCHAR(100),
          correlation_id VARCHAR(100),
          status VARCHAR(50) DEFAULT 'RECEIVED',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS smartchain.disbursement_requests (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          external_module VARCHAR(100) NOT NULL,
          external_reference_id VARCHAR(100) UNIQUE NOT NULL,
          category_type VARCHAR(100) NOT NULL,
          amount NUMERIC(14, 2) NOT NULL,
          payee_info JSONB DEFAULT '{}',
          description TEXT,
          bill_number VARCHAR(100) UNIQUE NOT NULL,
          transaction_code VARCHAR(100) UNIQUE NOT NULL,
          status VARCHAR(50) DEFAULT 'UNPAID',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
        console.log('[DB Schema] Verified/migrated auth_core, shop, and smartchain schemas');
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
