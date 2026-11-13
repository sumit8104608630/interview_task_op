# Hotel Booking Portal — Backend Service

A modular, production-oriented Node.js / Express backend architected for the customer-facing Hotel Booking Portal.

---

## 1. Architectural Pattern

This backend adheres strictly to a clean, layered architecture with one-way data flow:

```
HTTP Client / Postman / Frontend
             │
             ▼
      Routes Layer (URL mapping & Zod validation)
             │
             ▼
    Controllers Layer (HTTP req/res mapping only)
             │
             ▼
     Services Layer (Business logic & workflow orchestration)
             │
             ▼
   Repositories Layer (PostgreSQL parameterized SQL queries)
             │
             ▼
        PostgreSQL
```

### Layer Responsibilities

- **Routes (`src/routes/`, `src/modules/auth/auth.routes.js`)**: Map HTTP paths and methods to controller handlers and validation middleware. Strictly contain no business logic or SQL.
- **Controllers (`src/controllers/`, `src/modules/auth/auth.controller.js`)**: Thin handlers. Extract request bodies, route parameters, and query strings. Call domain services and format HTTP responses.
- **Services (`src/services/`, `src/modules/auth/auth.service.js`)**: Enforce business rules (e.g., date interval validations, stay price calculations, passwordless auth logic). Coordinate database repositories and external integrations. Do not depend on Express `req`/`res`.
- **Repositories (`src/repositories/`, `src/modules/auth/auth.repository.js`)**: Manage database access using parameterized queries via `pg`. Decoupled from HTTP context and business decisions.
- **Integrations (`src/integrations/`)**: Outbound adapters wrapping third-party APIs (Cloudinary, external live OTP & Notification Microservice).
- **Middleware (`src/middleware/`)**: Centralized error handling, request logging with distributed tracing IDs (`x-request-id`), schema validation, rate limiting, CSRF protection, and 404 handling.

---

## 2. Directory Structure

