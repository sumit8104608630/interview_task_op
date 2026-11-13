-- Migration: 006_create_guest_sessions_table.sql
-- Description: Creates guest_sessions table for short-lived, single-use, booking-scoped authorization proofs (e.g. CANCELLATION).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS guest_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    purpose VARCHAR(50) NOT NULL, -- e.g. 'CANCELLATION', 'BOOKING'
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_guest_sessions_purpose CHECK (purpose IN ('CANCELLATION', 'BOOKING'))
);

-- Indexes for rapid token lookup, booking binding, and expiration checks
CREATE INDEX IF NOT EXISTS idx_guest_sessions_token_hash 
ON guest_sessions (token_hash);

CREATE INDEX IF NOT EXISTS idx_guest_sessions_booking_purpose 
ON guest_sessions (booking_id, purpose);

CREATE INDEX IF NOT EXISTS idx_guest_sessions_active 
ON guest_sessions (id, booking_id, purpose, consumed_at, expires_at);
