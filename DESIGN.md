# Hotel Booking Portal — System Design Document (DESIGN.md)

This document provides a comprehensive technical reference for the architecture, database schema, concurrency controls, security safeguards, and asynchronous notification worker of the Hotel Booking Portal backend.

> [!NOTE]
> **Deployment Status:**
> This system is developed, verified, and configured for **local Node.js (v20+) and PostgreSQL (v15+)**. No production cloud deployment (e.g. AWS/GCP/Vercel serverless) has been performed yet for the backend server.

---

## 1. System Architecture

The backend follows a layered, domain-driven modular architecture designed for high maintainability, strict transaction boundaries, and horizontal scalability.

```mermaid
graph TD
    Client["Frontend Client / Postman (React / REST)"]
    
    subgraph SecurityGateway ["Security & HTTP Gateway"]
        Helmet["Helmet Security Headers"]
        Cors["Strict CORS Middleware"]
        Limiter["Rate Limiters (OTP Send / Verify / Global)"]
        Parser["Cookie & JSON Body Parser"]
        ReqLogger["Request Logger & Trace ID"]
    end
    
    subgraph APIControllers ["Express Router & Controllers"]
        AuthCtrl["Auth Controller (/api/auth)"]
        HotelCtrl["Hotel & Location Controller (/api/hotels, /api/locations)"]
        RoomCtrl["Room Availability Controller (/api/rooms)"]
        BookingCtrl["Booking & Cancellation Controller (/api/bookings)"]
    end

    subgraph DomainServices ["Domain Services (Business Logic)"]
        AuthSvc["Auth Service (JWT, Sessions, Bcrypt)"]
        HotelSvc["Hotel Catalogue Service"]
        RoomSvc["Room Inventory Service"]
        BookingSvc["Booking Service (Atomic Reservations & Cancellation)"]
    end

    subgraph DataRepositories ["Repositories (Database Layer)"]
        AuthRepo["Auth Repository"]
        HotelRepo["Hotel Repository"]
        RoomRepo["Room Repository"]
        BookingRepo["Booking Repository"]
        OutboxRepo["Outbox Repository"]
    end

    subgraph DatabaseStorage ["PostgreSQL Database (ACID Storage)"]
        PgCustomers["customers & auth_sessions"]
        PgCatalogue["hotels, locations, room_types, amenities"]
        PgInventory["room_inventory (FOR UPDATE Locks)"]
        PgBookings["bookings & booking_guests"]
        PgGuestSessions["guest_sessions (Single-Use Proofs)"]
        PgOutbox["notification_outbox (SKIP LOCKED)"]
    end

    subgraph BackgroundWorkers ["Asynchronous Outbox Worker"]
        Worker["Notification Worker (Poll Interval: 3000ms)"]
        WorkerLease["Row Leasing & Exponential Backoff"]
    end

    subgraph ExternalServices ["External Microservices"]
        OtpService["Email OTP & Notification Microservice (Vercel)"]
    end

    Client --> SecurityGateway
    SecurityGateway --> APIControllers
    APIControllers --> DomainServices
    DomainServices --> DataRepositories
    DataRepositories --> DatabaseStorage

    Worker --> OutboxRepo
    Worker --> ExternalServices
    AuthSvc --> ExternalServices
```

---

## 2. Database Schema & Entity Relationships

