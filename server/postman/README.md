# Postman API Collections & Testing Guide

This directory provides Postman collections and instructions for validating the Hotel Booking Portal backend APIs.

## Collections in this Directory

1. **`Customer_Authentication.postman_collection.json`**: Complete authentication suite (Email OTP registration/login, Password login, Forgot Password, Reset Password, `/me`, Logout, CSRF enforcement, and session revocation verification).
2. **`Hotel_Catalogue.postman_collection.json`**: Complete hotel catalogue management suite (Hotels listing with pagination, city/location filters, sorting by price/name, hotel details by UUID/slug, room categories, locations with active hotel counts, and amenities).

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
