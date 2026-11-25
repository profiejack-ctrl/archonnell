-- ==============================================================================
-- ARCHON NELL - SUPABASE INCREMENTAL MIGRATION
-- Adds:
--   1. auth_core.users.username
--   2. SmartChain extensions on shop.* + smartchain.* schema & tables
--   3. PDMS schema & tables (pdms.*)
-- Safe to run multiple times (idempotent).
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. AUTH_CORE: username column
-- ------------------------------------------------------------------------------
ALTER TABLE auth_core.users ADD COLUMN IF NOT EXISTS username VARCHAR(100);
UPDATE auth_core.users SET username = LOWER(email) WHERE username IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_users_username ON auth_core.users(LOWER(username));

-- ------------------------------------------------------------------------------
-- 2. SHOP EXTENSIONS (SmartChain E-Commerce compatibility)
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 3. SMARTCHAIN SCHEMA & TABLES
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 4. PDMS SCHEMA & TABLES
-- ------------------------------------------------------------------------------
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
