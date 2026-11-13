-- Migration: 007_update_notification_outbox_table.sql
-- Description: Enhances notification_outbox table with idempotency_key, next_attempt_at, and indexes for reliable worker processing.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS notification_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    idempotency_key VARCHAR(128),
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMPTZ
);

-- Idempotent column additions for existing tables
ALTER TABLE notification_outbox ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128);
ALTER TABLE notification_outbox ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Unique constraint / index for idempotency keys (ignoring nulls)
CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_outbox_idempotency_key 
ON notification_outbox (idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- Index for worker row-locking queries: due pending notifications
CREATE INDEX IF NOT EXISTS idx_notification_outbox_worker_due 
ON notification_outbox (status, next_attempt_at ASC) 
WHERE status = 'PENDING';

-- Index for booking_id lookups
CREATE INDEX IF NOT EXISTS idx_notification_outbox_booking_id 
ON notification_outbox (booking_id);
