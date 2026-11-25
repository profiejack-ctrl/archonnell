-- ==============================================================================
-- ARCHON NELL INCORPORATED - CENTRALIZED DATABASE SCHEMA (PostgreSQL)
-- Six Unified Schemas: auth_core, hrms, wfm, payroll, fleet, shop
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. SCHEMAS
-- ------------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS auth_core;
CREATE SCHEMA IF NOT EXISTS hrms;
CREATE SCHEMA IF NOT EXISTS wfm;
CREATE SCHEMA IF NOT EXISTS payroll;
CREATE SCHEMA IF NOT EXISTS fleet;
CREATE SCHEMA IF NOT EXISTS shop;

-- ------------------------------------------------------------------------------
-- 2. AUTH_CORE SCHEMA (Centralized SSO & User Identity)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_core.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    global_role VARCHAR(50) NOT NULL DEFAULT 'customer', -- 'superadmin', 'hr_admin', 'payroll_officer', 'fleet_manager', 'driver', 'employee', 'customer'
    avatar_url TEXT,
    phone_number VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE auth_core.users ADD COLUMN IF NOT EXISTS username VARCHAR(100);
UPDATE auth_core.users SET username = LOWER(email) WHERE username IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_users_username ON auth_core.users(LOWER(username));

CREATE TABLE IF NOT EXISTS auth_core.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth_core.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    ip_address VARCHAR(50),
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_core.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth_core.users(id) ON DELETE SET NULL,
    module VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource_id VARCHAR(100),
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_core.otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL,
    purpose VARCHAR(50) NOT NULL, -- 'LOGIN', 'CHECKOUT', 'PASSWORD_RESET', 'APPLICANT', 'DRIVER'
    module VARCHAR(50) NOT NULL,  -- 'auth', 'shop', 'hrms', 'wfm', 'payroll', 'fleet'
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_otps_lookup ON auth_core.otps(email, purpose, is_used);