```
server/
├── src/
│   ├── app.js                          # Express app configuration & middleware pipeline
│   ├── server.js                       # HTTP server entrypoint & graceful shutdown
│   │
│   ├── config/                         # Centralized configuration
│   │   ├── env.js                      # Environment variables loader & validator
│   │   ├── database.js                 # PostgreSQL pool configuration
│   │   ├── cloudinary.js               # Cloudinary SDK client setup
│   │   └── index.js                    # Unified config export
│   │
│   ├── constants/                      # Enums and immutable definitions
│   │   ├── bookingStatus.js            # Booking state machine constants
│   │   └── errorMessages.js            # Machine-readable error codes & client messages
│   │
│   ├── controllers/                    # General domain HTTP request & response handlers
│   │   ├── hotel.controller.js         # Hotel listing and details endpoints
│   │   ├── location.controller.js      # Location listing and details endpoints
│   │   ├── amenity.controller.js       # Amenities catalogue endpoint
│   │   ├── room.controller.js          # Room categories and availability quotes
│   │   └── booking.controller.js       # Booking creation, lookup, and cancellation
│   │
│   ├── modules/
│   │   └── auth/                       # Customer Authentication Domain Module
│   │       ├── auth.routes.js          # /api/auth endpoints (send-otp, verify-otp, login, reset)
│   │       ├── auth.controller.js      # HTTP controller mapping for auth endpoints
│   │       ├── auth.service.js         # Registration/login business logic & session handling
│   │       ├── auth.repository.js      # PostgreSQL queries for customers & auth_sessions
│   │       ├── auth.validation.js      # Zod validation schemas for auth payloads
│   │       ├── auth.middleware.js      # requireAuth middleware checking JWT + active session
│   │       └── auth.cookies.js         # HttpOnly cookie helpers (setAuthCookie, clearAuthCookie)
│   │
│   ├── services/                       # Core domain business logic
│   │   ├── hotel.service.js            # Catalog discovery, sorting, and details
│   │   ├── location.service.js         # Locations filtering and active hotel counts
│   │   ├── amenity.service.js          # Amenities retrieval
│   │   ├── room.service.js             # Room categories and stay pricing calculation
│   │   ├── booking.service.js          # Booking workflows & state transitions
│   │   └── notification.service.js     # Notification coordination (non-blocking)
│   │
│   ├── repositories/                   # Data access layer (PostgreSQL SQL queries)
│   │   ├── hotel.repository.js         # Hotel parameterized queries with JSON aggregations
│   │   ├── location.repository.js      # Location parameterized queries and active counts
│   │   ├── amenity.repository.js       # Amenities queries
│   │   ├── room.repository.js          # Room category & inventory locking queries
│   │   └── booking.repository.js       # Booking, guest, & status update queries
│   │
│   ├── routes/                         # Express API route declarations
│   │   ├── hotel.routes.js             # /api/hotels endpoints
│   │   ├── location.routes.js          # /api/locations endpoints
│   │   ├── amenity.routes.js           # /api/amenities endpoints
│   │   ├── room.routes.js              # /api/room-types endpoints
│   │   ├── booking.routes.js           # /api/bookings endpoints
│   │   └── index.js                    # Aggregated domain router mount
│   │
│   ├── middleware/                     # Cross-cutting Express middleware
│   │   ├── error.middleware.js         # Centralized error handler & AppError class
│   │   ├── notFound.middleware.js      # 404 Not Found handler
│   │   ├── validate.middleware.js      # Zod request validation middleware
│   │   ├── rateLimiter.middleware.js   # Sliding-window in-memory rate limiter for OTP endpoints
│   │   ├── csrf.middleware.js          # CSRF double-submit token verification
│   │   └── requestLogger.middleware.js # Request ID generator & Morgan HTTP logger
│   │
│   ├── validators/                     # General domain Zod schemas
│   │   ├── hotel.validator.js          # Hotel search & filter schemas
│   │   ├── location.validator.js       # Location pagination & params schemas
│   │   ├── room.validator.js           # Room availability query schema
│   │   └── booking.validator.js        # Booking create, lookup, and cancel schemas
│   │
│   ├── integrations/                   # External microservice & provider clients
│   │   ├── otp/
│   │   │   └── otpClient.js            # Live adapter for external OTP Microservice
│   │   ├── cloudinary/
│   │   │   └── cloudinary.service.js   # Cloudinary image upload and deletion
│   │   └── notification/
│   │       └── notification.client.js  # External notification microservice email client
│   │
│   ├── database/                       # Database connection and data seeding
│   │   ├── connection.js               # pg.Pool instance & health-check runner
│   │   ├── migrations/                 # Versioned SQL migration scripts
│   │   │   ├── 001_create_customers_and_auth_sessions.sql
│   │   │   ├── 002_add_password_hash_to_customers.sql
│   │   │   └── 003_create_hotel_catalogue_tables.sql
│   │   └── seeds/
│   │       ├── data/
│   │       │   ├── demo_catalogue.json # 100 fictional hotel demo records with Unsplash images
│   │       │   └── hotels.json         # Fictional dataset (5 sample hotels)
│   │       └── seed.js                 # Seed loader & runner
│   │
│   └── utils/                          # Common helpers and domain utilities
│       ├── apiResponse.js              # Consistent { success, data, requestId } formatter
│       ├── asyncHandler.js             # Promise-to-next wrapper for controllers
│       ├── dateUtils.js                # Calendar stay date & night calculation logic
│       ├── generateBookingReference.js # Collision-resistant booking reference generator
│       ├── jwt.js                      # Cryptographic JWT signing & strict verification
│       └── normalizeEmail.js           # Email lower-casing & trimming utility
│
├── tests/                              # Automated test suites (63 passing tests)
│   ├── fixtures/
│   │   └── sampleHotel.json            # Mock dataset for test isolation
│   ├── unit/
│   │   ├── auth.jwt.test.js            # JWT signing, claims, expiration, and secret tests
│   │   ├── auth.service.test.js        # Registration, password login, forgot/reset, sessions
│   │   ├── dateUtils.test.js           # Calendar stay date arithmetic tests
│   │   └── generateBookingReference.test.js
│   └── integration/
│       ├── auth.api.test.js            # End-to-end auth API tests (cookie, /me, password, reset)
│       ├── catalogue.api.test.js       # Phase 2 catalogue API tests (hotels, rooms, locations, amenities)
│       ├── search.api.test.js          # Phase 3 search & availability API tests (dates, capacity, inventory)
│       ├── booking.api.test.js         # Phase 4 booking creation, multi-room, concurrency & idempotency
│       └── health.test.js              # Health-check & core route integration tests
│
├── postman/
│   ├── Customer_Authentication.postman_collection.json     # Complete Postman test collection
│   ├── Hotel_Catalogue.postman_collection.json             # Phase 2 Hotel Catalogue Postman collection
│   ├── Hotel_Search_Availability.postman_collection.json   # Phase 3 Hotel Search & Availability Postman collection
│   ├── Booking_Creation.postman_collection.json            # Phase 4 Booking Creation & Guest Checkout collection
│   └── README.md                       # Postman testing guide & collection instructions
│
├── .env.example                        # Environment variable documentation template
├── .gitignore                          # Git ignore rules
├── package.json                        # Node.js project manifest & scripts
└── README.md                           # Backend architectural documentation
```

