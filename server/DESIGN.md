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

## 3. Module Responsibilities & Directory Layout

```
server/
├── postman/                             # Exported Postman collections
│   ├── Hotel_Booking_Portal_Complete.postman_collection.json # Unified Master Collection
│   └── README.md                        # Postman execution guide
├── src/
│   ├── config/
│   │   └── env.js                       # Environment validation & configuration
│   ├── constants/
│   │   └── errorMessages.js             # Standardized error codes & messages
│   ├── controllers/
│   │   ├── booking.controller.js        # Booking, lookup, history, cancellation endpoints
│   │   ├── hotel.controller.js          # Hotel catalogue & search endpoints
│   │   ├── location.controller.js       # Geographic locations endpoints
│   │   ├── room.controller.js           # Room categories & availability endpoints
│   │   └── amenity.controller.js        # Hotel amenities endpoints
│   ├── database/
│   │   ├── connection.js                # PostgreSQL connection pool & health checks
│   │   ├── migrations/                  # 001 to 007 SQL schema migration files
│   │   └── seeds/                       # 100 hotel fictional seed generator
│   ├── integrations/
│   │   ├── notification/
│   │   │   └── notification.client.js   # Microservice email notification adapter
│   │   └── otp/
│   │       └── otpClient.js             # Microservice OTP verification client
│   ├── middleware/
│   │   ├── error.middleware.js          # Centralized error handler & AppError
│   │   ├── notFound.middleware.js       # 404 handler
│   │   ├── rateLimiter.middleware.js    # Rate limiting for OTP & auth
│   │   ├── requestLogger.middleware.js  # Request tracing & logging
│   │   └── validate.middleware.js       # Zod request validator
│   ├── modules/
│   │   └── auth/                        # Customer authentication module
│   │       ├── auth.controller.js       # OTP & Password auth controllers
│   │       ├── auth.middleware.js       # JWT & session verification middleware
│   │       ├── auth.repository.js       # Customer & session database access
│   │       ├── auth.routes.js           # /api/auth routes
│   │       ├── auth.service.js          # Passwordless & credential business logic
│   │       └── auth.validator.js        # Zod auth schemas
│   ├── repositories/
│   │   ├── booking.repository.js        # Transactional booking & inventory queries
│   │   ├── hotel.repository.js          # Parametric hotel listing & detail queries
│   │   ├── location.repository.js       # Location queries with active hotel counts
│   │   ├── outbox.repository.js         # Row-locked SKIP LOCKED outbox access
│   │   └── room.repository.js           # Room availability & CTE inventory queries
│   ├── routes/
│   │   └── index.js                     # Central API route router (/api & /api/v1)
│   ├── services/
│   │   ├── booking.service.js           # Booking orchestration & pricing validation
│   │   ├── hotel.service.js             # Catalogue filtering & sorting logic
│   │   └── notification.service.js      # Notification facade
│   ├── utils/
│   │   ├── apiResponse.js               # Standardized success/error JSON response builders
│   │   ├── dateUtils.js                 # ISO date intervals & timezone cutoff calculations
│   │   ├── generateBookingReference.js  # HBP-XXXXXXXX collision-resistant reference generator
│   │   └── jwt.js                       # Cryptographic JWT signing & verification
│   ├── validators/                      # Zod validation schemas for all routes
│   ├── workers/
│   │   └── notification.worker.js       # Background transactional outbox poller
│   ├── app.js                           # Express app initialization
│   └── server.js                        # HTTP server entrypoint & graceful shutdown
└── tests/                               # 125 automated unit & integration tests
```

---

## 4. Key Architectural & Concurrency Designs

