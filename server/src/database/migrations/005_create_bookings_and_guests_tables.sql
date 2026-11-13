-- Migration: 005_create_bookings_and_guests_tables.sql
-- Description: Creates bookings, booking_guests, and notification_outbox tables with multi-room support (rooms_count), customer_id, and idempotency key.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Bookings Table
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_reference VARCHAR(50) NOT NULL UNIQUE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    room_type_id UUID NOT NULL REFERENCES room_types(id) ON DELETE RESTRICT,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    nights INTEGER NOT NULL CHECK (nights > 0),
    rooms_count INTEGER NOT NULL DEFAULT 1 CHECK (rooms_count > 0),
    nightly_price_snapshot NUMERIC(12, 2) NOT NULL CHECK (nightly_price_snapshot >= 0),
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'CANCELLED')),
    idempotency_key VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cancelled_at TIMESTAMPTZ,
    CONSTRAINT chk_bookings_checkout_after_checkin CHECK (check_out > check_in)
);

-- Idempotent column additions for existing schemas
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rooms_count INTEGER NOT NULL DEFAULT 1 CHECK (rooms_count > 0);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100);

-- Unique index for idempotency keys (ignoring nulls)
CREATE UNIQUE INDEX IF NOT EXISTS uq_bookings_idempotency_key 
ON bookings (idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- Index for customer bookings lookup and date queries
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON bookings (customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_reference ON bookings (booking_reference);
CREATE INDEX IF NOT EXISTS idx_bookings_room_dates ON bookings (room_type_id, check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status);

-- 2. Booking Guests Table
CREATE TABLE IF NOT EXISTS booking_guests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    guest_name VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Idempotent column additions
ALTER TABLE booking_guests ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
ALTER TABLE booking_guests ADD COLUMN IF NOT EXISTS guest_name VARCHAR(255);
ALTER TABLE booking_guests ADD COLUMN IF NOT EXISTS phone VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_booking_guests_booking_id ON booking_guests (booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_guests_email ON booking_guests (LOWER(email));

-- 3. Notification Outbox Table
CREATE TABLE IF NOT EXISTS notification_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_pending 
ON notification_outbox (status, created_at) 
WHERE status = 'PENDING';