---

## 3. Customer Authentication System (Phase 1)

### Overview
Authentication system supporting passwordless Email OTP verification, optional password registration, password login, and forgot/reset password flows with session revocation.

### Endpoints
* **`POST /api/auth/send-otp`**
  - **Registration payload:** `{ "email": "customer@example.com", "fullName": "John Doe", "password"?: "..." }`
  - **Login payload:** `{ "email": "customer@example.com" }`
  - Returns a generic message to prevent email enumeration attacks:
    `"If the email address is valid, a one-time verification code has been dispatched."`
  - Rate limited to 5 requests per 10 minutes per IP/email.
* **`POST /api/auth/verify-otp`**
  - **Registration payload:** `{ "email": "customer@example.com", "fullName": "John Doe", "otp": "123456", "password"?: "..." }`
  - **Login payload:** `{ "email": "customer@example.com", "otp": "123456" }`
  - Upon successful verification:
    - New customer: created in `customers` table with `status = 'ACTIVE'`, `email_verified_at = NOW()`, and bcrypt `password_hash` if provided.
    - Existing customer: updates `last_login_at = NOW()`.
    - Generates an `auth_sessions` record in PostgreSQL.
    - Signs a JWT and stores it in an `HttpOnly` cookie (`auth_token`).
    - Issues a CSRF cookie (`csrf_token`) for the client.
* **`POST /api/auth/login`**
  - **Payload:** `{ "email": "customer@example.com", "password": "SecurePassword123" }`
  - Verifies credentials against bcrypt `password_hash`.
  - Creates a new `auth_sessions` record and issues an `HttpOnly` cookie (`auth_token`).
* **`POST /api/auth/forgot-password`**
  - **Payload:** `{ "email": "customer@example.com" }`
  - Dispatches a reset OTP via the microservice.
  - Returns generic message to prevent enumeration. Rate limited.
* **`POST /api/auth/reset-password`**
  - **Payload:** `{ "email": "customer@example.com", "otp": "123456", "newPassword": "NewPassword123" }`
  - Verifies OTP, hashes new password with bcrypt, updates `password_hash`.
  - Revokes all existing active sessions for this customer to force re-authentication.
* **`GET /api/auth/me`**
  - Authenticated via `HttpOnly` cookie.
  - Verifies JWT signature, expiration, issuer, audience, and algorithm.
  - Verifies session row in `auth_sessions` (`revoked_at IS NULL` and `expires_at > NOW()`).
  - Verifies customer `status = 'ACTIVE'`.
  - Returns customer profile without leaking internal session secrets.
* **`POST /api/auth/logout`**
  - Revokes session in PostgreSQL (`revoked_at = NOW()`).
  - Clears `auth_token` cookie using identical attributes.
  - Enforces CSRF token check (`x-csrf-token`).