```mermaid
erDiagram
    LOCATIONS ||--o{ HOTELS : "hosts"
    HOTELS ||--o{ ROOM_TYPES : "offers"
    HOTELS ||--o{ HOTEL_IMAGES : "features"
    HOTELS ||--o{ HOTEL_AMENITIES : "has"
    AMENITIES ||--o{ HOTEL_AMENITIES : "categorizes"
    ROOM_TYPES ||--o{ ROOM_INVENTORY : "tracks daily inventory"
    ROOM_TYPES ||--o{ BOOKINGS : "reserved in"
    CUSTOMERS ||--o{ AUTH_SESSIONS : "owns"
    CUSTOMERS ||--o{ BOOKINGS : "places (optional for guest)"
    BOOKINGS ||--|| BOOKING_GUESTS : "contains"
    BOOKINGS ||--o{ GUEST_SESSIONS : "authorizes cancellation"
    BOOKINGS ||--o{ NOTIFICATION_OUTBOX : "triggers"

    CUSTOMERS {
        uuid id PK
        varchar email UK
        varchar full_name
        varchar password_hash
        varchar status
        timestamptz email_verified_at
        timestamptz last_login_at
        timestamptz created_at
    }

    AUTH_SESSIONS {
        uuid id PK
        uuid customer_id FK
        varchar ip_address
        text user_agent
        timestamptz expires_at
        timestamptz revoked_at
        timestamptz created_at
    }

    LOCATIONS {
        uuid id PK
        varchar city UK
        varchar state
        varchar country
        varchar timezone
        boolean is_active
    }

    HOTELS {
        uuid id PK
        uuid location_id FK
        varchar name
        varchar slug UK
        text description
        text address
        varchar postal_code
        numeric star_rating
        boolean is_active
    }

    ROOM_TYPES {
        uuid id PK
        uuid hotel_id FK
        varchar name
        varchar code
        text description
        integer max_guests
        numeric base_price
        integer total_rooms
        boolean is_active
    }

    ROOM_INVENTORY {
        uuid id PK
        uuid room_type_id FK
        date inventory_date
        integer total_rooms
        integer available_rooms
        numeric price_override
    }

    BOOKINGS {
        uuid id PK
        varchar booking_reference UK
        uuid customer_id FK "nullable for guest"
        uuid room_type_id FK
        date check_in
        date check_out
        integer nights
        integer rooms_count
        numeric nightly_price_snapshot
        numeric total_amount
        varchar status "CONFIRMED | CANCELLED"
        varchar idempotency_key UK
        timestamptz created_at
        timestamptz cancelled_at
    }

    BOOKING_GUESTS {
        uuid id PK
        uuid booking_id FK
        varchar full_name
        varchar email
        varchar phone
        timestamptz created_at
    }

    GUEST_SESSIONS {
        uuid id PK
        uuid booking_id FK
        varchar email
        varchar purpose "CANCELLATION"
        varchar token_hash UK
        timestamptz expires_at
        timestamptz consumed_at
        timestamptz created_at
    }

    NOTIFICATION_OUTBOX {
        uuid id PK
        uuid booking_id FK
        varchar event_type "BOOKING_CONFIRMED | BOOKING_CANCELLED"
        varchar idempotency_key UK
        jsonb payload
        varchar status "PENDING | SENT | FAILED"
        integer attempts
        timestamptz next_attempt_at
        text last_error
        timestamptz created_at
        timestamptz sent_at
    }
```

---

## 3. Concurrency, Invariants & Security Architecture

1. **Room Inventory Concurrency:**
   - Evaluated within strict database transactions (`BEGIN ... COMMIT ... ROLLBACK`).
   - Row-level locking on `room_inventory` with deterministic sorting:
     `SELECT available_rooms FROM room_inventory WHERE ... ORDER BY inventory_date ASC FOR UPDATE`
   - Zero overbooking and zero partial reservations across multi-night stays.
2. **Stay Interval Semantics:**
   - Check-in is **inclusive**, checkout is **exclusive** ($[checkIn, checkOut)$). The checkout date never consumes room inventory.
3. **Decoupled Transactional Outbox:**
   - Events are staged in `notification_outbox` inside the booking transaction.
   - Separate worker polls using `FOR UPDATE SKIP LOCKED` and leases records.
   - Exponential backoff with jitter on transient failures.
4. **Defense in Depth Security:**
   - Anti-enumeration generic 404 on booking lookup.
   - HttpOnly, SameSite, Secure session cookies.
   - Strict CSRF protection with cryptographic token verification.
   - All SQL parameterized; inputs strongly validated via Zod.
