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

- **Routes (`src/routes/`)**: Map HTTP paths and methods to controller handlers and validation middleware. Strictly contain no business logic or SQL.
- **Controllers (`src/controllers/`)**: Thin handlers. Extract request bodies, route parameters, and query strings. Call domain services and format HTTP responses.
- **Services (`src/services/`)**: Enforce business rules (e.g., date interval validations, stay price calculations, booking state transitions). Coordinate database repositories and external integrations. Do not depend on Express `req`/`res`.
- **Repositories (`src/repositories/`)**: Manage database access using parameterized queries via `pg`. Decoupled from HTTP context and business decisions.
- **Integrations (`src/integrations/`)**: Outbound adapters wrapping third-party APIs (Cloudinary, external OTP & Notification Microservice).
- **Middleware (`src/middleware/`)**: Centralized error handling, request logging with distributed tracing IDs (`x-request-id`), schema validation, and 404 handling.

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
│   ├── controllers/                    # HTTP request & response orchestrators
│   │   ├── hotel.controller.js         # Hotel listing and details endpoints
│   │   ├── room.controller.js          # Room categories and availability quotes
│   │   └── booking.controller.js       # Booking creation, lookup, and cancellation
│   │
│   ├── services/                       # Core domain business logic
│   │   ├── hotel.service.js            # Catalog discovery & fallback dataset loader
│   │   ├── room.service.js             # Price calculation & inventory verification
│   │   ├── booking.service.js          # Booking workflows & state transitions
│   │   └── notification.service.js     # Notification coordination (non-blocking)
│   │
│   ├── repositories/                   # Data access layer (PostgreSQL SQL queries)
│   │   ├── hotel.repository.js         # Hotel & image parameterized queries
│   │   ├── room.repository.js          # Room category & inventory locking queries
│   │   └── booking.repository.js       # Booking, guest, & status update queries
│   │
│   ├── routes/                         # Express API route declarations
│   │   ├── hotel.routes.js             # /api/v1/hotels endpoints
│   │   ├── room.routes.js              # /api/v1/room-types endpoints
│   │   ├── booking.routes.js           # /api/v1/bookings endpoints
│   │   └── index.js                    # Aggregated router mount
│   │
│   ├── middleware/                     # Cross-cutting Express middleware
│   │   ├── error.middleware.js         # Centralized error handler & AppError class
│   │   ├── notFound.middleware.js      # 404 Not Found handler
│   │   ├── validate.middleware.js      # Zod request validation middleware
│   │   └── requestLogger.middleware.js # Request ID generator & Morgan HTTP logger
│   │
│   ├── validators/                     # Request payload and query Zod schemas
│   │   ├── hotel.validator.js          # Hotel search & filter schemas
│   │   ├── room.validator.js           # Room availability query schema
│   │   └── booking.validator.js        # Booking create, lookup, and cancel schemas
│   │
│   ├── integrations/                   # External microservice & provider clients
│   │   ├── cloudinary/
│   │   │   └── cloudinary.service.js   # Cloudinary image upload and deletion
│   │   └── notification/
│   │       └── notification.client.js  # External OTP & Notification HTTP client
│   │
│   ├── database/                       # Database connection and data seeding
│   │   ├── connection.js               # pg.Pool instance & health-check runner
│   │   ├── migrations/                 # Versioned SQL migration scripts
│   │   └── seeds/
│   │       ├── data/
│   │       │   └── hotels.json         # Fictional dataset (5 detailed sample hotels)
│   │       └── seed.js                 # Seed loader & runner
│   │
│   └── utils/                          # Common helpers and domain utilities
│       ├── apiResponse.js              # Consistent { success, data, requestId } formatter
│       ├── asyncHandler.js             # Promise-to-next wrapper for controllers
│       ├── dateUtils.js                # Calendar stay date & night calculation logic
│       └── generateBookingReference.js # Collision-resistant booking reference generator
│
├── tests/                              # Automated test suites
│   ├── fixtures/
│   │   └── sampleHotel.json            # Mock dataset for test isolation
│   ├── unit/
│   │   ├── dateUtils.test.js           # Unit tests for calendar interval logic
│   │   └── generateBookingReference.test.js
│   └── integration/
│       └── health.test.js              # Health-check & core route integration tests
│
├── postman/
│   └── README.md                       # Postman endpoint catalog & request templates
│
├── .env.example                        # Environment variable documentation template
├── .gitignore                          # Git ignore rules
├── package.json                        # Node.js project manifest & scripts
└── README.md                           # Backend architectural documentation
```

---

## 3. Getting Started

### Prerequisites
- Node.js (v18.0.0 or higher, tested with Node 24)
- npm (v9.0.0 or higher)
- PostgreSQL (v14 or higher, optional during initialization phase)

### Installation

Navigate to the `server/` directory and install project dependencies:

```bash
cd server
npm install
```

### Environment Configuration

Copy the example configuration to a local `.env` file:

```bash
cp .env.example .env
```

Update `.env` with your local PostgreSQL credentials and Cloudinary / Notification service keys when available.

---

## 4. Running the Application

### Development Mode (with hot-reload via nodemon)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

### Running Automated Tests (Node.js built-in test runner)
```bash
npm test
```

---

## 5. Foundational Integrations & Placeholders

1. **PostgreSQL Database (`src/database/connection.js`)**:
   - Uses `pg.Pool` with connection pooling, idle timeouts, and automatic error handling.
   - Provides a non-blocking health check `checkDatabaseConnection()`. If PostgreSQL is not running locally, the server gracefully boots in fallback mode using the local `hotels.json` seed dataset.
   - Migration scripts will be created in `src/database/migrations/` once the final database schema is approved by the evaluator.

2. **Cloudinary Integration (`src/integrations/cloudinary/cloudinary.service.js`)**:
   - Reusable helper for hotel and room image uploads.
   - Database stores only image URLs and Cloudinary public IDs (no image binaries in PostgreSQL).

3. **External OTP & Notification Microservice (`src/integrations/notification/notification.client.js`)**:
   - Dedicated HTTP client adapter using `axios`.
   - Methods (`requestEmailOtp`, `verifyEmailOtp`, `resendOtp`, `sendBookingConfirmation`, `sendBookingCancellation`) are structured with clear placeholder logic awaiting the external microservice's API specifications.

---

## 6. Scope Boundaries

This backend is strictly tailored to a customer-facing hotel booking assignment:
- **No Admin Panel / Admin Auth**: Catalogue data is seeded via database scripts.
- **No Online Payment Gateway**: Pricing is authoritative and calculated server-side; payment processing is explicitly excluded.
- **Single Room per Booking**: Focuses on core transactional correctness and concurrency safety.
