-- Migration: 004_create_room_inventory_table.sql
-- Description: Creates room_inventory table with date-level availability and indexes.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS room_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_type_id UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
    inventory_date DATE NOT NULL,
    available_rooms INTEGER NOT NULL CHECK (available_rooms >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_room_inventory_type_date UNIQUE (room_type_id, inventory_date)
);

-- Performance Indexes for date-range inventory queries & availability lookups
CREATE INDEX IF NOT EXISTS idx_room_inventory_lookup 
ON room_inventory (room_type_id, inventory_date, available_rooms);

CREATE INDEX IF NOT EXISTS idx_room_inventory_date 
ON room_inventory (inventory_date);
