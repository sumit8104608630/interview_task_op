# Postman API Collection & Testing Guide

This directory provides Postman collections and instructions for validating the Hotel Booking Portal backend APIs.

## Collections in this Directory

1. **`Customer_Authentication.postman_collection.json`**: Complete authentication suite (Email OTP registration/login, Password login, Forgot Password, Reset Password, `/me`, Logout, CSRF enforcement, and session revocation verification).

---

## 1. Testing Customer Authentication in Postman

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

---

## 2. Customer Authentication Endpoints

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

---

## 3. General Hotel & Booking Endpoints

| Area | Method | Path | Description |
| :--- | :--- | :--- | :--- |
| System | `GET` | `/api/health` | Service and database connectivity check |
| Hotels | `GET` | `/api/v1/hotels` | List hotels with pagination and city filters |
| Hotels | `GET` | `/api/v1/hotels/:hotelId` | Hotel details and room categories |
| Hotels | `GET` | `/api/v1/hotels/search` | Search by destination and stay dates |
| Rooms | `GET` | `/api/v1/room-types/:id/availability` | Check date-range availability & quote |
| Bookings | `POST` | `/api/v1/bookings` | Create one-room booking |
| Bookings | `POST` | `/api/v1/bookings/lookup` | Look up booking by reference and email |
| Bookings | `POST` | `/api/v1/bookings/:reference/cancellation-otp` | Request cancellation OTP |
| Bookings | `POST` | `/api/v1/bookings/:reference/cancel` | Confirm cancellation with OTP |
