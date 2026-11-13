import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { outboxRepository } from '../../src/repositories/outbox.repository.js';
import { bookingRepository } from '../../src/repositories/booking.repository.js';
import { roomRepository } from '../../src/repositories/room.repository.js';
import { hotelRepository } from '../../src/repositories/hotel.repository.js';
import { locationRepository } from '../../src/repositories/location.repository.js';
import { amenityRepository } from '../../src/repositories/amenity.repository.js';
import { notificationClient } from '../../src/integrations/notification/notification.client.js';
import { NotificationWorker, sanitizeNotificationError } from '../../src/workers/notification.worker.js';

describe('Transactional Notification Outbox & Worker Integration Tests (Phase 6)', () => {
  let worker;
  let sampleRoomTypeId;

  before(async () => {
    // Isolate tests using in-memory repositories
    hotelRepository.setForceInMemory(true);
    locationRepository.setForceInMemory(true);
    roomRepository.setForceInMemory(true);
    amenityRepository.setForceInMemory(true);
    bookingRepository.setForceInMemory(true);
    outboxRepository.setForceInMemory(true);

    const hotels = await hotelRepository.findAll({ limit: 1 });
    sampleRoomTypeId = hotels.hotels[0].roomCategories[0].id;

    worker = new NotificationWorker({
      pollIntervalMs: 50,
      batchSize: 10,
      maxAttempts: 3,
      initialBackoffMs: 100,
      backoffMultiplier: 2.0,
    });
  });

  after(async () => {
    await worker.stop();
    hotelRepository.setForceInMemory(false);
    locationRepository.setForceInMemory(false);
    roomRepository.setForceInMemory(false);
    amenityRepository.setForceInMemory(false);
    bookingRepository.setForceInMemory(false);
    outboxRepository.setForceInMemory(false);
    notificationClient.clearMockHandler();
  });

  beforeEach(() => {
    bookingRepository.reset();
    outboxRepository.reset();
    roomRepository.resetInventory();
    notificationClient.clearMockHandler();
  });

  afterEach(async () => {
    await worker.stop();
  });

  it('1. Booking event creation: Creating a booking atomically enqueues a BOOKING_CONFIRMED event', async () => {
    const booking = await bookingRepository.createBookingAtomic({
      roomTypeId: sampleRoomTypeId,
      checkIn: '2026-12-01',
      checkOut: '2026-12-04',
      roomsCount: 2,
      guestName: 'Alice Smith',
      guestEmail: 'alice@example.com',
      guestPhone: '+919876543210',
    });

    assert.ok(booking.bookingReference);
    const events = await outboxRepository.getAllEvents();
    assert.strictEqual(events.length, 1);

    const event = events[0];
    assert.strictEqual(event.eventType, 'BOOKING_CONFIRMED');
    assert.strictEqual(event.status, 'PENDING');
    assert.strictEqual(event.attempts, 0);
    assert.strictEqual(event.idempotencyKey, `${booking.id}:BOOKING_CONFIRMED`);

    // Verify all required Phase 6 payload fields for BOOKING_CONFIRMED
    const p = event.payload;
    assert.strictEqual(p.bookingReference, booking.bookingReference);
    assert.ok(p.hotelName, 'Hotel name must be present');
    assert.ok(p.roomCategory, 'Room category must be present');
    assert.strictEqual(p.guestName, 'Alice Smith');
    assert.strictEqual(p.guestEmail, 'alice@example.com');
    assert.strictEqual(p.checkIn, '2026-12-01');
    assert.strictEqual(p.checkOut, '2026-12-04');
    assert.strictEqual(p.numberOfRooms, 2);
    assert.strictEqual(p.nights, 3);
    assert.ok(p.totalAmount > 0, 'Total amount must be greater than 0');
    assert.ok(p.currency, 'Currency must be present');
  });

  it('2. Cancellation event creation: Cancelling a booking atomically enqueues a BOOKING_CANCELLED event', async () => {
    const booking = await bookingRepository.createBookingAtomic({
      roomTypeId: sampleRoomTypeId,
      checkIn: '2026-12-01',
      checkOut: '2026-12-04',
      roomsCount: 1,
      guestName: 'Bob Builder',
      guestEmail: 'bob@example.com',
    });

    // Create single-use proof and execute cancellation
    const session = await bookingRepository.createGuestSession({
      bookingId: booking.id,
      email: 'bob@example.com',
      purpose: 'CANCELLATION',
      expiresInMinutes: 15,
    });

    const cancelResult = await bookingRepository.cancelBookingAtomic({
      bookingReference: booking.bookingReference,
      email: 'bob@example.com',
      cancellationProof: session.token,
      reason: 'Schedule conflict',
    });

    assert.strictEqual(cancelResult.status, 'CANCELLED');

    const events = await outboxRepository.getAllEvents();
    const cancelEvent = events.find((e) => e.eventType === 'BOOKING_CANCELLED');
    assert.ok(cancelEvent, 'BOOKING_CANCELLED event must be in outbox');
    assert.strictEqual(cancelEvent.status, 'PENDING');

    // Verify all required Phase 6 payload fields for BOOKING_CANCELLED
    const cp = cancelEvent.payload;
    assert.strictEqual(cp.bookingReference, booking.bookingReference);
    assert.ok(cp.hotelName, 'Hotel name must be present');
    assert.strictEqual(cp.guestName, 'Bob Builder');
    assert.strictEqual(cp.cancellationStatus, 'CANCELLED');
    assert.ok(cp.cancellationTimestamp, 'Cancellation timestamp must be present');
  });

  it('3. Successful delivery: Worker claims due pending event, delivers email, and marks status SENT', async () => {
    let emailDispatched = null;

    notificationClient.setMockHandler({
      sendBookingConfirmation: async ({ email, guestName, bookingDetails }) => {
        emailDispatched = { email, guestName, bookingDetails };
        return { success: true, messageId: 'msg-mock-12345' };
      },
    });

    await bookingRepository.createBookingAtomic({
      roomTypeId: sampleRoomTypeId,
      checkIn: '2026-12-10',
      checkOut: '2026-12-12',
      roomsCount: 1,
      guestName: 'Charlie Brown',
      guestEmail: 'charlie@example.com',
    });

    const result = await worker.processDueEvents(10);
    assert.strictEqual(result.processed, 1);
    assert.strictEqual(result.succeeded, 1);
    assert.strictEqual(result.failed, 0);

    assert.ok(emailDispatched);
    assert.strictEqual(emailDispatched.email, 'charlie@example.com');
    assert.strictEqual(emailDispatched.guestName, 'Charlie Brown');

    const events = await outboxRepository.getAllEvents();
    assert.strictEqual(events[0].status, 'SENT');
    assert.ok(events[0].sentAt, 'sent_at must be populated');
    assert.strictEqual(events[0].lastError, null);
  });

  it('4. Retry behavior: Transient failures increment attempts and schedule exponential backoff', async () => {
    notificationClient.setMockHandler({
      sendBookingConfirmation: async () => ({
        success: false,
        error: '503 Service Unavailable: upstream provider throttling',
      }),
    });

    await bookingRepository.createBookingAtomic({
      roomTypeId: sampleRoomTypeId,
      checkIn: '2026-12-10',
      checkOut: '2026-12-12',
      roomsCount: 1,
      guestName: 'Dana Scully',
      guestEmail: 'scully@example.com',
    });

    const beforeProcess = Date.now();
    const result = await worker.processDueEvents(10);

    assert.strictEqual(result.processed, 1);
    assert.strictEqual(result.succeeded, 0);
    assert.strictEqual(result.failed, 1);

    const events = await outboxRepository.getAllEvents();
    const event = events[0];

    assert.strictEqual(event.status, 'PENDING', 'Event must remain PENDING for retry');
    assert.strictEqual(event.attempts, 1);
    assert.ok(event.lastError.includes('503 Service Unavailable'));

    // Check exponential backoff duration (initialBackoffMs: 100)
    const nextAttempt = new Date(event.nextAttemptAt).getTime();
    assert.ok(nextAttempt >= beforeProcess + 90, 'Next attempt must be scheduled in the future');
  });

  it('5. Maximum retry handling: Event transitions to FAILED when attempts exceed maxAttempts', async () => {
    notificationClient.setMockHandler({
      sendBookingConfirmation: async () => ({
        success: false,
        error: 'Invalid recipient mailbox address (550)',
      }),
    });

    await bookingRepository.createBookingAtomic({
      roomTypeId: sampleRoomTypeId,
      checkIn: '2026-12-10',
      checkOut: '2026-12-12',
      roomsCount: 1,
      guestName: 'Fox Mulder',
      guestEmail: 'mulder@example.com',
    });

    // Worker maxAttempts is set to 3. Run 3 failure cycles.
    const initialEvents = await outboxRepository.getAllEvents();
    const eventId = initialEvents[0].id;

    for (let i = 1; i <= 3; i++) {
      // Force nextAttemptAt to past so worker considers it due
      await outboxRepository.resetNextAttemptAt(eventId, new Date(Date.now() - 1000));
      await worker.processDueEvents(10);
    }

    const events = await outboxRepository.getAllEvents();
    const event = events[0];

    assert.strictEqual(event.status, 'FAILED', 'Status must transition to FAILED after max retries');
    assert.strictEqual(event.attempts, 3);
    assert.ok(event.lastError.includes('550'));
  });

  it('6. Idempotency: Attempting to insert duplicate event with identical idempotencyKey is rejected', async () => {
    const bookingId = 'a0000000-0000-0000-0000-000000000001';
    const idempotencyKey = `${bookingId}:BOOKING_CONFIRMED`;

    const first = await outboxRepository.createEvent({
      bookingId,
      eventType: 'BOOKING_CONFIRMED',
      idempotencyKey,
      payload: { bookingReference: 'HBP-IDEMP1', guestEmail: 'idemp@example.com' },
    });

    const duplicate = await outboxRepository.createEvent({
      bookingId,
      eventType: 'BOOKING_CONFIRMED',
      idempotencyKey,
      payload: { bookingReference: 'HBP-IDEMP1', guestEmail: 'idemp@example.com' },
    });

    const allEvents = await outboxRepository.getAllEvents();
    assert.strictEqual(allEvents.length, 1, 'Only one outbox row should exist');
    assert.strictEqual(first.id, duplicate.id);
  });

  it('7. Concurrent worker processing: Competing workers claim disjoint sets of records without collision', async () => {
    // Enqueue 6 events
    for (let i = 1; i <= 6; i++) {
      await outboxRepository.createEvent({
        bookingId: `b0000000-0000-0000-0000-00000000000${i}`,
        eventType: 'BOOKING_CONFIRMED',
        idempotencyKey: `concurrent-test-${i}`,
        payload: { bookingReference: `HBP-CONCURR-${i}`, guestEmail: `guest${i}@example.com` },
      });
    }

    const processedIds = new Set();
    let collisionDetected = false;

    notificationClient.setMockHandler({
      sendBookingConfirmation: async ({ bookingDetails }) => {
        const ref = bookingDetails.bookingReference;
        if (processedIds.has(ref)) {
          collisionDetected = true;
        }
        processedIds.add(ref);
        return { success: true, messageId: `msg-${ref}` };
      },
    });

    const worker1 = new NotificationWorker({ batchSize: 3 });
    const worker2 = new NotificationWorker({ batchSize: 3 });

    // Execute concurrently
    const [res1, res2] = await Promise.all([
      worker1.processDueEvents(3),
      worker2.processDueEvents(3),
    ]);

    assert.strictEqual(res1.processed, 3);
    assert.strictEqual(res2.processed, 3);
    assert.strictEqual(collisionDetected, false, 'No two workers should process the same event');
    assert.strictEqual(processedIds.size, 6, 'All 6 events should be processed exactly once');
  });

  it('8. Provider unavailable: Worker catches provider exceptions safely and schedules backoff', async () => {
    notificationClient.setMockHandler({
      sendBookingConfirmation: async () => {
        const err = new Error('getaddrinfo ENOTFOUND otp-microservise.vercel.app');
        err.code = 'ENOTFOUND';
        throw err;
      },
    });

    await outboxRepository.createEvent({
      bookingId: 'c0000000-0000-0000-0000-000000000001',
      eventType: 'BOOKING_CONFIRMED',
      idempotencyKey: 'unavail-test-1',
      payload: { bookingReference: 'HBP-UNAVAIL-1', guestEmail: 'unavail@example.com' },
    });

    const res = await worker.processDueEvents(10);
    assert.strictEqual(res.processed, 1);
    assert.strictEqual(res.succeeded, 0);
    assert.strictEqual(res.failed, 1);

    const event = (await outboxRepository.getAllEvents())[0];
    assert.strictEqual(event.status, 'PENDING');
    assert.strictEqual(event.attempts, 1);
    assert.ok(event.lastError.includes('ENOTFOUND'));
  });

  it('9. Failed notification does not undo or revert a confirmed booking', async () => {
    notificationClient.setMockHandler({
      sendBookingConfirmation: async () => ({ success: false, error: 'Provider hard failure' }),
    });

    const booking = await bookingRepository.createBookingAtomic({
      roomTypeId: sampleRoomTypeId,
      checkIn: '2026-12-20',
      checkOut: '2026-12-23',
      roomsCount: 1,
      guestName: 'Grace Hopper',
      guestEmail: 'grace@example.com',
    });

    // Run outbox worker to simulate notification failure
    await worker.processDueEvents(10);

    // Verify booking in database is STILL fully CONFIRMED
    const fetchedBooking = await bookingRepository.findByReference(booking.bookingReference);
    assert.ok(fetchedBooking);
    assert.strictEqual(fetchedBooking.status, 'CONFIRMED');
    assert.strictEqual(fetchedBooking.bookingReference, booking.bookingReference);
  });

  it('10. Security: Sensitive credentials, tokens, and OTP codes are sanitized from error logs', () => {
    const errorWithSecrets = 'HTTP 401 Unauthorized: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid ' +
      'with x-api-key: secret_abc_123 and customer OTP 987654 failed verification with password: SuperSecretPassword!';

    const sanitized = sanitizeNotificationError(errorWithSecrets);

    assert.ok(!sanitized.includes('secret_abc_123'), 'API key must be redacted');
    assert.ok(!sanitized.includes('987654'), '6-digit OTP must be redacted');
    assert.ok(!sanitized.includes('SuperSecretPassword!'), 'Password must be redacted');
    assert.ok(sanitized.includes('Bearer [REDACTED]'));
    assert.ok(sanitized.includes('[OTP_REDACTED]'));
  });
});
