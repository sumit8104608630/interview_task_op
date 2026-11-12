-- Migration: 003_create_hotel_catalogue_tables.sql
-- Description: Creates locations, amenities, hotels, hotel_amenities, hotel_images, and room_types tables.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Locations Table
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_locations_city_state_country UNIQUE (city, state, country)
);

-- 2. Amenities Table
CREATE TABLE IF NOT EXISTS amenities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Hotels Table
CREATE TABLE IF NOT EXISTS hotels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    address_line VARCHAR(255) NOT NULL,
    postal_code VARCHAR(20),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Hotel Amenities Mapping Table
CREATE TABLE IF NOT EXISTS hotel_amenities (
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    amenity_id UUID NOT NULL REFERENCES amenities(id) ON DELETE CASCADE,
    PRIMARY KEY (hotel_id, amenity_id)
);

-- 5. Hotel Images Table
CREATE TABLE IF NOT EXISTS hotel_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    secure_url TEXT NOT NULL,
    cloudinary_public_id TEXT,
    alt_text VARCHAR(255),
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Room Types Table
CREATE TABLE IF NOT EXISTS room_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    max_guests INTEGER NOT NULL CHECK (max_guests > 0),
    price_per_night NUMERIC(12,2) NOT NULL CHECK (price_per_night >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    total_rooms INTEGER NOT NULL DEFAULT 1 CHECK (total_rooms >= 0),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_hotels_location_id ON hotels(location_id);
CREATE INDEX IF NOT EXISTS idx_hotels_is_active ON hotels(is_active);
CREATE INDEX IF NOT EXISTS idx_hotels_slug ON hotels(slug);
CREATE INDEX IF NOT EXISTS idx_hotel_images_hotel_display ON hotel_images(hotel_id, display_order ASC);
CREATE INDEX IF NOT EXISTS idx_hotel_amenities_hotel_id ON hotel_amenities(hotel_id);
CREATE INDEX IF NOT EXISTS idx_hotel_amenities_amenity_id ON hotel_amenities(amenity_id);
CREATE INDEX IF NOT EXISTS idx_room_types_hotel_active ON room_types(hotel_id, active);
CREATE INDEX IF NOT EXISTS idx_locations_city ON locations(city);