### External OTP Microservice Integration
The backend communicates directly with your deployed OTP microservice:
* **Base URL:** `https://otp-microservise.vercel.app`
* **Send Endpoint:** `POST /api/send-otp` with `{ email }`
* **Verify Endpoint:** `POST /api/verify-otp` with `{ email, otp }`
* **Email Endpoint:** `POST /api/send-email` with `{ to, subject, html, text }`

---

## 4. Hotel Catalogue Management System (Phase 2)

### Overview
Exposes the 100 fictional hotel demo records with direct Unsplash imagery, available locations, room categories, and amenities to the frontend application. Prevents N+1 queries through correlated JSON subqueries in PostgreSQL and parameterized SQL.

### Catalogue Endpoints
* **`GET /api/hotels`**
  - **Query parameters:** `page`, `limit`, `locationId`, `city`, `sortBy` (`name` | `price` | `created_at`), `sortOrder` (`asc` | `desc`).
  - Returns active hotels only (`is_active = TRUE`).
  - Includes structured location object, sorted external Unsplash images, amenities, and room category pricing summaries.
  - Returns metadata: `total`, `page`, `limit`, `totalPages`.
* **`GET /api/hotels/:id`**
  - Accepts hotel UUID or slug (e.g. `grand-residency-mumbai-001`).
  - Returns full structured details including images sorted by `display_order`, amenities, and active room categories.
  - Returns 404 `HOTEL_NOT_FOUND` if unknown or inactive.
* **`GET /api/hotels/:id/rooms`**
  - Returns active room types belonging to the specified hotel with price and capacity.
  - Excludes internal inventory records and inactive room types.
  - Validates hotel existence (returns 404 if hotel is not found or inactive).
* **`GET /api/locations`**
  - Returns all available hotel locations (cities, states, countries, timezones) with active hotel counts.
  - Filters out inactive or empty locations.
* **`GET /api/locations/:id`**
  - Retrieves single location details by UUID or city name.
  - Returns 404 `NOT_FOUND` if location does not exist.
* **`GET /api/amenities`**
  - Returns full catalog of available amenities (`id`, `code`, `name`).

*All endpoints are mounted simultaneously under `/api/...` and `/api/v1/...` for complete client and legacy compatibility.*

---

## 5. Hotel Search and Room Availability System (Phase 3)

### Overview
High-performance date-wise room availability search and inventory verification system. Uses CTE-based aggregated SQL queries over `room_inventory` to verify continuous multi-day room availability without N+1 loops, enforces strict date interval semantics, guest capacity, price range, and amenity criteria.

### Core Business Rules & Invariants
- **Check-in is inclusive, Check-out is exclusive:** A stay from December 1 to December 4 requires inventory on December 1, 2, and 3 (3 nights). The checkout date does not consume room inventory.
- **Strict Inventory Integrity:** Missing inventory records are never assumed to be available; any missing date evaluates strictly to `MISSING_INVENTORY`.
- **Date Validations:**
  - Reject malformed dates with 400 `VALIDATION_ERROR`.
  - Reject check-out date on or before check-in date with 400 `INVALID_DATE_RANGE`.
  - Reject past check-in dates relative to hotel timezone (`Asia/Kolkata`) with 400 `PAST_CHECK_IN_DATE`.
  - Reject stay durations exceeding 30 nights with 400 `STAY_DURATION_EXCEEDED`.
- **Capacity Matching:** A room category is eligible only if `room_types.max_guests >= Math.ceil(guests / rooms)` and `available_rooms >= rooms` across all stay nights.
- **Zero Inventory Reservation during Search:** Searching does not reserve or mutate room inventory.

### Search & Availability Endpoints
* **`GET /api/hotels/search`**
  - **Query parameters:** `city`, `locationId`, `checkIn`, `checkOut`, `guests` (default 1), `rooms` (default 1), `minPrice`, `maxPrice`, `amenities` (comma-separated or array), `sortBy` (`lowest_price` | `highest_price` | `name`), `sortOrder` (`asc` | `desc`), `page` (default 1), `limit` (default 10).
  - Only returns active hotels that have at least one room category satisfying the date-wise inventory, capacity, and filter criteria.
  - Returns calculated `minPrice`, `minTotalStayPrice`, and stay metadata.
