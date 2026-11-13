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
import { signCustomerToken } from '../../src/utils/jwt.js';

describe('Booking Creation & Guest Checkout API Integration Tests (Phase 4)', () => {
  let server;
  let baseUrl;
  let sampleRoomTypeId;
  let sampleNightlyRate;

  before(async () => {
    // Isolate test execution to in-memory repositories for fast, deterministic testing
    hotelRepository.setForceInMemory(true);
    locationRepository.setForceInMemory(true);
    roomRepository.setForceInMemory(true);
    amenityRepository.setForceInMemory(true);
    bookingRepository.setForceInMemory(true);
    authRepository.setForceInMemory(true);

    await new Promise((resolve) => {
      server = http.createServer(app).listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    // Obtain a valid room category from catalogue
    const hotelsRes = await fetch(`${baseUrl}/api/hotels`);
    const hotelsJson = await hotelsRes.json();
    const firstHotel = hotelsJson.data[0];
    const room = firstHotel.roomCategories[0];
    sampleRoomTypeId = room.id;
    sampleNightlyRate = Number(room.pricePerNight || room.price_per_night);
  });

  after(async () => {
    hotelRepository.setForceInMemory(false);
    locationRepository.setForceInMemory(false);
    roomRepository.setForceInMemory(false);
    amenityRepository.setForceInMemory(false);
    bookingRepository.setForceInMemory(false);
    authRepository.setForceInMemory(false);

    await new Promise((resolve) => server.close(resolve));
  });

  afterEach(() => {
    // Clean up in-memory booking and inventory state between tests
    bookingRepository.reset();
    roomRepository.resetInventory();
  });

  const validCheckIn = '2026-12-01';
  const validCheckOut = '2026-12-04'; // 3 nights

  // ==========================================
  // 1. GUEST BOOKING CREATION
  // ==========================================

  it('1. POST /api/bookings creates valid guest booking with server-side pricing and booking reference', async () => {
    const payload = {
      roomTypeId: sampleRoomTypeId,
      checkIn: validCheckIn,
      checkOut: validCheckOut,
      rooms: 1,
      guest: {
        name: 'Jane Doe',
        email: 'jane.guest@example.com',
        phone: '+919876543210',
      },
    };

    const res = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data);

    // Verify booking reference format HBP-XXXXXXXX
    assert.match(json.data.bookingReference, /^HBP-[A-Z0-9]{8}$/);
    assert.equal(json.data.status, 'CONFIRMED');
    assert.equal(json.data.nights, 3);
    assert.equal(json.data.roomsCount, 1);
    assert.equal(json.data.isRegisteredCustomer, false);

    // Verify server-side decimal pricing: total = 3 nights * nightlyRate * 1 room
    assert.equal(json.data.nightlyPriceSnapshot, sampleNightlyRate);
    assert.equal(json.data.totalAmount, Math.round(sampleNightlyRate * 3 * 100) / 100);

    // Verify guest info
    assert.equal(json.data.guest.fullName, 'Jane Doe');
    assert.equal(json.data.guest.email, 'jane.guest@example.com');
  });

  it('2. POST /api/v1/bookings works identically for backward compatibility', async () => {
    const payload = {
      roomTypeId: sampleRoomTypeId,
      checkIn: validCheckIn,
      checkOut: validCheckOut,
      rooms: 1,
      guest: {
        fullName: 'Bob Smith',
        email: 'bob.guest@example.com',
      },
    };

    const res = await fetch(`${baseUrl}/api/v1/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.match(json.data.bookingReference, /^HBP-[A-Z0-9]{8}$/);
  });

  // ==========================================
  // 2. REGISTERED CUSTOMER BOOKING
  // ==========================================

  it('3. POST /api/bookings associates customer_id from authenticated session (never from body)', async () => {
    // Create an authenticated customer
    const customer = await authRepository.createCustomer({
      email: 'registered.user@example.com',
      fullName: 'Registered VIP',
    });
    const session = await authRepository.createSession({
      customerId: customer.id,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });

    const token = signCustomerToken({
      customerId: customer.id,
      sessionId: session.id,
    });

    const payload = {
      roomTypeId: sampleRoomTypeId,
      checkIn: validCheckIn,
      checkOut: validCheckOut,
      rooms: 1,
      guest: {
        name: 'Registered VIP',
        email: 'registered.user@example.com',
      },
    };

    const res = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `auth_token=${token}`,
      },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.isRegisteredCustomer, true);

    // Verify stored booking in repository is associated with customer.id
    const stored = await bookingRepository.findByReference(json.data.bookingReference);
    assert.equal(stored.customerId, customer.id);
  });

  // ==========================================
  // 3. SECURITY: PREVENT CUSTOMER ID INJECTION
  // ==========================================

  it('4. POST /api/bookings rejects explicit customerId in request body with 400 VALIDATION_ERROR', async () => {
    const payload = {
      roomTypeId: sampleRoomTypeId,
      checkIn: validCheckIn,
      checkOut: validCheckOut,
      customerId: '00000000-0000-0000-0000-000000000000',
      guest: {
        name: 'Attacker',
        email: 'attacker@example.com',
      },
    };

    const res = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'VALIDATION_ERROR');
    assert.ok(
      json.error.details?.some((d) => d.field === 'customerId') ||
        /customerId/i.test(json.error.message)
    );
  });

  // ==========================================
  // 4. VALIDATION: INVALID ROOM, DATES, CAPACITY
  // ==========================================

  it('5. POST /api/bookings returns 404 for non-existent roomTypeId', async () => {
    const payload = {
      roomTypeId: '00000000-0000-0000-0000-000000000000',
      checkIn: validCheckIn,
      checkOut: validCheckOut,
      rooms: 1,
      guest: { name: 'Test User', email: 'test@example.com' },
    };

    const res = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 404);
    const json = await res.json();
    assert.equal(json.error.code, 'ROOM_NOT_FOUND');
  });

  it('6. POST /api/bookings rejects check-out equal to check-in (0 nights) with 400 INVALID_DATE_RANGE', async () => {
    const payload = {
      roomTypeId: sampleRoomTypeId,
      checkIn: '2026-12-01',
      checkOut: '2026-12-01',
      guest: { name: 'Test User', email: 'test@example.com' },
    };

    const res = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.error.code, 'INVALID_DATE_RANGE');
  });

  it('7. POST /api/bookings rejects past check-in dates with 400 PAST_CHECK_IN_DATE', async () => {
    const payload = {
      roomTypeId: sampleRoomTypeId,
      checkIn: '2020-01-01',
      checkOut: '2020-01-05',
      guest: { name: 'Test User', email: 'test@example.com' },
    };

    const res = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.error.code, 'PAST_CHECK_IN_DATE');
  });

  it('8. POST /api/bookings rejects stay exceeding 30 nights with 400 STAY_DURATION_EXCEEDED', async () => {
    const payload = {
      roomTypeId: sampleRoomTypeId,
      checkIn: '2026-12-01',
      checkOut: '2027-01-10', // 40 nights
      guest: { name: 'Test User', email: 'test@example.com' },
    };

    const res = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.error.code, 'STAY_DURATION_EXCEEDED');
  });

  // ==========================================
  // 5. MULTI-ROOM & MULTI-NIGHT PRICING
  // ==========================================

  it('9. Multi-room booking (rooms: 3, nights: 2) calculates total exactly as nights * rate * rooms', async () => {
    const payload = {
      roomTypeId: sampleRoomTypeId,
      checkIn: '2026-12-10',
      checkOut: '2026-12-12', // 2 nights
      rooms: 3,
      guest: { name: 'Corporate Group', email: 'corp@example.com' },
    };

    const res = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.data.nights, 2);
    assert.equal(json.data.roomsCount, 3);

    const expectedTotal = Math.round(2 * sampleNightlyRate * 3 * 100) / 100;
    assert.equal(json.data.totalAmount, expectedTotal);
  });

  // ==========================================
  // 6. INVENTORY DECREMENT & CHECKOUT EXCLUSION
  // ==========================================

  it('10. Inventory is decremented for stay dates, but checkout date is NOT decremented', async () => {
    // Set known baseline: 10 rooms available on Dec 1, Dec 2, Dec 3
    roomRepository.setInventory(sampleRoomTypeId, '2026-12-01', 10);
    roomRepository.setInventory(sampleRoomTypeId, '2026-12-02', 10);
    roomRepository.setInventory(sampleRoomTypeId, '2026-12-03', 10); // Checkout date for Dec 1 - Dec 3

    const payload = {
      roomTypeId: sampleRoomTypeId,
      checkIn: '2026-12-01',
      checkOut: '2026-12-03', // 2 nights: Dec 1 & Dec 2
      rooms: 2,
      guest: { name: 'Alice Traveler', email: 'alice@example.com' },
    };

    const res = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 201);

    // Verify inventory on Dec 1 was reduced to 8
    const availDec1 = roomRepository.getAvailableRoomsForDate(sampleRoomTypeId, '2026-12-01');
    assert.equal(availDec1, 8);

    // Verify inventory on Dec 2 was reduced to 8
    const availDec2 = roomRepository.getAvailableRoomsForDate(sampleRoomTypeId, '2026-12-02');
    assert.equal(availDec2, 8);

    // Verify checkout date (Dec 3) was NOT decremented (still 10)
    const availDec3 = roomRepository.getAvailableRoomsForDate(sampleRoomTypeId, '2026-12-03');
    assert.equal(availDec3, 10);
  });

  // ==========================================
  // 7. INSUFFICIENT & MISSING INVENTORY (ROLLBACK)
  // ==========================================

  it('11. Insufficient availability on any stay night fails with 409 and rolls back inventory', async () => {
    // Night 1 has 5 rooms, Night 2 has only 1 room
    roomRepository.setInventory(sampleRoomTypeId, '2026-12-01', 5);
    roomRepository.setInventory(sampleRoomTypeId, '2026-12-02', 1);

    const payload = {
      roomTypeId: sampleRoomTypeId,
      checkIn: '2026-12-01',
      checkOut: '2026-12-03', // 2 nights
      rooms: 2, // 2 requested -> night 2 is insufficient!
      guest: { name: 'Failed Booker', email: 'failed@example.com' },
    };

    const res = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 409);
    const json = await res.json();
    assert.equal(json.error.code, 'ROOM_UNAVAILABLE');

    // Invariant: Night 1 must NOT have been decremented (rollback guaranteed)
    assert.equal(roomRepository.getAvailableRoomsForDate(sampleRoomTypeId, '2026-12-01'), 5);
    assert.equal(roomRepository.getAvailableRoomsForDate(sampleRoomTypeId, '2026-12-02'), 1);
  });

  it('12. Missing inventory record on any stay night fails with 400 and rolls back', async () => {
    roomRepository.setInventory(sampleRoomTypeId, '2026-12-01', 5);
    roomRepository.deleteInventory(sampleRoomTypeId, '2026-12-02'); // Missing

    const payload = {
      roomTypeId: sampleRoomTypeId,
      checkIn: '2026-12-01',
      checkOut: '2026-12-03',
      rooms: 1,
      guest: { name: 'Missing Inv User', email: 'missing@example.com' },
    };

    const res = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.error.code, 'MISSING_INVENTORY');

    // Invariant: Night 1 remains 5
    assert.equal(roomRepository.getAvailableRoomsForDate(sampleRoomTypeId, '2026-12-01'), 5);
  });

  // ==========================================
  // 8. IDEMPOTENCY / DUPLICATE BOOKING PREVENTION
  // ==========================================

  it('13. Repeating request with same idempotencyKey returns existing booking without double decrement', async () => {
    roomRepository.setInventory(sampleRoomTypeId, '2026-12-01', 5);
    roomRepository.setInventory(sampleRoomTypeId, '2026-12-02', 5);

    const idempotencyKey = 'unique-key-abc-123';
    const payload = {
      roomTypeId: sampleRoomTypeId,
      checkIn: '2026-12-01',
      checkOut: '2026-12-03',
      rooms: 1,
      idempotencyKey,
      guest: { name: 'Idempotent User', email: 'idemp@example.com' },
    };

    // First attempt -> 201 Created
    const res1 = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(res1.status, 201);
    const json1 = await res1.json();
    const ref1 = json1.data.bookingReference;

    // Inventory should be 4
    assert.equal(roomRepository.getAvailableRoomsForDate(sampleRoomTypeId, '2026-12-01'), 4);

    // Second attempt with same idempotencyKey -> 200 OK with same booking
    const res2 = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(res2.status, 200);
    const json2 = await res2.json();
    assert.equal(json2.data.bookingReference, ref1);
    assert.equal(json2.data.isExisting, true);

    // Invariant: Inventory was NOT decremented again (still 4)
    assert.equal(roomRepository.getAvailableRoomsForDate(sampleRoomTypeId, '2026-12-01'), 4);
  });

  // ==========================================
  // 9. CONCURRENCY: PREVENT OVERBOOKING
  // ==========================================

  it('14. Concurrent booking attempts against the last available room: exactly 1 succeeds, no negative inventory', async () => {
    // Exactly 1 room available on stay night
    roomRepository.setInventory(sampleRoomTypeId, '2026-12-01', 1);
    roomRepository.setInventory(sampleRoomTypeId, '2026-12-02', 1);

    // Launch 4 concurrent booking attempts for 1 room
    const attempts = [1, 2, 3, 4].map((i) =>
      fetch(`${baseUrl}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomTypeId: sampleRoomTypeId,
          checkIn: '2026-12-01',
          checkOut: '2026-12-02',
          rooms: 1,
          guest: {
            name: `Competitor ${i}`,
            email: `competitor${i}@example.com`,
          },
        }),
      }).then(async (res) => ({ status: res.status, json: await res.json() }))
    );

    const results = await Promise.all(attempts);

    const successful = results.filter((r) => r.status === 201);
    const rejected = results.filter((r) => r.status === 409);

    assert.equal(successful.length, 1, 'Only one concurrent booking should succeed');
    assert.equal(rejected.length, 3, 'All other competing requests must be rejected with 409');

    // Invariant: inventory must reach exactly 0, NEVER negative
    const finalAvail = roomRepository.getAvailableRoomsForDate(sampleRoomTypeId, '2026-12-01');
    assert.equal(finalAvail, 0, 'Inventory must be exactly 0 after last room booked');
  });

  // ==========================================
  // 10. BOOKING LOOKUP
  // ==========================================

  it('15. POST /api/bookings/lookup returns booking details when reference and email match', async () => {
    const createRes = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomTypeId: sampleRoomTypeId,
        checkIn: validCheckIn,
        checkOut: validCheckOut,
        rooms: 1,
        guest: { name: 'Lookup Tester', email: 'lookup@example.com' },
      }),
    });
    const createJson = await createRes.json();
    const ref = createJson.data.bookingReference;

    const lookupRes = await fetch(`${baseUrl}/api/bookings/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingReference: ref,
        email: 'lookup@example.com',
      }),
    });

    assert.equal(lookupRes.status, 200);
    const lookupJson = await lookupRes.json();
    assert.equal(lookupJson.data.bookingReference, ref);
    assert.equal(lookupJson.data.status, 'CONFIRMED');
    assert.equal(lookupJson.data.guest.email, 'lookup@example.com');
  });

  it('16. POST /api/bookings/lookup returns 404 if guest email does not match booking reference', async () => {
    const createRes = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomTypeId: sampleRoomTypeId,
        checkIn: validCheckIn,
        checkOut: validCheckOut,
        rooms: 1,
        guest: { name: 'Secret User', email: 'secret@example.com' },
      }),
    });
    const createJson = await createRes.json();
    const ref = createJson.data.bookingReference;

    const lookupRes = await fetch(`${baseUrl}/api/bookings/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingReference: ref,
        email: 'wrong-intruder@example.com',
      }),
    });

    assert.equal(lookupRes.status, 404);
    const lookupJson = await lookupRes.json();
    assert.equal(lookupJson.error.code, 'BOOKING_NOT_FOUND');
  });
});