### 4.1 Room Inventory Concurrency Strategy

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer / Guest
    participant Router as Express Booking API
    participant Service as Booking Service
    participant Repo as Booking Repository
    participant DB as PostgreSQL Transaction

    Customer->>Router: POST /api/bookings { roomTypeId, checkIn, checkOut, rooms }
    Router->>Service: Validate Date Intervals & Guest Details
    Service->>Repo: createBookingAtomic(...)
    Repo->>DB: BEGIN TRANSACTION (ISOLATION LEVEL READ COMMITTED)
    Note over Repo,DB: Acquire Row-Level Locks in deterministic sorted order
    Repo->>DB: SELECT available_rooms FROM room_inventory<br/>WHERE room_type_id = $1 AND inventory_date >= checkIn AND inventory_date < checkOut<br/>ORDER BY inventory_date ASC FOR UPDATE
    alt Any night missing OR available_rooms < requested rooms
        Repo->>DB: ROLLBACK
        Repo-->>Service: Throw INSUFFICIENT_ROOMS / MISSING_INVENTORY
        Service-->>Customer: 400 Bad Request
    else Sufficient rooms available on every occupied night
        Repo->>DB: UPDATE room_inventory SET available_rooms = available_rooms - roomsCount<br/>WHERE room_type_id = $1 AND inventory_date >= checkIn AND inventory_date < checkOut
        Repo->>DB: INSERT INTO bookings (...) VALUES (...) RETURNING *
        Repo->>DB: INSERT INTO booking_guests (...) VALUES (...)
        Repo->>DB: INSERT INTO notification_outbox (..., 'BOOKING_CONFIRMED', ...)
        Repo->>DB: COMMIT
        Repo-->>Service: Return Confirmed Booking
        Service-->>Customer: 201 Created (Booking Reference HBP-XXXXXXXX)
    end
```

**Key Concurrency Invariants:**
1. **Row-Level Locking:** Acquiring locks with `ORDER BY inventory_date ASC FOR UPDATE` prevents deadlocks between concurrent multi-room transactions that target overlapping date windows.
2. **Deterministic Stay Interval:** Stay check-in is **inclusive** and checkout is **exclusive** ($[checkIn, checkOut)$). Checkout date never consumes inventory.
3. **Multi-Room Atomicity:** If a user requests 3 rooms, all stay dates must have $\ge 3$ available rooms. If any single night has 2 rooms, the entire reservation aborts with zero partial allocation.
4. **Zero Overbooking Guarantee:** Tested under parallel concurrency workloads with multiple simultaneous workers and customers.

---

### 4.2 Booking Cancellation & Inventory Restoration Strategy

```mermaid
sequenceDiagram
    autonumber
    actor Guest as Customer / Guest
    participant Router as Booking API
    participant Service as Booking Service
    participant Repo as Booking Repository
    participant DB as PostgreSQL Database

    Guest->>Router: POST /api/bookings/cancellation/send-otp { reference, email }
    Router->>Service: Verify reference & guest email match
    Service->>Service: Validate cancellation deadline (Asia/Kolkata timezone)
    Service->>Router: Send OTP via microservice
    Router-->>Guest: 200 OK (OTP dispatched to guest email)

    Guest->>Router: POST /api/bookings/cancellation/verify-otp { reference, email, otp }
    Router->>Service: Verify OTP digits
    Service->>Repo: createGuestSession(purpose='CANCELLATION', ttl=15m)
    Repo->>DB: INSERT INTO guest_sessions (booking_id, token_hash, expires_at)
    Repo-->>Guest: 200 OK { cancellationProof }

    Guest->>Router: POST /api/bookings/cancellation/cancel { reference, email, cancellationProof }
    Router->>Repo: cancelBookingAtomic(...)
    Repo->>DB: BEGIN TRANSACTION
    Repo->>DB: Verify & lock booking (status must be 'CONFIRMED')
    Repo->>DB: Atomically consume proof: UPDATE guest_sessions SET consumed_at = NOW()<br/>WHERE token_hash = sha256(proof) AND consumed_at IS NULL AND expires_at > NOW()
    Repo->>DB: UPDATE bookings SET status = 'CANCELLED', cancelled_at = NOW()
    Repo->>DB: UPDATE room_inventory SET available_rooms = available_rooms + roomsCount<br/>WHERE room_type_id = $1 AND inventory_date >= checkIn AND inventory_date < checkOut
    Repo->>DB: INSERT INTO notification_outbox (..., 'BOOKING_CANCELLED', ...)
    Repo->>DB: COMMIT
    Repo-->>Guest: 200 OK (Booking marked CANCELLED, inventory restored)