* **`GET /api/rooms/availability`**
  - **Query parameters:** `roomTypeId`, `checkIn`, `checkOut`, `rooms` (default 1).
  - Returns structured stay details, room type information, total rooms, available rooms across requested stay, availability status (`AVAILABLE` | `INSUFFICIENT_ROOMS` | `MISSING_INVENTORY`), pricing breakdown, and clean nightly date-by-date breakdown without exposing internal database primary keys.
  - Returns 404 `ROOM_NOT_FOUND` if the room category does not exist or is inactive.
* **`GET /api/v1/room-types/:id/availability`**
  - Supported for seamless backward compatibility.

---

## 6. Booking Creation and Guest Checkout System (Phase 4)

### Overview
Enterprise-grade booking engine handling both registered customer sessions and friction-free guest checkouts. Guarantees transactional consistency, row-level concurrency locks, multi-room capacity validation, server-side decimal pricing, idempotency deduplication, and asynchronous confirmation notification dispatch.

### Core Architecture & Invariants
- **Registered vs. Guest Checkout:**
  - Registered customers authenticate via HttpOnly JWT session cookie; `customer_id` is assigned from authenticated server session context.
  - Client request body is strictly forbidden from injecting `customerId` (rejected with 400 `VALIDATION_ERROR`).
  - Guest customers check out without mandatory account registration; `customer_id` is stored as `NULL` and guest details are preserved in `booking_guests`.
- **Multi-Room Support:**
  - Supports booking multiple rooms (`rooms` / `rooms_count`).
  - Automatically verifies and decrements `rooms_count` from `available_rooms` on every stay night $[checkIn, checkOut)$.
  - Check-out date is strictly exclusive and does not consume inventory.
- **Server-Side Decimal Pricing:**
  - Nightly price snapshot stored at booking time (`nightly_price_snapshot`).
  - Total calculated as: $nights \times nightlyPriceSnapshot \times roomsCount$.
  - Uses exact decimal arithmetic to prevent IEEE-754 floating-point errors.
- **Database Concurrency & Race-Condition Prevention:**
  - Uses PostgreSQL multi-statement transactions (`BEGIN ... COMMIT ... ROLLBACK`).
  - Acquires row-level locks on `room_inventory` in consistent sorted order (`ORDER BY inventory_date ASC FOR UPDATE`) to prevent deadlocks and overbooking.
  - If any date has insufficient rooms or missing inventory, rolls back the entire transaction immediately (zero partial reservations).
  - Outbox pattern: inserts `BOOKING_CONFIRMATION` event into `notification_outbox` within the same atomic transaction.
- **Human-Readable Booking Reference:**
  - Cryptographically secure collision-resistant reference formatted as `HBP-XXXXXXXX` (e.g. `HBP-7K8M9PQ2`) with automated retry loop.
- **Idempotency & Replay Protection:**
  - Supports `Idempotency-Key` header or body parameter. Replayed requests return the existing booking with 200 OK without double-decrementing inventory.

### Booking Endpoints
* **`POST /api/bookings`**
  - **Payload:** `{ roomTypeId, checkIn, checkOut, rooms, guest: { name, email, phone } }`.
  - Atomically reserves inventory and creates booking.
  - Returns `bookingReference`, `totalAmount`, `status`, `nights`, `roomsCount`, and guest details.
* **`POST /api/bookings/lookup`**
  - **Payload:** `{ bookingReference, email }`.
  - Retrieves booking details when reference and email match (prevents enumeration).

---

## 7. Getting Started

### Installation
```bash
cd server
npm install
```

### Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Configure your local PostgreSQL credentials:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/hotel_booking_portal
JWT_SECRET=your_super_secret_jwt_key_at_least_32_characters_long
FRONTEND_ORIGIN=http://localhost:5173
OTP_SERVICE_BASE_URL=https://otp-microservise.vercel.app
```

### Running the Application
```bash
# Development mode (with nodemon)
npm run dev

# Production mode
npm start

# Automated test suite (101 tests across 9 suites)
npm test
```
