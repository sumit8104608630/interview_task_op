# Database Migrations

This directory contains version-controlled SQL migration scripts for PostgreSQL:

1. **`001_create_customers_and_auth_sessions.sql`**: Customers table with lower-case email index and auth_sessions table.
2. **`002_add_password_hash_to_customers.sql`**: Password hash column for customer credential management.
3. **`003_create_hotel_catalogue_tables.sql`**: Locations, amenities, hotels, hotel_amenities, hotel_images, and room_types tables.
4. **`004_create_room_inventory_table.sql`**: Date-wise room inventory table with unique constraint and composite lookup index.
5. **`005_create_bookings_and_guests_tables.sql`**: Bookings table with multi-room support (`rooms_count`), `customer_id` (NULL for guest bookings), booking_guests, and notification_outbox tables.
6. **`006_create_guest_sessions_table.sql`**: Guest sessions table for short-lived, single-use, booking-scoped authorization proofs (e.g. `CANCELLATION`).
