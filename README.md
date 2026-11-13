# Hotel Booking Portal — Full Stack Project

This repository contains the backend implementation for the Hotel Booking Portal assignment.

## Documentation Index
- **[System Architecture & Design (DESIGN.md)](DESIGN.md)**: Full architecture diagrams, database entity-relationship models, concurrency controls, and security model.
- **[Backend Service Documentation (server/README.md)](server/README.md)**: Complete API references, installation, migration guides, seed execution, and test results.
- **[Unified Postman Collection (server/postman/README.md)](server/postman/README.md)**: Master Postman collection covering all 9 modules (`Authentication`, `Locations`, `Hotels`, `Room Types`, `Search`, `Availability`, `Booking`, `Booking History`, `Cancellation`).

## Quick Start (Backend)
```bash
# 1. Navigate to backend server
cd server

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env

# 4. Run automated test suite (125 tests across 12 suites)
npm test

# 5. Start development server
npm run dev
```

## System Requirements
- Node.js v20+
- PostgreSQL v15+ (local database)
