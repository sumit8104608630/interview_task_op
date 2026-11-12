# Postman API Collection & Testing Guide

This directory provides testing documentation and requests for validating the Hotel Booking Portal backend APIs using Postman.

## Environment Variables

Configure the following variables in your Postman Environment:

| Variable | Initial Value | Description |
| :--- | :--- | :--- |
| `baseUrl` | `http://localhost:5000` | Server host and port |
| `apiPrefix` | `/api/v1` | Versioned API prefix |
| `hotelId` | `c0a80101-0000-4000-8000-000000000001` | Sample hotel ID |
| `roomTypeId` | `room-001-1` | Sample room category ID |
| `bookingReference` | `HBP-EXAMPLE1` | Booking reference code |

---

## Endpoint Directory

### 1. System Health Check
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/health`
- **Description**: Verifies HTTP server availability, uptime, and PostgreSQL connectivity.

### 2. Hotel Discovery
- **List All Hotels**:
  - `GET {{baseUrl}}{{apiPrefix}}/hotels`
- **Filter Hotels by City**:
  - `GET {{baseUrl}}{{apiPrefix}}/hotels?city=Jaipur&limit=5&page=1`
- **Search by Destination & Stay Interval**:
  - `GET {{baseUrl}}{{apiPrefix}}/hotels/search?destination=Goa&checkIn=2026-11-20&checkOut=2026-11-23&guests=2`
- **Get Hotel Details**:
  - `GET {{baseUrl}}{{apiPrefix}}/hotels/{{hotelId}}`
- **Get Hotel Room Types**:
  - `GET {{baseUrl}}{{apiPrefix}}/hotels/{{hotelId}}/rooms`

### 3. Room Availability & Pricing Quote
- **Check Availability & Quote**:
  - `GET {{baseUrl}}{{apiPrefix}}/room-types/{{roomTypeId}}/availability?checkIn=2026-11-20&checkOut=2026-11-23`

### 4. Booking Operations
- **Create One-Room Booking**:
  - `POST {{baseUrl}}{{apiPrefix}}/bookings`
  - **Headers**: `Content-Type: application/json`
  - **Body (JSON)**:
    ```json
    {
      "roomTypeId": "room-001-1",
      "checkIn": "2026-11-20",
      "checkOut": "2026-11-23",
      "guestName": "Aditya Verma",
      "guestEmail": "aditya.verma@example.com",
      "otpToken": "sample-verified-otp-token"
    }
    ```
- **Lookup Booking**:
  - `POST {{baseUrl}}{{apiPrefix}}/bookings/lookup`
  - **Body (JSON)**:
    ```json
    {
      "bookingReference": "HBP-7K8M9PQ2",
      "email": "aditya.verma@example.com"
    }
    ```
- **Request Cancellation OTP**:
  - `POST {{baseUrl}}{{apiPrefix}}/bookings/{{bookingReference}}/cancellation-otp`
- **Confirm Cancellation**:
  - `POST {{baseUrl}}{{apiPrefix}}/bookings/{{bookingReference}}/cancel`
  - **Body (JSON)**:
    ```json
    {
      "cancellationOtp": "123456",
      "reason": "Change of travel plans"
    }
    ```
