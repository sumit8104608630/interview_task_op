-- Migration: 002_add_password_hash_to_customers.sql
-- Description: Adds password_hash column to customers table for password authentication.

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS password_hash TEXT;
