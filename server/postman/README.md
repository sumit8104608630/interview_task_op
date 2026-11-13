# Postman API Collections & Testing Guide

This directory provides Postman collections and instructions for validating the Hotel Booking Portal backend APIs.

## Collections in this Directory

1. **`Customer_Authentication.postman_collection.json`**: Complete authentication suite (Email OTP registration/login, Password login, Forgot Password, Reset Password, `/me`, Logout, CSRF enforcement, and session revocation verification).
2. **`Hotel_Catalogue.postman_collection.json`**: Complete hotel catalogue management suite (Hotels listing with pagination, city/location filters, sorting by price/name, hotel details by UUID/slug, room categories, locations with active hotel counts, and amenities).
3. **`Hotel_Search_Availability.postman_collection.json`**: Date-wise hotel search and room inventory availability suite (Date range validation, checkout-exclusive inventory, multi-room requests, guest capacity, price/amenities filters, sorting, pagination, and room availability breakdowns).
4. **`Booking_Creation.postman_collection.json`**: Booking creation and guest checkout suite (Atomic multi-room booking, registered vs guest checkout, server-side decimal pricing, idempotency key deduplication, and booking reference lookup).
5. **`Booking_Cancellation.postman_collection.json`**: Booking retrieval and secure cancellation suite (Guest lookup, enumeration protection, customer booking history, cancellation OTP verification, single-use scoped proof, and atomic inventory restoration).

---

## 1. Testing Booking Retrieval & Cancellation in Postman (Phase 5)

Import `Booking_Cancellation.postman_collection.json` into Postman. Pre-configured variables: `baseUrl`, `bookingReference`, `guestEmail`, `cancellationProof`.

### Retrieval & Cancellation Endpoints