-- ------------------------------------------------------------------------------
-- 3. HRMS SCHEMA (Core Human Capital & Recruitment)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hrms.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hrms.positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID REFERENCES hrms.departments(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    salary_grade VARCHAR(50),
    base_salary NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hrms.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES auth_core.users(id) ON DELETE SET NULL,
    employee_no VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    department_id UUID REFERENCES hrms.departments(id) ON DELETE SET NULL,
    position_id UUID REFERENCES hrms.positions(id) ON DELETE SET NULL,
    employment_status VARCHAR(50) DEFAULT 'Regular', -- 'Probationary', 'Regular', 'Contractual', 'Resigned'
    hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
    birth_date DATE,
    address TEXT,
    emergency_contact JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE hrms.employees ADD COLUMN IF NOT EXISTS gender VARCHAR(50);
ALTER TABLE hrms.employees ADD COLUMN IF NOT EXISTS contract_type VARCHAR(100) DEFAULT 'Full-Time';

CREATE TABLE IF NOT EXISTS hrms.job_postings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID REFERENCES hrms.departments(id) ON DELETE SET NULL,
    position_id UUID REFERENCES hrms.positions(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    job_type VARCHAR(50) DEFAULT 'Full-Time',
    location VARCHAR(100) DEFAULT 'Main Warehouse / Plant',
    description TEXT NOT NULL,
    requirements TEXT,
    salary_min NUMERIC(12, 2),
    salary_max NUMERIC(12, 2),
    status VARCHAR(50) DEFAULT 'Open', -- 'Open', 'Closed', 'Draft'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE hrms.job_postings
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS hrms.vacancy_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_no VARCHAR(50) UNIQUE NOT NULL,
    department_id UUID NOT NULL REFERENCES hrms.departments(id),
    position_id UUID NOT NULL REFERENCES hrms.positions(id),
    vacancies INT NOT NULL CHECK (vacancies > 0),
    employment_type VARCHAR(100) NOT NULL,
    justification TEXT NOT NULL,
    required_skills TEXT NOT NULL DEFAULT '',
    qualifications TEXT NOT NULL DEFAULT '',
    requested_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT NOT NULL DEFAULT '',
    status VARCHAR(50) NOT NULL DEFAULT 'Pending',
    requested_by UUID REFERENCES auth_core.users(id) ON DELETE SET NULL,
    reviewed_by UUID REFERENCES auth_core.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hrms.announcements (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    summary TEXT,
    body TEXT NOT NULL,
    cover_image TEXT,
    published_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    end_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(30) NOT NULL DEFAULT 'Draft',
    show_on_dashboard BOOLEAN NOT NULL DEFAULT TRUE,
    scope_all BOOLEAN NOT NULL DEFAULT TRUE,
    scope_departments TEXT[] NOT NULL DEFAULT '{}',
    withdrawn_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES auth_core.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth_core.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hrms_announcements_status_date
    ON hrms.announcements(status, published_at DESC);

CREATE TABLE IF NOT EXISTS hrms.applicants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_posting_id UUID REFERENCES hrms.job_postings(id) ON DELETE SET NULL,
    application_id VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    birth_date DATE,
    resume_url TEXT,
    ai_match_score NUMERIC(5, 2),
    ai_summary TEXT,
    status VARCHAR(50) DEFAULT 'Applied', -- 'Applied', 'Screening', 'Pre-Interview', 'Final Interview', 'Hired', 'Rejected'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hrms.applicant_rejections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    applicant_id UUID NOT NULL REFERENCES hrms.applicants(id) ON DELETE CASCADE,
    stage VARCHAR(50) NOT NULL,
    category VARCHAR(255),
    reason TEXT NOT NULL,
    rejected_by VARCHAR(255),
    future_invited BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hrms_applicant_rejections_latest
    ON hrms.applicant_rejections(applicant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS hrms.applicant_interviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    applicant_id UUID NOT NULL REFERENCES hrms.applicants(id) ON DELETE CASCADE,
    round VARCHAR(50) NOT NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    interview_type VARCHAR(100),
    location TEXT,
    interviewer_name VARCHAR(255),
    interviewer_id VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'Scheduled',
    confirmation_deadline TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hrms_applicant_interviews_latest
    ON hrms.applicant_interviews(applicant_id, round, created_at DESC);

CREATE TABLE IF NOT EXISTS hrms.applicant_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    applicant_id UUID NOT NULL REFERENCES hrms.applicants(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    username VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hrms.onboarding_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES hrms.employees(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hrms.onboarding_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL UNIQUE REFERENCES hrms.employees(id) ON DELETE CASCADE,
    contract_type VARCHAR(100) NOT NULL DEFAULT 'Probationary',
    status VARCHAR(100) NOT NULL DEFAULT 'In Progress',
    progress NUMERIC(5, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. WFM SCHEMA (Workforce Management: Time, Shifts & Leaves)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wfm.shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_minutes INT DEFAULT 60,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wfm.schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES hrms.employees(id) ON DELETE CASCADE,
    shift_id UUID REFERENCES wfm.shifts(id) ON DELETE SET NULL,
    schedule_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'Scheduled',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(employee_id, schedule_date)
);

CREATE TABLE IF NOT EXISTS wfm.attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES hrms.employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    time_in TIME,
    time_out TIME,
    worked_hours NUMERIC(5, 2) DEFAULT 0.00,
    late_minutes INT DEFAULT 0,
    undertime_minutes INT DEFAULT 0,
    ot_minutes INT DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'Present', -- 'Present', 'Absent', 'On Leave', 'Day Off'
    ot_status VARCHAR(50) DEFAULT 'Pending', -- 'Approved', 'Pending', 'Rejected'
    verification_method VARCHAR(50) DEFAULT 'kiosk', -- 'kiosk', 'rfid', 'web', 'manual'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(employee_id, date)
);

CREATE TABLE IF NOT EXISTS wfm.timesheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES hrms.employees(id) ON DELETE CASCADE,
    period_from DATE NOT NULL,
    period_to DATE NOT NULL,
    total_regular_hours NUMERIC(6, 2) DEFAULT 0.00,
    total_ot_hours NUMERIC(6, 2) DEFAULT 0.00,
    total_late_minutes INT DEFAULT 0,
    total_undertime_minutes INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Draft', -- 'Draft', 'Submitted', 'Approved', 'Locked'
    approved_by UUID REFERENCES auth_core.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(employee_id, period_from, period_to)
);

CREATE TABLE IF NOT EXISTS wfm.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES hrms.employees(id) ON DELETE CASCADE,
    leave_type VARCHAR(100) NOT NULL, -- 'Vacation', 'Sick', 'Emergency', 'Maternity', 'Paternity'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_count NUMERIC(4, 1) NOT NULL,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'Pending', -- 'Pending', 'Approved', 'Rejected'
    approved_by UUID REFERENCES auth_core.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. PAYROLL SCHEMA (Payroll & Benefits Management)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll.payroll_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_type VARCHAR(50) NOT NULL DEFAULT 'regular', -- 'regular', 'thirteenth-month'
    period_from DATE NOT NULL,
    period_to DATE NOT NULL,
    pay_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'pending', 'approved', 'funded', 'paid', 'closed'
    total_gross NUMERIC(14, 2) DEFAULT 0.00,
    total_deductions NUMERIC(14, 2) DEFAULT 0.00,
    total_net NUMERIC(14, 2) DEFAULT 0.00,
    prepared_by VARCHAR(255),
    submitted_at TIMESTAMP WITH TIME ZONE,
    decided_by VARCHAR(255),
    decided_at TIMESTAMP WITH TIME ZONE,
    decision_comment TEXT,
    funded_at TIMESTAMP WITH TIME ZONE,
    funding_receipt_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll.payslips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_run_id UUID NOT NULL REFERENCES payroll.payroll_runs(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES hrms.employees(id) ON DELETE CASCADE,
    employee_no VARCHAR(50) NOT NULL,
    basic_salary NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    gross_pay NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    net_pay NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(50) DEFAULT 'Pending', -- 'Pending', 'Exported', 'Paid', 'Failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll.payslip_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payslip_id UUID NOT NULL REFERENCES payroll.payslips(id) ON DELETE CASCADE,
    line_type VARCHAR(50) NOT NULL, -- 'earning', 'deduction', 'tax'
    line_name VARCHAR(150) NOT NULL, -- 'Basic Pay', 'Overtime', 'SSS', 'PhilHealth', 'Pag-IBIG', 'Withholding Tax'
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll.claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES hrms.employees(id) ON DELETE CASCADE,
    claim_type VARCHAR(100) NOT NULL, -- 'Travel', 'Medical', 'Equipment', 'Meal'
    amount NUMERIC(12, 2) NOT NULL,
    description TEXT,
    receipt_url TEXT,
    status VARCHAR(50) DEFAULT 'Pending', -- 'Pending', 'Approved', 'Rejected', 'Reimbursed'
    decided_by UUID REFERENCES auth_core.users(id) ON DELETE SET NULL,
    decided_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll.benefits_hmo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES hrms.employees(id) ON DELETE CASCADE,
    provider_name VARCHAR(150) NOT NULL,
    policy_number VARCHAR(100),
    coverage_amount NUMERIC(12, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. FLEET SCHEMA (Fleet & Logistics Management)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fleet.vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plate_number VARCHAR(50) UNIQUE NOT NULL,
    model VARCHAR(150) NOT NULL,
    vehicle_type VARCHAR(100) NOT NULL DEFAULT 'Truck', -- 'Van', 'Truck', 'Motorcycle'
    capacity_kg NUMERIC(10, 2) DEFAULT 1000.00,
    fuel_capacity_liters NUMERIC(8, 2) DEFAULT 80.00,
    current_odometer NUMERIC(10, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Available', -- 'Available', 'On Trip', 'Maintenance'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet.drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES hrms.employees(id) ON DELETE CASCADE,
    license_number VARCHAR(100) NOT NULL,
    license_expiry DATE,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet.dispatches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_number VARCHAR(50) UNIQUE NOT NULL,
    order_id UUID, -- References shop.orders(id)
    driver_id UUID REFERENCES fleet.drivers(id) ON DELETE SET NULL,
    vehicle_id UUID REFERENCES fleet.vehicles(id) ON DELETE SET NULL,
    pickup_address TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'Scheduled', -- 'Scheduled', 'Assigned', 'In Transit', 'Completed', 'Cancelled'
    scheduled_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    proof_of_delivery_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet.trip_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_id UUID REFERENCES fleet.dispatches(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES fleet.vehicles(id) ON DELETE SET NULL,
    driver_id UUID REFERENCES fleet.drivers(id) ON DELETE SET NULL,
    start_odometer NUMERIC(10, 2),
    end_odometer NUMERIC(10, 2),
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet.fuel_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID REFERENCES fleet.vehicles(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES fleet.drivers(id) ON DELETE SET NULL,
    liters NUMERIC(8, 2) NOT NULL,
    cost NUMERIC(10, 2) NOT NULL,
    odometer NUMERIC(10, 2),
    receipt_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet.location_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID REFERENCES fleet.vehicles(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES fleet.drivers(id) ON DELETE SET NULL,
    dispatch_id UUID REFERENCES fleet.dispatches(id) ON DELETE SET NULL,
    latitude NUMERIC(10, 6) NOT NULL,
    longitude NUMERIC(10, 6) NOT NULL,
    speed NUMERIC(5, 2) DEFAULT 0.00,
    heading NUMERIC(5, 2) DEFAULT 0.00,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 7. SHOP SCHEMA (E-Commerce Store & Core Operations)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shop.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(150) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shop.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES shop.categories(id) ON DELETE SET NULL,
    custom_id VARCHAR(50) UNIQUE, -- e.g. 'prod-1'
    title VARCHAR(255) NOT NULL,
    description TEXT,
    brand VARCHAR(150),
    unit VARCHAR(20) DEFAULT 'PCS', -- 'PCS', 'SACK', 'DRUM'
    currency VARCHAR(10) DEFAULT 'PHP',
    price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    stock INT NOT NULL DEFAULT 0,
    sku VARCHAR(100),
    images JSONB DEFAULT '[]',
    specs JSONB DEFAULT '{}',
    publishable BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE shop.products ADD COLUMN IF NOT EXISTS brand VARCHAR(150);
ALTER TABLE shop.products ADD COLUMN IF NOT EXISTS unit VARCHAR(20) DEFAULT 'PCS';
ALTER TABLE shop.products ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'PHP';
ALTER TABLE shop.products ADD COLUMN IF NOT EXISTS publishable BOOLEAN DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS shop.vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    discount_type VARCHAR(20) DEFAULT 'PERCENTAGE', -- 'PERCENTAGE', 'FIXED'
    discount_value NUMERIC(10, 2) NOT NULL,
    min_spend NUMERIC(10, 2) DEFAULT 0.00,
    max_discount NUMERIC(10, 2),
    usage_limit INT DEFAULT 100,
    used_count INT DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shop.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(100) UNIQUE NOT NULL,
    external_order_id VARCHAR(100) UNIQUE,
    user_id UUID REFERENCES auth_core.users(id) ON DELETE SET NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    delivery_address TEXT NOT NULL,
    delivery_notes TEXT,
    order_date DATE DEFAULT CURRENT_DATE,
    required_delivery_date DATE,
    currency VARCHAR(10) DEFAULT 'PHP',
    payment_method VARCHAR(50) NOT NULL, -- 'GCash', 'Maya', 'Bank', 'COD'
    payment_status VARCHAR(50) DEFAULT 'Pending', -- 'Pending', 'Paid', 'Failed', 'Refunded'
    gcash_ref_number VARCHAR(100),
    proof_image TEXT,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    delivery_status VARCHAR(50) DEFAULT 'Pending', -- 'Pending', 'Processing', 'Dispatched', 'Delivered', 'Cancelled'
    current_tracking_step VARCHAR(100) DEFAULT 'Order Placed',
    tracking_steps JSONB DEFAULT '[]',
    cancellation_reason TEXT,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE shop.orders ADD COLUMN IF NOT EXISTS external_order_id VARCHAR(100) UNIQUE;
ALTER TABLE shop.orders ADD COLUMN IF NOT EXISTS order_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE shop.orders ADD COLUMN IF NOT EXISTS required_delivery_date DATE;
ALTER TABLE shop.orders ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'PHP';
ALTER TABLE shop.orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE shop.orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;

CREATE TABLE IF NOT EXISTS shop.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES shop.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES shop.products(id) ON DELETE SET NULL,
    external_line_id VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    price NUMERIC(12, 2) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    total NUMERIC(12, 2) NOT NULL
);

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
-- 7B. SMARTCHAIN INTEGRATION SCHEMA (Logistics Callbacks, POs, Finance Events)
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
    status VARCHAR(50) DEFAULT 'SCHEDULED', -- 'SCHEDULED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'
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
    status VARCHAR(30) NOT NULL, -- 'IN_TRANSIT', 'DELIVERED'
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
    note TEXT,
    proof_reference VARCHAR(255),
    payload_hash VARCHAR(64) NOT NULL,
    result VARCHAR(30) NOT NULL DEFAULT 'APPLIED', -- 'APPLIED', 'DUPLICATE', 'IGNORED_OUT_OF_ORDER'
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

CREATE TABLE IF NOT EXISTS shop.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES shop.products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth_core.users(id) ON DELETE SET NULL,
    customer_name VARCHAR(255) NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    ai_sentiment VARCHAR(50),
    is_verified_purchase BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 8. INDEXES FOR PERFORMANCE
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_core.users(email);
CREATE INDEX IF NOT EXISTS idx_auth_users_role ON auth_core.users(global_role);
CREATE INDEX IF NOT EXISTS idx_hrms_employees_no ON hrms.employees(employee_no);
CREATE INDEX IF NOT EXISTS idx_wfm_attendance_emp_date ON wfm.attendance_logs(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_payroll_payslips_run ON payroll.payslips(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_fleet_dispatches_order ON fleet.dispatches(order_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_num ON shop.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_shop_orders_user ON shop.orders(user_id);
