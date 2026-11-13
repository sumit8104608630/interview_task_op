import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { app } from '../../src/app.js';
import { hotelRepository } from '../../src/repositories/hotel.repository.js';
import { locationRepository } from '../../src/repositories/location.repository.js';
import { roomRepository } from '../../src/repositories/room.repository.js';
import { amenityRepository } from '../../src/repositories/amenity.repository.js';
import { bookingRepository } from '../../src/repositories/booking.repository.js';
import { authRepository } from '../../src/modules/auth/auth.repository.js';
import { outboxRepository } from '../../src/repositories/outbox.repository.js';
import { otpClient } from '../../src/integrations/otp/otpClient.js';
import { notificationClient } from '../../src/integrations/notification/notification.client.js';

describe('End-to-End User Journeys (Phase 7 Integration)', () => {
  let server;
  let baseUrl;
  let sampleHotel;
  let sampleRoomType;

  before(async () => {
    // Isolate tests using in-memory repositories
    hotelRepository.setForceInMemory(true);
    locationRepository.setForceInMemory(true);
    roomRepository.setForceInMemory(true);
    amenityRepository.setForceInMemory(true);
    bookingRepository.setForceInMemory(true);
    authRepository.setForceInMemory(true);
    outboxRepository.setForceInMemory(true);

    otpClient.setMockHandler({
      sendOtp: async () => ({ success: true, message: 'OTP dispatched.' }),
      verifyOtp: async ({ otp }) => {
        if (otp === '123456') return { valid: true };
        return { valid: false, error: 'Invalid verification code.' };
      },
    });

    notificationClient.setMockHandler({
      sendBookingConfirmation: async () => ({ success: true, messageId: 'msg-conf-e2e' }),
      sendBookingCancellation: async () => ({ success: true, messageId: 'msg-cancel-e2e' }),
      sendEmail: async () => ({ success: true, messageId: 'msg-email-e2e' }),
    });

    await new Promise((resolve) => {
      server = http.createServer(app).listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    const hotels = await hotelRepository.findAll({ limit: 1 });
    sampleHotel = hotels.hotels[0];
    sampleRoomType = sampleHotel.roomCategories[0];
  });

  after(async () => {
    hotelRepository.setForceInMemory(false);
    locationRepository.setForceInMemory(false);
    roomRepository.setForceInMemory(false);
    amenityRepository.setForceInMemory(false);
    bookingRepository.setForceInMemory(false);
    authRepository.setForceInMemory(false);
    outboxRepository.setForceInMemory(false);
    otpClient.clearMockHandler();
    notificationClient.clearMockHandler();

    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    bookingRepository.reset();
    outboxRepository.reset();
    roomRepository.resetInventory();
  });

  it('Complete Registered Customer Journey: Register -> Login -> Browse -> Check Availability -> Book -> History -> Cancel -> Inventory Restored -> Logout', async () => {
    const customerEmail = 'reguser@example.com';
    const customerName = 'Registered User';
    const checkIn = '2026-12-10';
    const checkOut = '2026-12-13'; // 3 nights
    let cookieJar = '';
    let csrfToken = '';

    // 1. Request OTP for registration
    const sendOtpRes = await fetch(`${baseUrl}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: customerEmail, fullName: customerName }),
    });
    assert.strictEqual(sendOtpRes.status, 200);

    // 2. Verify OTP -> receives session cookie
    const verifyOtpRes = await fetch(`${baseUrl}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: customerEmail, fullName: customerName, otp: '123456' }),
    });
    assert.strictEqual(verifyOtpRes.status, 200);

    const rawCookies = verifyOtpRes.headers.get('set-cookie');
    assert.ok(rawCookies, 'Set-Cookie header must be present');
    cookieJar = rawCookies.split(',').map((c) => c.split(';')[0]).join('; ');

    const verifyJson = await verifyOtpRes.json();
    csrfToken = verifyJson.data.csrfToken;
    const registeredCustomerId = verifyJson.data.customer.id;
    assert.ok(registeredCustomerId);

    // 3. Access protected profile (/api/auth/me)
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: cookieJar },
    });
    assert.strictEqual(meRes.status, 200);
    const meJson = await meRes.json();
    assert.strictEqual(meJson.data.customer.email, customerEmail);
    assert.strictEqual(meJson.data.customer.status, 'ACTIVE');

    // 4. Search hotels with date range
    const searchRes = await fetch(`${baseUrl}/api/hotels/search?city=Mumbai&checkIn=${checkIn}&checkOut=${checkOut}&guests=2&rooms=1`, {
      headers: { Cookie: cookieJar },
    });
    assert.strictEqual(searchRes.status, 200);
    const searchJson = await searchRes.json();
    assert.ok(Array.isArray(searchJson.data));

    // 5. Check specific room availability and initial inventory
    const availBeforeRes = await fetch(`${baseUrl}/api/rooms/availability?roomTypeId=${sampleRoomType.id}&checkIn=${checkIn}&checkOut=${checkOut}&rooms=1`);
    assert.strictEqual(availBeforeRes.status, 200);
    const availBeforeJson = await availBeforeRes.json();
    const initialAvail = availBeforeJson.data.availableRooms;
    assert.ok(initialAvail > 0);

    // 6. Create booking with authenticated session (customer_id is assigned from session)
    const bookRes = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieJar,
      },
      body: JSON.stringify({
        roomTypeId: sampleRoomType.id,
        checkIn,
        checkOut,
        rooms: 1,
        guest: {
          name: customerName,
          email: customerEmail,
        },
      }),
    });
    assert.strictEqual(bookRes.status, 201);
    const bookJson = await bookRes.json();
    const bookingReference = bookJson.data.bookingReference;
    assert.ok(bookingReference.startsWith('HBP-'));
    assert.strictEqual(bookJson.data.status, 'CONFIRMED');

    // 7. Verify inventory decremented by 1
    const availAfterRes = await fetch(`${baseUrl}/api/rooms/availability?roomTypeId=${sampleRoomType.id}&checkIn=${checkIn}&checkOut=${checkOut}&rooms=1`);
    const availAfterJson = await availAfterRes.json();
    assert.strictEqual(availAfterJson.data.availableRooms, initialAvail - 1);

    // 8. Retrieve booking by public lookup (reference & email)
    const lookupRes = await fetch(`${baseUrl}/api/bookings/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingReference, email: customerEmail }),
    });
    assert.strictEqual(lookupRes.status, 200);
    const lookupJson = await lookupRes.json();
    assert.strictEqual(lookupJson.data.bookingReference, bookingReference);
    assert.strictEqual(lookupJson.data.status, 'CONFIRMED');

    // 9. View authenticated customer booking history (/api/bookings/my-bookings)
    const myBookingsRes = await fetch(`${baseUrl}/api/bookings/my-bookings`, {
      headers: { Cookie: cookieJar },
    });
    assert.strictEqual(myBookingsRes.status, 200);
    const myBookingsJson = await myBookingsRes.json();
    assert.ok(myBookingsJson.data.some((b) => b.bookingReference === bookingReference));

    // 10. Request cancellation OTP
    const cancelOtpRes = await fetch(`${baseUrl}/api/bookings/cancellation/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingReference, email: customerEmail }),
    });
    assert.strictEqual(cancelOtpRes.status, 200);

    // 11. Verify OTP and obtain single-use cancellation proof
    const verifyCancelRes = await fetch(`${baseUrl}/api/bookings/cancellation/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingReference, email: customerEmail, otp: '123456' }),
    });
    assert.strictEqual(verifyCancelRes.status, 200);
    const verifyCancelJson = await verifyCancelRes.json();
    const cancellationProof = verifyCancelJson.data.cancellationProof;
    assert.ok(cancellationProof);

    // 12. Confirm cancellation atomically
    const cancelConfirmRes = await fetch(`${baseUrl}/api/bookings/cancellation/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingReference,
        email: customerEmail,
        cancellationProof,
        reason: 'Change in schedule',
      }),
    });
    assert.strictEqual(cancelConfirmRes.status, 200);
    const cancelConfirmJson = await cancelConfirmRes.json();
    assert.strictEqual(cancelConfirmJson.data.status, 'CANCELLED');

    // 13. Verify room inventory restored to original level
    const availRestoredRes = await fetch(`${baseUrl}/api/rooms/availability?roomTypeId=${sampleRoomType.id}&checkIn=${checkIn}&checkOut=${checkOut}&rooms=1`);
    const availRestoredJson = await availRestoredRes.json();
    assert.strictEqual(availRestoredJson.data.availableRooms, initialAvail);

    // 14. Logout session
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: cookieJar,
        'x-csrf-token': csrfToken,
      },
    });
    assert.strictEqual(logoutRes.status, 200);

    // 15. Verify session revoked (/api/auth/me rejected with 401)
    const meAfterLogout = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: cookieJar },
    });
    assert.strictEqual(meAfterLogout.status, 401);
  });

  it('Complete Guest Customer Journey: Browse -> Search -> Check Availability -> Guest Checkout (No Account) -> Lookup -> Cancel -> Inventory Restored', async () => {
    const guestEmail = 'pureguest@example.com';
    const guestName = 'Pure Guest Traveler';
    const checkIn = '2026-12-15';
    const checkOut = '2026-12-18'; // 3 nights

    // 1. Browse catalogue without login or cookie
    const browseRes = await fetch(`${baseUrl}/api/hotels?page=1&limit=5`);
    assert.strictEqual(browseRes.status, 200);
    const browseJson = await browseRes.json();
    assert.ok(browseJson.data.length > 0);

    // 2. Search availability
    const searchRes = await fetch(`${baseUrl}/api/hotels/search?city=Mumbai&checkIn=${checkIn}&checkOut=${checkOut}`);
    assert.strictEqual(searchRes.status, 200);

    // 3. Check room availability
    const availRes = await fetch(`${baseUrl}/api/rooms/availability?roomTypeId=${sampleRoomType.id}&checkIn=${checkIn}&checkOut=${checkOut}&rooms=1`);
    assert.strictEqual(availRes.status, 200);
    const initialAvail = (await availRes.json()).data.availableRooms;

    // 4. Create guest booking without authentication
    const bookRes = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomTypeId: sampleRoomType.id,
        checkIn,
        checkOut,
        rooms: 1,
        guest: {
          name: guestName,
          email: guestEmail,
          phone: '+919988776655',
        },
      }),
    });
    assert.strictEqual(bookRes.status, 201);
    const bookJson = await bookRes.json();
    const bookingReference = bookJson.data.bookingReference;
    assert.ok(bookingReference);
    assert.strictEqual(bookJson.data.customerId, null, 'Guest booking customerId must be strictly null');

    // 5. Invariant check: Verify guest checkout NEVER created a record in customers table
    const customerRecord = await authRepository.findCustomerByEmail(guestEmail);
    assert.strictEqual(customerRecord, null, 'Guest email must NEVER be added to customers table');

    // 6. Guest retrieves booking by reference and email
    const lookupRes = await fetch(`${baseUrl}/api/bookings/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingReference, email: guestEmail }),
    });
    assert.strictEqual(lookupRes.status, 200);
    const lookupJson = await lookupRes.json();
    assert.strictEqual(lookupJson.data.bookingReference, bookingReference);
    assert.strictEqual(lookupJson.data.guest.email, guestEmail);

    // 7. Request cancellation OTP
    const sendOtpRes = await fetch(`${baseUrl}/api/bookings/cancellation/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingReference, email: guestEmail }),
    });
    assert.strictEqual(sendOtpRes.status, 200);

    // 8. Verify OTP and obtain single-use cancellation proof
    const verifyOtpRes = await fetch(`${baseUrl}/api/bookings/cancellation/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingReference, email: guestEmail, otp: '123456' }),
    });
    assert.strictEqual(verifyOtpRes.status, 200);
    const { cancellationProof } = (await verifyOtpRes.json()).data;
    assert.ok(cancellationProof);

    // 9. Confirm cancellation
    const cancelRes = await fetch(`${baseUrl}/api/bookings/cancellation/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingReference,
        email: guestEmail,
        cancellationProof,
      }),
    });
    assert.strictEqual(cancelRes.status, 200);

    // 10. Verify inventory restored
    const availRestored = await fetch(`${baseUrl}/api/rooms/availability?roomTypeId=${sampleRoomType.id}&checkIn=${checkIn}&checkOut=${checkOut}&rooms=1`);
    assert.strictEqual((await availRestored.json()).data.availableRooms, initialAvail);

    // 11. Final verification: Customer table remains clean
    const customerCheckAfterCancel = await authRepository.findCustomerByEmail(guestEmail);
    assert.strictEqual(customerCheckAfterCancel, null, 'No customer account exists after cancellation');
  });
});