| Step | Request Name | Method | Path | Expected Status |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Booking Lookup | `POST` | `/api/bookings/lookup` | `200 OK` (Matches reference and guest email, returns hotel, room, and status) |
| 2 | Booking Lookup (Email Mismatch) | `POST` | `/api/bookings/lookup` | `404 Not Found` (`BOOKING_NOT_FOUND` — safe generic error without leaking reference validity) |
| 3 | Authenticated Customer History | `GET` | `/api/bookings/my-bookings?page=1&limit=10&status=CONFIRMED` | `200 OK` (Only authenticated customer's bookings, supports status filter) |
| 4 | Block customerId in Query | `GET` | `/api/bookings/my-bookings?customerId=...` | `400 Bad Request` (`VALIDATION_ERROR` — prevents IDOR/query tampering) |
| 5 | Request Cancellation OTP | `POST` | `/api/bookings/cancellation/send-otp` | `200 OK` (Dispatches OTP to guest email; validates cancellation cutoff deadline) |
| 6 | Verify Cancellation OTP | `POST` | `/api/bookings/cancellation/verify-otp` | `200 OK` (Issues single-use, 15-minute `cancellationProof` scoped to booking) |
| 7 | Confirm Cancellation | `POST` | `/api/bookings/cancellation/cancel` | `200 OK` (Atomically updates status to `CANCELLED`, restores inventory, marks proof consumed) |
| 8 | Duplicate Cancel Attempt | `POST` | `/api/bookings/cancellation/cancel` | `400 Bad Request` (`INVALID_CANCELLATION_PROOF` — proof replay blocked) |

*All endpoints are also accessible via `/api/v1/bookings/...` for complete backward and frontend compatibility.*

---

## 1. Testing Booking Creation & Checkout in Postman (Phase 4)

Import `Booking_Creation.postman_collection.json` into Postman. Pre-configured variables: `baseUrl`, `sampleRoomTypeId`, `checkIn`, `checkOut`.

### Booking Endpoints

| Step | Request Name | Method | Path | Expected Status |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Create Guest Booking | `POST` | `/api/bookings` | `201 Created` (Returns `bookingReference` `HBP-XXXXXXXX`, total amount, and guest details) |
| 2 | Create Multi-Room Booking | `POST` | `/api/bookings` | `201 Created` (`rooms: 3`, reserves 3 rooms each night) |
| 3 | Idempotent Booking Creation | `POST` | `/api/bookings` (`Idempotency-Key` header) | `201 Created` on first try, `200 OK` on replay with no double decrement |
| 4 | Lookup Booking by Reference | `POST` | `/api/bookings/lookup` | `200 OK` (Matches reference and guest email) |
| 5 | Block Customer ID Injection | `POST` | `/api/bookings` (with `customerId` in body) | `400 Bad Request` (`VALIDATION_ERROR`) |
| 6 | Check-out Before Check-in | `POST` | `/api/bookings` (invalid date range) | `400 Bad Request` (`INVALID_DATE_RANGE`) |
| 7 | Lookup Email Mismatch | `POST` | `/api/bookings/lookup` (wrong email) | `404 Not Found` (`BOOKING_NOT_FOUND`) |

*All endpoints are also accessible via `/api/v1/bookings` for complete backward and frontend compatibility.*

---

## 1. Testing Hotel Search & Availability APIs in Postman (Phase 3)

Import `Hotel_Search_Availability.postman_collection.json` into Postman. The collection includes pre-configured collection variables (`baseUrl`, `sampleRoomTypeId`, `checkIn`, `checkOut`).

### Search & Availability Endpoints

| Step | Request Name | Method | Path | Expected Status |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Hotel Search - Basic | `GET` | `/api/hotels/search?city=Mumbai&checkIn=2026-12-01&checkOut=2026-12-04&guests=2&rooms=1` | `200 OK` (Available hotels & rooms) |
| 2 | Hotel Search - Price Range | `GET` | `/api/hotels/search?city=Mumbai&checkIn=2026-12-01&checkOut=2026-12-04&minPrice=3000&maxPrice=7000` | `200 OK` (Nightly rates within range) |
| 3 | Hotel Search - Amenities | `GET` | `/api/hotels/search?city=Mumbai&checkIn=2026-12-01&checkOut=2026-12-04&amenities=WIFI,POOL` | `200 OK` (Must offer WIFI and POOL) |
| 4 | Hotel Search - Lowest Price | `GET` | `/api/hotels/search?checkIn=2026-12-01&checkOut=2026-12-04&sortBy=lowest_price` | `200 OK` (Sorted cheapest first) |
| 5 | Hotel Search - Highest Price | `GET` | `/api/hotels/search?checkIn=2026-12-01&checkOut=2026-12-04&sortBy=highest_price` | `200 OK` (Sorted highest first) |
| 6 | Hotel Search - Pagination | `GET` | `/api/hotels/search?checkIn=2026-12-01&checkOut=2026-12-04&page=2&limit=5` | `200 OK` (Page 2, limit 5) |
| 7 | Room Availability Breakdown | `GET` | `/api/rooms/availability?roomTypeId={{sampleRoomTypeId}}&checkIn=2026-12-01&checkOut=2026-12-04&rooms=1` | `200 OK` (Date-wise breakdown & pricing) |
| 8 | Multi-Room Availability | `GET` | `/api/rooms/availability?roomTypeId={{sampleRoomTypeId}}&checkIn=2026-12-01&checkOut=2026-12-04&rooms=3` | `200 OK` (Verifies >= 3 rooms each night) |
| 9 | Past Date Error Check | `GET` | `/api/hotels/search?city=Mumbai&checkIn=2020-01-01&checkOut=2020-01-05` | `400 Bad Request` (`PAST_CHECK_IN_DATE`) |
| 10 | Invalid Date Range Check | `GET` | `/api/hotels/search?city=Mumbai&checkIn=2026-12-05&checkOut=2026-12-02` | `400 Bad Request` (`INVALID_DATE_RANGE`) |

*All endpoints are also accessible via `/api/v1/...` for complete backward and frontend compatibility.*

---

## 1. Testing Hotel Catalogue APIs in Postman

Import `Hotel_Catalogue.postman_collection.json` into Postman. The collection includes pre-configured collection variables (`baseUrl`, `sampleHotelId`, `sampleLocationId`).

### Catalogue Endpoints

| Step | Request Name | Method | Path | Expected Status |
| :--- | :--- | :--- | :--- | :--- |
| 1 | List All Active Hotels | `GET` | `/api/hotels` | `200 OK` (Returns 100 hotels paginated) |
| 2 | Paginate Hotels | `GET` | `/api/hotels?page=2&limit=10` | `200 OK` (Metadata: total 100, page 2, limit 10) |
| 3 | Filter by City | `GET` | `/api/hotels?city=Mumbai` | `200 OK` (Only Mumbai hotels) |
| 4 | Filter by Location ID | `GET` | `/api/hotels?locationId={{sampleLocationId}}` | `200 OK` (Hotels matching location UUID) |
| 5 | Sort by Price Ascending | `GET` | `/api/hotels?sortBy=price&sortOrder=asc` | `200 OK` (Ordered by starting room rate) |
| 6 | Sort by Price Descending | `GET` | `/api/hotels?sortBy=price&sortOrder=desc` | `200 OK` (Highest to lowest room rate) |
| 7 | Get Hotel Details by UUID | `GET` | `/api/hotels/:id` | `200 OK` (Full details, Unsplash images, amenities, rooms) |
| 8 | Get Hotel Details by Slug | `GET` | `/api/hotels/:slug` | `200 OK` (Matches by human-readable SEO slug) |
| 9 | Get Hotel Room Categories | `GET` | `/api/hotels/:id/rooms` | `200 OK` (Active room types with capacity and price) |
| 10 | List All Locations | `GET` | `/api/locations` | `200 OK` (20 distinct cities with active hotel counts) |
| 11 | Get Single Location | `GET` | `/api/locations/:id` | `200 OK` (Location details by UUID or city) |
| 12 | List All Amenities | `GET` | `/api/amenities` | `200 OK` (15 hotel amenities) |
| 13 | Unknown Hotel 404 Check | `GET` | `/api/hotels/unknown-id` | `404 Not Found` (`HOTEL_NOT_FOUND`) |

*All endpoints are also accessible via `/api/v1/...` for complete backward and frontend compatibility.*

---

## 2. Testing Customer Authentication in Postman

### Cookie Jar Management
Postman has a built-in Cookie Jar that automatically captures and sends `Set-Cookie` headers for matching domains (`localhost` / `127.0.0.1`).
- When `POST /api/auth/verify-otp` or `POST /api/auth/login` succeeds, Postman automatically stores `auth_token` in its cookie jar.
- Subsequent calls to `GET /api/auth/me` will automatically include this cookie.
- When `POST /api/auth/logout` succeeds, the server sends `clearCookie` which clears the cookie from the jar.

### CSRF Protection in Postman
State-changing cookie-authenticated requests (`POST /api/auth/logout`) require a valid `x-csrf-token` header:
1. `POST /api/auth/verify-otp` and `POST /api/auth/login` return `csrfToken` in the response JSON and set a readable `csrf_token` cookie.
2. The collection's Tests script automatically saves this value into the collection variable `{{csrfToken}}`:
   ```javascript
   const json = pm.response.json();
   if (json.data && json.data.csrfToken) {
       pm.collectionVariables.set('csrfToken', json.data.csrfToken);
   }
   ```
3. The `POST /api/auth/logout` request includes the header:
   ```
   x-csrf-token: {{csrfToken}}
   ```

| Step | Request Name | Method | Path | Expected Status |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Send Registration OTP | `POST` | `/api/auth/send-otp` | `200 OK` |
| 2 | Verify Registration OTP (Passwordless) | `POST` | `/api/auth/verify-otp` | `200 OK` (Sets `auth_token` HttpOnly cookie) |
| 3 | Verify Registration OTP with Password | `POST` | `/api/auth/verify-otp` | `200 OK` (Stores bcrypt `password_hash`) |
| 4 | Login with Email and Password | `POST` | `/api/auth/login` | `200 OK` (Sets `auth_token` HttpOnly cookie) |
| 5 | Send Login OTP (Passwordless Login) | `POST` | `/api/auth/send-otp` | `200 OK` |
| 6 | Verify Login OTP | `POST` | `/api/auth/verify-otp` | `200 OK` (Updates session) |
| 7 | Forgot Password (Request Reset Code) | `POST` | `/api/auth/forgot-password` | `200 OK` (Dispatches reset OTP) |
| 8 | Reset Password (Verify OTP + New Pass) | `POST` | `/api/auth/reset-password` | `200 OK` (Revokes all active sessions) |
| 9 | Get Current Customer Profile | `GET` | `/api/auth/me` | `200 OK` (Returns customer data) |
| 10 | Logout Customer | `POST` | `/api/auth/logout` | `200 OK` (Revokes session in DB) |
| 11 | Get Profile After Logout | `GET` | `/api/auth/me` | `401 Unauthorized` (Session revoked) |