```

**Security Invariants:**
- **Single-Use Scoped Proof:** Proof token is bound strictly to `booking_id` and `purpose = 'CANCELLATION'`. Proof for Booking A cannot cancel Booking B.
- **Proof Replay Prevention:** Once consumed, any repeated cancellation attempt fails immediately with `400 INVALID_CANCELLATION_PROOF`.
- **Cancellation Cutoff Deadline:** Cancellations are rejected with `400 CANCELLATION_DEADLINE_PASSED` if the current date is on or after the stay's check-in date in the hotel's local timezone.

---

### 4.3 Transactional Notification Outbox & Worker Pattern

```mermaid
sequenceDiagram
    autonumber
    participant DB as PostgreSQL notification_outbox
    participant Worker as Notification Worker (Background Timer)
    participant Client as Notification Client Adapter
    participant Microservice as External OTP Microservice (Vercel)

    Note over Worker,DB: Polling cycle executes every 3000ms
    Worker->>DB: WITH claimed AS (<br/>  SELECT id FROM notification_outbox<br/>  WHERE status = 'PENDING' AND next_attempt_at <= CURRENT_TIMESTAMP<br/>  ORDER BY next_attempt_at ASC LIMIT 10<br/>  FOR UPDATE SKIP LOCKED<br/>)<br/>UPDATE notification_outbox SET next_attempt_at = NOW() + INTERVAL '2 minutes'<br/>FROM claimed RETURNING *;
    
    alt No due events
        Worker->>Worker: Sleep until next poll interval
    else Due events claimed
        loop For each claimed event
            Worker->>Client: sendBookingConfirmation(...) OR sendBookingCancellation(...)
            Client->>Microservice: POST /api/send-email { to, subject, html, text }
            alt Delivery Successful (200 OK)
                Client-->>Worker: { success: true, messageId: '...' }
                Worker->>DB: UPDATE notification_outbox SET status = 'SENT', sent_at = NOW(), last_error = NULL WHERE id = $1
            else Delivery Failed / Timeout / 500
                Client-->>Worker: { success: false, error: '...' }
                Worker->>Worker: Sanitize error (redact passwords, OTPs, tokens)
                Worker->>Worker: Compute exponential backoff: initialBackoff * (2 ^ attempts) + jitter
                alt attempts < maxAttempts (5)
                    Worker->>DB: UPDATE notification_outbox SET attempts = attempts + 1, next_attempt_at = calculatedBackoff, last_error = sanitizedError WHERE id = $1
                else attempts >= maxAttempts
                    Worker->>DB: UPDATE notification_outbox SET status = 'FAILED', attempts = attempts + 1, last_error = sanitizedError WHERE id = $1
                end
            end
        end
    end
```

---

## 5. Security & Protection Model

| Threat / Vulnerability | Mitigation Mechanism in Backend |
| :--- | :--- |
| **Cross-Site Scripting (XSS)** | JWT stored solely in `HttpOnly`, `SameSite` cookies inaccessible to JavaScript. Helmet sets strict security headers. |
| **Cross-Site Request Forgery (CSRF)** | State-changing authenticated requests enforce an explicit, cryptographic `x-csrf-token` header check. |
| **SQL Injection** | Strict parameterization on all queries (`$1, $2`). Zod strongly validates and sanitizes input before repository access. |
| **IDOR / Identity Spoofing** | Registered `customer_id` is derived strictly from verified JWT session context. Supplying `customerId` in request bodies or query strings is rejected with `400 VALIDATION_ERROR`. |
| **Booking Reference Enumeration** | `POST /api/bookings/lookup` requires both `bookingReference` and `email`. If either is mismatched, returns generic `404 BOOKING_NOT_FOUND` without leaking validity. |
| **OTP Brute-Forcing & DoS** | IP- and email-based rate limiters limit OTP requests to 5 per 15-minute window with 429 status codes. |
| **Sensitive Data Exposure** | Production error handler strips stack traces and internal errors. Notification error sanitizer redacts OTPs, tokens, and passwords. |
| **Double Spend / Overbooking** | Row-level locking on inventory records (`ORDER BY inventory_date ASC FOR UPDATE`) within ACID transactions. |
