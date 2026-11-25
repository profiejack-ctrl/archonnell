-- ==============================================================================
-- ARCHON NELL - SUPABASE MIGRATION FOR ESFA (Support, Finance & Administration)
-- Safe to run multiple times (idempotent).
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE SCHEMA IF NOT EXISTS esfa;

CREATE TABLE IF NOT EXISTS esfa.tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference VARCHAR(50) UNIQUE NOT NULL,
    idempotency_key VARCHAR(255) UNIQUE,
    requester_type VARCHAR(50) DEFAULT 'customer',
    requester_external_id VARCHAR(100) NOT NULL,
    order_external_id VARCHAR(100),
    payment_reference VARCHAR(100),
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    channel VARCHAR(50) DEFAULT 'marketplace_app',
    category VARCHAR(50) DEFAULT 'general',
    priority VARCHAR(30) DEFAULT 'medium',
    status VARCHAR(50) DEFAULT 'open',
    csat_score INT,
    csat_comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS esfa.ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES esfa.tickets(id) ON DELETE CASCADE,
    author_type VARCHAR(30) DEFAULT 'customer',
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS esfa.kb_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(150) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'General',
    body TEXT NOT NULL,
    is_published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS esfa.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference VARCHAR(50) UNIQUE NOT NULL,
    idempotency_key VARCHAR(255) UNIQUE,
    order_external_id VARCHAR(100) NOT NULL,
    method VARCHAR(50) NOT NULL,
    amount BIGINT NOT NULL,
    currency VARCHAR(10) DEFAULT 'PHP',
    status VARCHAR(50) DEFAULT 'captured',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS esfa.refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference VARCHAR(50) UNIQUE NOT NULL,
    idempotency_key VARCHAR(255) UNIQUE,
    payment_reference VARCHAR(50) NOT NULL,
    amount BIGINT NOT NULL,
    reason VARCHAR(100) NOT NULL,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'pending_review',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS esfa.shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference VARCHAR(50) UNIQUE NOT NULL,
    idempotency_key VARCHAR(255) UNIQUE,
    order_external_id VARCHAR(100) NOT NULL,
    seller_external_id VARCHAR(100),
    courier_id INT DEFAULT 1,
    service_type VARCHAR(50) DEFAULT 'standard',
    tracking_number VARCHAR(100),
    shipping_fee_amount BIGINT DEFAULT 8000,
    destination JSONB DEFAULT '{}',
    weight_grams INT DEFAULT 1000,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS esfa.webhook_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL,
    events JSONB DEFAULT '["*"]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
