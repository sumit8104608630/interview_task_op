-- Migration: 008_create_payments_and_update_booking_statuses.sql
-- Description: Adds PENDING_PAYMENT, PAYMENT_FAILED, PAYMENT_EXPIRED statuses to bookings, adds expires_at column, and creates payments table.

-- 1. Update Bookings Status Constraint
DO $$
BEGIN
    -- Drop existing check constraints on status if present
    ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
    ALTER TABLE bookings DROP CONSTRAINT IF EXISTS chk_bookings_status;
    
    -- Add updated check constraint supporting the full payment lifecycle
    ALTER TABLE bookings ADD CONSTRAINT chk_bookings_status 
        CHECK (status IN ('PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'PAYMENT_FAILED', 'PAYMENT_EXPIRED'));
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- 2. Add expires_at column to bookings for pending reservation TTL
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Index for pending bookings expiry worker
CREATE INDEX IF NOT EXISTS idx_bookings_pending_expiry 
ON bookings (status, expires_at) 
WHERE status = 'PENDING_PAYMENT';

-- 3. Create Payments Table for Razorpay Transaction Ledger
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
    razorpay_order_id VARCHAR(100) NOT NULL UNIQUE,
    razorpay_payment_id VARCHAR(100) UNIQUE,
    razorpay_signature VARCHAR(255),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    status VARCHAR(30) NOT NULL DEFAULT 'CREATED' 
        CHECK (status IN ('CREATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED')),
    payment_method VARCHAR(50),
    error_code VARCHAR(100),
    error_description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    captured_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ
);

-- Performance and lookup indexes
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments (booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order_id ON payments (razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_payment_id ON payments (razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments (status);
