-- Migration: 001_create_customers_and_auth_sessions.sql
-- Description: Creates customers table and auth_sessions table for passwordless email OTP authentication.

-- Enable pgcrypto / uuid extension if not present
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    password_hash TEXT,
    phone TEXT,
    email_verified_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Case-insensitive unique index on customer email
CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_email_lower
ON customers (LOWER(email));

-- Status index for active customer queries
CREATE INDEX IF NOT EXISTS idx_customers_status
ON customers (status);

-- Auth Sessions Table (auth_sessions.id corresponds to JWT jti)
CREATE TABLE IF NOT EXISTS auth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index on session customer lookup
CREATE INDEX IF NOT EXISTS idx_auth_sessions_customer_id
ON auth_sessions (customer_id);

-- Index on active session lookup
CREATE INDEX IF NOT EXISTS idx_auth_sessions_active
ON auth_sessions (id, revoked_at, expires_at);
