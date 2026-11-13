import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { app } from '../../src/app.js';
import { hotelRepository } from '../../src/repositories/hotel.repository.js';
import { locationRepository } from '../../src/repositories/location.repository.js';
import { roomRepository } from '../../src/repositories/room.repository.js';
import { amenityRepository } from '../../src/repositories/amenity.repository.js';
import { bookingRepository } from '../../src/repositories/booking.repository.js';
import { authRepository } from '../../src/modules/auth/auth.repository.js';
import { otpClient } from '../../src/integrations/otp/otpClient.js';
import { signCustomerToken } from '../../src/utils/jwt.js';

describe('Booking Retrieval & Secure Cancellation API Integration Tests (Phase 5)', () => {
  let server;
  let baseUrl;
  let sampleRoomTypeId;

  before(async () => {
    // Isolate test execution to in-memory repositories
    hotelRepository.setForceInMemory(true);
    locationRepository.setForceInMemory(true);
    roomRepository.setForceInMemory(true);
    amenityRepository.setForceInMemory(true);
    bookingRepository.setForceInMemory(true);
    authRepository.setForceInMemory(true);

    otpClient.setMockHandler({
      sendOtp: async () => ({ success: true, message: 'OTP dispatched.' }),
      verifyOtp: async ({ otp }) => {
        if (otp === '123456') return { valid: true };
        return { valid: false, error: 'Invalid verification code.' };
      },
    });

    await new Promise((resolve) => {
      server = http.createServer(app).listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    const hotelsRes = await fetch(`${baseUrl}/api/hotels`);
    const hotelsJson = await hotelsRes.json();
    sampleRoomTypeId = hotelsJson.data[0].roomCategories[0].id;
  });

  after(async () => {
    hotelRepository.setForceInMemory(false);
    locationRepository.setForceInMemory(false);
    roomRepository.setForceInMemory(false);
    amenityRepository.setForceInMemory(false);
    bookingRepository.setForceInMemory(false);
    authRepository.setForceInMemory(false);
    otpClient.clearMockHandler();

    await new Promise((resolve) => server.close(resolve));
  });

  afterEach(() => {
    bookingRepository.reset();
    roomRepository.resetInventory();
  });

  const futureCheckIn = '2026-12-15';
  const futureCheckOut = '2026-12-18'; // 3 nights

  // Helper to create a confirmed booking
  async function createTestBooking({ email = 'guest@example.com', name = 'Guest Test', rooms = 1, customerId = null } = {}) {
    return bookingRepository.createBookingAtomic({
      roomTypeId: sampleRoomTypeId,
      checkIn: futureCheckIn,
      checkOut: futureCheckOut,
      roomsCount: rooms,
      guestName: name,
      guestEmail: email,
      customerId,
    });
  }

  // ==========================================
  // 1. BOOKING LOOKUP
  // ==========================================

  it('1. POST /api/bookings/lookup returns booking details when reference and email match', async () => {
    const booking = await createTestBooking({ email: 'john.lookup@example.com', name: 'John Lookup' });

    const res = await fetch(`${baseUrl}/api/bookings/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingReference: booking.bookingReference,
        email: 'john.lookup@example.com',
      }),
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.bookingReference, booking.bookingReference);
    assert.equal(json.data.status, 'CONFIRMED');
    assert.equal(json.data.nights, 3);
    assert.ok(json.data.hotelName);
    assert.ok(json.data.roomName);
    assert.equal(json.data.guest.fullName, 'John Lookup');
    assert.equal(json.data.guest.email, 'john.lookup@example.com');
  });

  it('2. POST /api/bookings/lookup returns 404 if email does not match booking reference (no leak)', async () => {
    const booking = await createTestBooking({ email: 'correct@example.com' });

    const res = await fetch(`${baseUrl}/api/bookings/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingReference: booking.bookingReference,
        email: 'wrong@example.com',
      }),
    });

    assert.equal(res.status, 404);
    const json = await res.json();
    assert.equal(json.error.code, 'BOOKING_NOT_FOUND');
  });

  it('3. POST /api/bookings/lookup returns 404 if reference is unknown', async () => {
    const res = await fetch(`${baseUrl}/api/bookings/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingReference: 'HBP-UNKNOWN99',
        email: 'anyone@example.com',
      }),
    });

    assert.equal(res.status, 404);
    const json = await res.json();
    assert.equal(json.error.code, 'BOOKING_NOT_FOUND');
  });

  // ==========================================
  // 2. CUSTOMER BOOKING HISTORY
  // ==========================================

  it('4. GET /api/bookings/my-bookings returns only the authenticated customer\'s bookings', async () => {
    // Customer 1
    const customer1 = await authRepository.createCustomer({ email: 'user1@example.com', fullName: 'User One' });
    const session1 = await authRepository.createSession({ customerId: customer1.id, expiresAt: new Date(Date.now() + 3600000).toISOString() });
    const token1 = signCustomerToken({ customerId: customer1.id, sessionId: session1.id });

    // Customer 2
    const customer2 = await authRepository.createCustomer({ email: 'user2@example.com', fullName: 'User Two' });

    // Create bookings for both customers
    const b1 = await createTestBooking({ email: 'user1@example.com', customerId: customer1.id });
    const b2 = await createTestBooking({ email: 'user1@example.com', customerId: customer1.id });
    const bOther = await createTestBooking({ email: 'user2@example.com', customerId: customer2.id });

    const res = await fetch(`${baseUrl}/api/bookings/my-bookings`, {
      headers: { Cookie: `auth_token=${token1}` },
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.length, 2);
    assert.equal(json.meta.total, 2);

    const refs = json.data.map((b) => b.bookingReference);
    assert.ok(refs.includes(b1.bookingReference));
    assert.ok(refs.includes(b2.bookingReference));
    assert.ok(!refs.includes(bOther.bookingReference), 'Should never leak other customer bookings');
  });

  it('5. GET /api/bookings/my-bookings rejects unauthenticated request with 401 UNAUTHORIZED', async () => {
    const res = await fetch(`${baseUrl}/api/bookings/my-bookings`);
    assert.equal(res.status, 401);
  });

  it('6. GET /api/bookings/my-bookings rejects customerId supplied in query with 400 VALIDATION_ERROR', async () => {
    const customer = await authRepository.createCustomer({ email: 'safe@example.com', fullName: 'Safe User' });
    const session = await authRepository.createSession({ customerId: customer.id, expiresAt: new Date(Date.now() + 3600000).toISOString() });
    const token = signCustomerToken({ customerId: customer.id, sessionId: session.id });

    const res = await fetch(`${baseUrl}/api/bookings/my-bookings?customerId=00000000-0000-0000-0000-000000000000`, {
      headers: { Cookie: `auth_token=${token}` },
    });

    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.error.code, 'VALIDATION_ERROR');
  });

  // ==========================================
  // 3. SECURE CANCELLATION FLOW & INVENTORY RESTORATION
  // ==========================================

  it('7. Complete cancellation flow: send OTP -> verify OTP -> confirm cancel restores inventory atomically', async () => {
    // Known inventory: 10 rooms available
    roomRepository.setInventory(sampleRoomTypeId, futureCheckIn, 10);
    roomRepository.setInventory(sampleRoomTypeId, '2026-12-16', 10);
    roomRepository.setInventory(sampleRoomTypeId, '2026-12-17', 10);

    // Book 2 rooms -> inventory becomes 8
    const booking = await createTestBooking({ email: 'canceller@example.com', rooms: 2 });
    assert.equal(roomRepository.getAvailableRoomsForDate(sampleRoomTypeId, futureCheckIn), 8);

    // Step 1: Send cancellation OTP
    const sendRes = await fetch(`${baseUrl}/api/bookings/cancellation/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingReference: booking.bookingReference,
        email: 'canceller@example.com',
      }),
    });
    assert.equal(sendRes.status, 200);

    // Step 2: Verify OTP and get cancellation proof
    const verifyRes = await fetch(`${baseUrl}/api/bookings/cancellation/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingReference: booking.bookingReference,
        email: 'canceller@example.com',
        otp: '123456', // Valid in mock/microservice adapter
      }),
    });
    assert.equal(verifyRes.status, 200);
    const verifyJson = await verifyRes.json();
    const { cancellationProof } = verifyJson.data;
    assert.ok(cancellationProof);

    // Step 3: Confirm cancellation with single-use proof
    const cancelRes = await fetch(`${baseUrl}/api/bookings/cancellation/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingReference: booking.bookingReference,
        email: 'canceller@example.com',
        cancellationProof,
        reason: 'Change of plans',
      }),
    });
    assert.equal(cancelRes.status, 200);
    const cancelJson = await cancelRes.json();
    assert.equal(cancelJson.data.status, 'CANCELLED');
    assert.ok(cancelJson.data.cancelledAt);

    // Invariant: Inventory for stay dates restored back to 10
    assert.equal(roomRepository.getAvailableRoomsForDate(sampleRoomTypeId, futureCheckIn), 10);
    assert.equal(roomRepository.getAvailableRoomsForDate(sampleRoomTypeId, '2026-12-16'), 10);
  });

  // ==========================================
  // 4. BOOKING-SCOPED PROOF SECURITY INVARIANTS
  // ==========================================

  it('8. Single-use proof: Reusing an already consumed cancellation proof fails with 400', async () => {
    const booking = await createTestBooking({ email: 'singleuse@example.com' });

    // Verify OTP to get proof
    const verifyRes = await fetch(`${baseUrl}/api/bookings/cancellation/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingReference: booking.bookingReference,
        email: 'singleuse@example.com',
        otp: '123456',
      }),
    });
    const { cancellationProof } = (await verifyRes.json()).data;

    // First cancellation -> 200 OK
    const cancel1 = await fetch(`${baseUrl}/api/bookings/cancellation/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingReference: booking.bookingReference,
        email: 'singleuse@example.com',
        cancellationProof,
      }),
    });
    assert.equal(cancel1.status, 200);

    // Replay with identical proof -> 400 (Already consumed or already cancelled)
    const cancel2 = await fetch(`${baseUrl}/api/bookings/cancellation/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingReference: booking.bookingReference,
        email: 'singleuse@example.com',
        cancellationProof,
      }),
    });
    assert.equal(cancel2.status, 400);
  });

  it('9. Booking isolation: Proof generated for Booking A cannot cancel Booking B', async () => {
    const bookingA = await createTestBooking({ email: 'userA@example.com' });
    const bookingB = await createTestBooking({ email: 'userB@example.com' });

    // Generate proof for Booking A
    const verifyRes = await fetch(`${baseUrl}/api/bookings/cancellation/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingReference: bookingA.bookingReference,
        email: 'userA@example.com',
        otp: '123456',
      }),
    });
    const { cancellationProof } = (await verifyRes.json()).data;

    // Attempt to use Proof A to cancel Booking B
    const cancelB = await fetch(`${baseUrl}/api/bookings/cancellation/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingReference: bookingB.bookingReference,
        email: 'userB@example.com',
        cancellationProof,
      }),
    });

    assert.equal(cancelB.status, 400);
    const json = await cancelB.json();
    assert.equal(json.error.code, 'INVALID_CANCELLATION_PROOF');

    // Invariant: Booking B must remain CONFIRMED
    const checkB = await bookingRepository.findByReference(bookingB.bookingReference);
    assert.equal(checkB.status, 'CONFIRMED');
  });

  it('10. Expired proof: Proof older than expiration is rejected with 400 EXPIRED_CANCELLATION_PROOF', async () => {
    const booking = await createTestBooking({ email: 'expired@example.com' });

    // Manually create an expired session proof
    const session = await bookingRepository.createGuestSession({
      bookingId: booking.id,
      email: 'expired@example.com',
      purpose: 'CANCELLATION',
      expiresInMinutes: -1, // Expired 1 minute ago
    });

    const cancelRes = await fetch(`${baseUrl}/api/bookings/cancellation/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingReference: booking.bookingReference,
        email: 'expired@example.com',
        cancellationProof: session.token,
      }),
    });

    assert.equal(cancelRes.status, 400);
    const json = await cancelRes.json();
    assert.equal(json.error.code, 'EXPIRED_CANCELLATION_PROOF');
  });

  // ==========================================
  // 5. CANCELLATION DEADLINE CUTOFF
  // ==========================================

  it('11. Cancellation cutoff: Bookings where check-in has already commenced cannot be cancelled', async () => {
    // Create booking starting today or in past (e.g. 2026-11-13)
    const todayBooking = await bookingRepository.createBookingAtomic({
      roomTypeId: sampleRoomTypeId,
      checkIn: '2026-11-13',
      checkOut: '2026-11-16',
      guestName: 'Late Canceller',
      guestEmail: 'late@example.com',
    });

    // Attempt to request OTP for past/today check-in
    const otpRes = await fetch(`${baseUrl}/api/bookings/cancellation/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingReference: todayBooking.bookingReference,
        email: 'late@example.com',
      }),
    });

    assert.equal(otpRes.status, 400);
    const json = await otpRes.json();
    assert.equal(json.error.code, 'CANCELLATION_DEADLINE_PASSED');
  });

  // ==========================================
  // 6. CONCURRENT CANCELLATIONS
  // ==========================================

  it('12. Concurrent cancellations against the same booking: exactly 1 succeeds and inventory restored once', async () => {
    roomRepository.setInventory(sampleRoomTypeId, futureCheckIn, 10);
    const booking = await createTestBooking({ email: 'concurrent@example.com', rooms: 2 });
    assert.equal(roomRepository.getAvailableRoomsForDate(sampleRoomTypeId, futureCheckIn), 8);

    // Obtain 2 separate valid proofs
    const p1 = (
      await (
        await fetch(`${baseUrl}/api/bookings/cancellation/verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingReference: booking.bookingReference,
            email: 'concurrent@example.com',
            otp: '123456',
          }),
        })
      ).json()
    ).data.cancellationProof;

    const p2 = (
      await (
        await fetch(`${baseUrl}/api/bookings/cancellation/verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingReference: booking.bookingReference,
            email: 'concurrent@example.com',
            otp: '123456',
          }),
        })
      ).json()
    ).data.cancellationProof;

    // Fire both cancellation requests simultaneously
    const [res1, res2] = await Promise.all([
      fetch(`${baseUrl}/api/bookings/cancellation/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingReference: booking.bookingReference,
          email: 'concurrent@example.com',
          cancellationProof: p1,
        }),
      }),
      fetch(`${baseUrl}/api/bookings/cancellation/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingReference: booking.bookingReference,
          email: 'concurrent@example.com',
          cancellationProof: p2,
        }),
      }),
    ]);

    const statuses = [res1.status, res2.status];
    assert.ok(statuses.includes(200), 'One request must succeed with 200');
    assert.ok(statuses.includes(400), 'Second competing request must fail with 400 BOOKING_ALREADY_CANCELLED');

    // Invariant: Inventory was restored from 8 to 10 (never 12!)
    assert.equal(roomRepository.getAvailableRoomsForDate(sampleRoomTypeId, futureCheckIn), 10);
  });
});
