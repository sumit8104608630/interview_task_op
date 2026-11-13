# LuxeStay — Full-Stack Hotel Booking Portal

> **Enterprise-Grade Hotel Reservation System** featuring strict row-level concurrency controls, transactional outbox notification delivery, and an editorial **Modern Luxury Hospitality** design language.

[![Backend Tests](https://img.shields.io/badge/backend%20tests-125%2F125%20passing-38765B.svg)](server/)
[![Frontend Build](https://img.shields.io/badge/frontend-clean%20vite%20build-b08d57.svg)](client/)
[![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-1c1c19.svg)](package.json)
[![Architecture](https://img.shields.io/badge/architecture-ACID%20%7C%20Outbox%20%7C%20Redux-d1c5b6.svg)](DESIGN.md)

---

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Technology Stack](#technology-stack)
3. [Design System & Editorial Aesthetics](#design-system--editorial-aesthetics)
4. [Key System Guarantees & Features](#key-system-guarantees--features)
5. [Project Structure](#project-structure)
6. [Quick Start & Local Development](#quick-start--local-development)
7. [Running the Automated Test Suites](#running-the-automated-test-suites)
8. [API Reference Summary](#api-reference-summary)
9. [Documentation Index](#documentation-index)

---

## System Architecture

```
                                  +---------------------------------------+
                                  |         CLIENT SPA (React + Vite)      |
                                  |  - Redux Toolkit (Session & Drafts)   |
                                  |  - Tailwind CSS (Luxury Palette)      |
                                  |  - Axios Client (CSRF Interceptor)    |
                                  +-------------------+-------------------+
                                                      |
                                        HTTP + Cookie (withCredentials)
                                                      |
                                                      v
                                  +---------------------------------------+
                                  |        EXPRESS REST API BACKEND       |
                                  |  - Rate Limiters & Helmet Security    |
                                  |  - Double-Submit CSRF Protection     |
                                  |  - Zod Request Schema Validation      |
                                  +-------------------+-------------------+
                                                      |
                         +----------------------------+----------------------------+
                         |                                                         |
                         v                                                         v
          +-------------------------------+                         +-------------------------------+
          |  TRANSACTIONAL RESERVATION    |                         |  BACKGROUND OUTBOX WORKER     |
          |  - SELECT ... FOR UPDATE      |                         |  - FOR UPDATE SKIP LOCKED     |
          |  - [checkIn, checkOut) Lock   |                         |  - At-least-once Dispatch     |
          |  - Atomic Inventory Decrement |                         |  - Resilient Retry Backoff    |
          |  - Outbox Event Enqueue       |                         +---------------+---------------+
          +---------------+---------------+                                         |
                          |                                                         v
                          +--------------------> DATABASE <-------------------------+
                                        (PostgreSQL / SQLite)
```

---

## Technology Stack

### Frontend Client (`client/`)
- **Core Framework**: React 18 / 19 + JavaScript (ES6+ modular architecture scaffolded with Vite).
- **Global State Management**: Redux Toolkit (`@reduxjs/toolkit`, `react-redux`) featuring:
  - `authSlice`: Authenticated customer profile, CSRF token state, session bootstrap via `GET /api/auth/me`.
  - `bookingSlice`: Active draft quotes, reservation criteria, and last confirmed reservation reference.
  - `uiSlice`: Toast notification queue, responsive mobile drawer toggle, and global modal state.
- **Styling & Design System**: Tailwind CSS configured with the *Modern Luxury Hospitality* token palette.
- **Iconography**: `lucide-react` and `react-icons` for crisp architectural navigation symbols.
- **Skeleton Loaders**: `react-loading-skeleton` customized in warm ivory and sand tones (`#f6f3ee` / `#fcf9f4`).
- **Spinners**: `react-loader-spinner` (`Oval`, `TailSpin`) rendered in Champagne Gold (`#b08d57`) and Deep Charcoal (`#1c1c19`).
- **HTTP Client**: Centralized Axios client (`withCredentials: true`, automated CSRF token reflection, standardized error unwrapping).
- **Forms & Validation**: `react-hook-form` paired with `@hookform/resolvers/zod` and strict Zod validation schemas.

### Backend Engine (`server/`)
- **Runtime**: Node.js (v20+ LTS recommended).
- **Framework**: Express.js with custom async handlers and enterprise centralized error middleware.
- **Database Layer**: PostgreSQL (primary high-concurrency target) with SQLite (zero-config local development and CI testing fallback).
- **Security & Session**:
  - HttpOnly, SameSite, Secure cookie-backed customer sessions.
  - Double-Submit Cookie CSRF protection.
  - Password encryption via `bcrypt` (12 salt rounds).
  - Anti-enumeration generic responses on lookup and credential recovery.
- **Concurrency**: PostgreSQL `SELECT ... FOR UPDATE` row-level locks on `room_inventory` preventing negative stock.
- **Reliable Messaging**: Transactional Outbox Pattern executed with `FOR UPDATE SKIP LOCKED` polling.

---

## Design System & Editorial Aesthetics

The frontend is crafted strictly to the **Modern Luxury Hospitality** design specification:

| Design Token | Hex Code | Visual Application |
| :--- | :--- | :--- |
| `surface` | `#fcf9f4` | Page background, serene warm ivory canvas |
| `surface-container-lowest` | `#ffffff` | Elevated pure white architectural cards |
| `surface-container-low` | `#f6f3ee` | Muted card header backgrounds, table row accents |
| `on-surface` | `#1c1c19` | Deep charcoal primary typography and high-contrast badges |
| `on-surface-variant` | `#707973` | Architectural warm-grey secondary and tertiary copy |
| `primary-container` | `#b08d57` | Champagne Gold buttons, icons, and focus highlights |
| `outline-variant` | `#e6dfd3` | Delicate 1px hairline dividers and subtle borders |
| `status-success` | `#38765B` | Forest Sage confirmed reservation badges |
| `status-error` | `#ba1a1a` | Terracotta Red cancellation notices and error alerts |

### Geometry & Typography
- **Corner Radii**: Strictly Level 1 soft geometry (`rounded` / `0.25rem` / `4px`). Pill buttons (`rounded-full`) are intentionally avoided to preserve structural architectural dignity.
- **Typography**:
  - Headings: `font-serif` (`Playfair Display`, serif) with elegant letterforms.
  - Body & UI: `font-sans` (`Inter`, sans-serif) with high readability.
  - Uppercase Metadata: Generous letter-spacing (`tracking-luxury` / `tracking-widest`).

---

## Key System Guarantees & Features

### 1. Concurrency & Anti-Overbooking Protection
- **Row-Level Inventory Locks**: During booking creation, every stay date $[checkIn, checkOut)$ is locked using `SELECT ... FOR UPDATE`.
- **Exclusive Stay Interval**: Check-out date is treated as a morning departure date and is **never decremented** from inventory.
- **Capacity Integrity**: The reservation transaction enforces $available\_rooms \ge requested\_rooms$. If any single date fails, the entire transaction is rolled back with HTTP 409 Conflict.
- **Idempotent Requests**: Duplicate submissions carrying the same `Idempotency-Key` return the existing reservation safely without double inventory decrements.

### 2. Transactional Outbox Worker
- When a booking is confirmed or cancelled, the notification event is written to the `notification_outbox` table **within the exact same database transaction** as the booking ledger update.
- A decoupled worker polls pending events using `FOR UPDATE SKIP LOCKED`, preventing race conditions across clustered workers.

### 3. Customer Authentication & Session Security
- **2-Step Registration**: Guest submits name and email $\rightarrow$ receives a 6-digit OTP $\rightarrow$ verifies OTP and sets an 8+ character password in one smooth flow.
- **Session Management**: Authenticated sessions utilize cryptographically secure tokens stored in `HttpOnly; SameSite=Lax; Path=/` cookies.
- **CSRF Defense**: State-changing requests (`POST`, `PUT`, `DELETE`) require both the HttpOnly cookie and a matching `x-csrf-token` header.

### 4. 3-Step In-Memory Cancellation Protocol
- **Step 1 (Warning & Verification)**: Guest views terms and dispatches a 6-digit cancellation OTP with a 60-second cooldown timer.
- **Step 2 (OTP Validation)**: Backend verifies ownership and returns a single-use 15-minute `cancellationProof` token.
- **Zero Token Persistence**: The proof token remains strictly **in memory** inside the React modal component and is never stored in `localStorage`, `sessionStorage`, or query params.
- **Step 3 (Atomic Restoration)**: The proof is consumed once to cancel the booking and immediately restore the room inventory back into the pool.

### 5. Anti-Enumeration Protection
- Booking lookup (`POST /api/bookings/lookup`) and password recovery endpoints return generic responses regardless of whether the email or reference exists, preventing attackers from probing active guest accounts.

---

## Project Structure

```
├── client/                                # React Vite Single Page Application
│   ├── public/                            # Static assets and favicon
│   ├── src/
│   │   ├── api/                           # Centralized Axios client & API endpoints
│   │   │   ├── axiosClient.js             # CSRF token interceptor & base config
│   │   │   ├── authApi.js                 # Customer authentication endpoints
│   │   │   ├── hotelApi.js                # Hotels, search & availability endpoints
│   │   │   └── bookingApi.js              # Booking creation, lookup & cancellation
│   │   ├── components/                    # Architectural UI components
│   │   │   ├── auth/                      # Protected route & auth guards
│   │   │   ├── booking/                   # BookingCard & 3-Step CancellationModal
│   │   │   ├── common/                    # Navbar, Footer, Spinner, ToastContainer
│   │   │   ├── hotel/                     # HotelCard, RoomTypeCard, ImageGallery
│   │   │   └── search/                    # SearchBar ribbon, FilterSidebar
│   │   ├── features/                      # Redux slices and Zod schemas
│   │   │   ├── auth/                      # authSlice.js & authSchemas.js
│   │   │   ├── booking/                   # bookingSlice.js & bookingSchemas.js
│   │   │   └── ui/                        # uiSlice.js (toast notifications)
│   │   ├── pages/                         # Route entrypoint pages
│   │   │   ├── account/                   # AccountPage & MyBookingsPage
│   │   │   ├── auth/                      # LoginPage, RegisterPage, Forgot/Reset
│   │   │   ├── booking/                   # CheckoutPage, Confirmation, Lookup
│   │   │   ├── HomePage.jsx               # Hero, search ribbon & destination showcase
│   │   │   ├── HotelsPage.jsx             # Filterable catalog with pagination
│   │   │   ├── HotelDetailPage.jsx        # Suite catalog & live availability quotes
│   │   │   └── SearchResultsPage.jsx      # Real-time search & availability matrix
│   │   ├── utils/                         # Date math, formatters & amenity icons
│   │   ├── router.jsx                     # React Router 6 configuration
│   │   └── index.css                      # Tailwind base & luxury theme tokens
│   ├── package.json
│   └── vite.config.js                     # Vite build & proxy configuration
│
├── server/                                # Express.js REST API Backend
│   ├── src/
│   │   ├── config/                        # Database & environment configurations
│   │   ├── controllers/                   # Request controllers
│   │   ├── database/                      # SQL migrations, connection pool & seeders
│   │   ├── middleware/                    # CSRF, auth, rate-limiting & error handler
│   │   ├── repositories/                  # Transactional database query repositories
│   │   ├── routes/                        # Versioned API routes
│   │   ├── services/                      # Business logic & concurrency coordination
│   │   ├── validators/                    # Zod validation schemas
│   │   ├── workers/                       # Outbox background worker
│   │   └── app.js                         # Express application assembly
│   ├── tests/                             # 12 test suites (125 tests)
│   └── package.json
│
├── DESIGN.md                              # Complete system design & database schema
├── package.json                           # Root workspace convenience scripts
└── README.md                              # Master project documentation
```

---

## Quick Start & Local Development

### 1. Prerequisites
- **Node.js**: v20.0.0 or higher
- **NPM**: v10.0.0 or higher
- **PostgreSQL** (Optional; SQLite is bundled as a zero-config local fallback)

### 2. Installation
Clone the repository and install dependencies for both services:

```bash
# Clone repository
git clone https://github.com/sumit8104608630/interview_task_op.git
cd interview_task_op

# Install backend dependencies
cd server
npm install
cp .env.example .env

# Install frontend dependencies
cd ../client
npm install
cd ..
```

### 3. Run Backend Server
In a terminal, start the backend engine:

```bash
cd server
# Seed SQLite database with 100 luxury hotels and room inventories
npm run db:seed

# Start development server on http://localhost:5000
npm run dev
```

### 4. Run Frontend Client
In a second terminal, launch the Vite development server:

```bash
cd client
# Start development client on http://localhost:5173
npm run dev
```

Visit **`http://localhost:5173`** in your browser. API requests to `/api/*` are automatically proxied to the backend at `http://localhost:5000`.

---

## Running the Automated Test Suites

The backend comes equipped with comprehensive integration and concurrency test suites covering the entire user journey:

```bash
# Run all 12 backend test suites (125 tests)
npm --prefix server test
```

### Test Suite Summary
```
✔ Customer Authentication API End-to-End Integration Tests (11 tests)
✔ Booking Creation & Guest Checkout API Integration Tests (16 tests)
✔ Booking Retrieval & Secure Cancellation API Integration Tests (12 tests)
✔ Hotel Catalogue & Locations API Integration Tests (10 tests)
✔ Hotel Search and Room Availability API Integration Tests (21 tests)
✔ Outbox Worker & Notification Reliability Tests (11 tests)
✔ High-Concurrency Inventory Lock & Race Condition Tests (10 tests)
✔ Database Migration and Seeder Validation Tests (7 tests)
✔ Customer JWT Security Unit Tests (6 tests)
✔ Customer Authentication Service & Domain Rules (19 tests)
✔ Date Utilities (6 tests)
✔ Booking Reference Generator (2 tests)

Total: 125 tests passing (100% pass, 0 failures)
```

### Frontend Production Build Verification
To verify that the React client compiles and bundles with zero errors:

```bash
npm --prefix client run build
```

---

## API Reference Summary

| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/send-otp` | Send 6-digit email OTP for registration or password recovery | Public |
| `POST` | `/api/auth/verify-otp` | Verify OTP and set password to create customer account | Public |
| `POST` | `/api/auth/login` | Authenticate customer and establish HttpOnly session cookie | Public |
| `GET` | `/api/auth/me` | Retrieve authenticated customer profile | Session Cookie |
| `POST` | `/api/auth/logout` | Revoke session and clear authentication cookies | Session Cookie |
| `GET` | `/api/hotels` | Paginated hotel catalog with sorting and city filters | Public |
| `GET` | `/api/hotels/:id` | Detailed hotel profile with room categories and amenities | Public |
| `GET` | `/api/hotels/search` | Contiguous availability search with stay date verification | Public |
| `GET` | `/api/rooms/availability` | Real-time quote and nightly breakdown for stay dates | Public |
| `POST` | `/api/bookings` | Atomic booking creation with row lock & idempotency check | Public / Member |
| `POST` | `/api/bookings/lookup` | Anti-enumeration booking retrieval via reference & email | Public |
| `GET` | `/api/bookings/my-bookings`| Paginated reservation history for authenticated member | Session Cookie |
| `POST` | `/api/bookings/cancellation/send-otp` | Request email OTP for booking cancellation | Public |
| `POST` | `/api/bookings/cancellation/verify-otp`| Verify OTP and receive single-use `cancellationProof` | Public |
| `POST` | `/api/bookings/cancellation/cancel` | Execute atomic cancellation and restore room inventory | Proof Token |

---

## Documentation Index
- **[System Architecture & Design (DESIGN.md)](DESIGN.md)**: In-depth ER diagrams, schema specifications, and concurrency strategies.
- **[Backend Service Documentation (server/README.md)](server/README.md)**: Detailed environment variable configuration, PostgreSQL production migration guides, and seeder scripts.
- **[Unified Postman Collection (server/postman/README.md)](server/postman/README.md)**: Automated end-to-end Postman collection covering all 9 operational modules.

---

*Engineered with precision for LuxeStay Hospitality Group.*
