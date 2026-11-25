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

function isConnectionError(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || '').toLowerCase();
  return (
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'EHOSTUNREACH' ||
    code === 'ENOTFOUND' ||
    code.startsWith('08') || // Class 08 - Connection Exception
    code.startsWith('57P') || // Class 57 - Operator Intervention
    msg.includes('connection terminated') ||
    msg.includes('connection timeout') ||
    msg.includes('client has encountered a connection error') ||
    msg.includes('timeout exceeded')
  );
}

let schemaMigrationAttempted = false;
export async function ensureSchema() {
  if (schemaMigrationAttempted) return;
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

      CREATE SCHEMA IF NOT EXISTS pdms;

      CREATE TABLE IF NOT EXISTS pdms.workforce_records (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          employee_id UUID REFERENCES hrms.employees(id) ON DELETE SET NULL,
          employee_code VARCHAR(50) NOT NULL,
          period_start DATE NOT NULL,
          period_end DATE NOT NULL,
          scheduled_days INT NOT NULL DEFAULT 0,
          days_present INT NOT NULL DEFAULT 0,
          days_absent INT NOT NULL DEFAULT 0,
          late_count INT NOT NULL DEFAULT 0,
          total_late_minutes INT NOT NULL DEFAULT 0,
          overtime_hours NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
          leave_days INT NOT NULL DEFAULT 0,
          unexcused_absences INT NOT NULL DEFAULT 0,
          disciplinary_actions INT NOT NULL DEFAULT 0,
          attendance_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
          external_ref VARCHAR(255),
          source VARCHAR(50) NOT NULL DEFAULT 'hr2_api',
          raw JSONB DEFAULT '{}',
          received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE (employee_code, period_start, period_end, source)
      );

      CREATE TABLE IF NOT EXISTS pdms.competencies (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          code VARCHAR(50) UNIQUE,
          name VARCHAR(255) NOT NULL,
          category VARCHAR(150),
          description TEXT,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS pdms.goals (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          employee_id UUID REFERENCES hrms.employees(id) ON DELETE SET NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          progress NUMERIC(5, 2) DEFAULT 0.00,
          weight INT DEFAULT 50,
          status VARCHAR(50) DEFAULT 'In Progress',
          due_date DATE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS pdms.kpis (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          source VARCHAR(100) DEFAULT 'manual',
          unit VARCHAR(30) DEFAULT '%',
          target_value NUMERIC(10, 2) NOT NULL DEFAULT 100.00,
          direction VARCHAR(20) DEFAULT 'higher',
          frequency VARCHAR(30) DEFAULT 'monthly',
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS pdms.performance_reviews (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          employee_id UUID REFERENCES hrms.employees(id) ON DELETE SET NULL,
          cycle_name VARCHAR(150) NOT NULL,
          score NUMERIC(5, 2) DEFAULT 0.00,
          status VARCHAR(50) DEFAULT 'Pending',
          comments TEXT,
          reviewed_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS pdms.courses (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title VARCHAR(255) NOT NULL,
          category VARCHAR(150),
          duration_minutes INT DEFAULT 60,
          is_published BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS pdms.trainings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title VARCHAR(255) NOT NULL,
          trainer_name VARCHAR(255),
          start_date DATE,
          end_date DATE,
          status VARCHAR(50) DEFAULT 'Scheduled',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS pdms.succession_positions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          position_id UUID REFERENCES hrms.positions(id) ON DELETE SET NULL,
          title VARCHAR(255) NOT NULL,
          urgency VARCHAR(50) DEFAULT 'Medium',
          readiness_target VARCHAR(50) DEFAULT 'Ready Now',
          vacant_since DATE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS pdms.recognitions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          recipient_employee_id UUID REFERENCES hrms.employees(id) ON DELETE SET NULL,
          sender_employee_id UUID REFERENCES hrms.employees(id) ON DELETE SET NULL,
          category VARCHAR(100) DEFAULT 'Excellence',
          message TEXT NOT NULL,
          status VARCHAR(50) DEFAULT 'Approved',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('[DB Schema] Verified/migrated auth_core, shop, smartchain, and pdms schemas');
  } catch (err: any) {
    console.warn('[DB Schema] Auto-migration notice:', err.message);
  }
}

/**
 * Execute a query with automatic failover to the secondary pool if primary fails.
 */
export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  if (!schemaMigrationAttempted) {
    ensureSchema().catch(() => {});
  }

  try {
    return await primaryPool.query<T>(text, params);
  } catch (primaryError: any) {
    if (env.DB_FAILOVER_ENABLED && backupPool && isConnectionError(primaryError)) {
      console.warn('[DB Failover] Primary connection failed. Routing to backup database:', primaryError.message);
      try {
        return await backupPool.query<T>(text, params);
      } catch (backupError: any) {
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
  } catch (err: any) {
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
    primary: { status: 'down', latencyMs: 0, error: null as string | null },
    backup: { status: 'disabled', latencyMs: 0, error: null as string | null },
    activeSource: 'primary'
  };

  // Test Primary
  const startPrimary = Date.now();
  try {
    await primaryPool.query('SELECT 1 AS health');
    result.primary.status = 'healthy';
    result.primary.latencyMs = Date.now() - startPrimary;
  } catch (err: any) {
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
    } catch (err: any) {
      result.backup.status = 'down';
      result.backup.error = err.message;
    }
  }

  return result;
}
