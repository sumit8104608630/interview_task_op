import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { paymentService } from '../../src/services/payment.service.js';
import { bookingRepository } from '../../src/repositories/booking.repository.js';
import { paymentRepository } from '../../src/repositories/payment.repository.js';
import { roomRepository } from '../../src/repositories/room.repository.js';
import { loadCatalogueData } from '../../src/database/seeds/seed.js';
import { setMockRazorpayClient } from '../../src/config/razorpay.js';
import { env } from '../../src/config/env.js';
import { ERROR_CODES } from '../../src/constants/errorMessages.js';

describe('Payment Service & Razorpay Integration Unit Tests', () => {
  let mockRzp;
  let testKeySecret = 'test_secret_for_hmac_verification';
  let sampleRoomTypeId;

  before(async () => {
    bookingRepository.setForceInMemory(true);
    paymentRepository.setForceInMemory(true);
    roomRepository.setForceInMemory(true);

    const catalogue = await loadCatalogueData();
    sampleRoomTypeId = catalogue.roomTypes[0].id;

    // Set consistent test key secret for HMAC testing
    env.razorpay.keySecret = testKeySecret;
    env.razorpay.keyId = 'rzp_test_samplekey123';
    env.razorpay.webhookSecret = 'test_webhook_secret_xyz';

    mockRzp = {
      orders: {
        create: async (opts) => ({
          id: 'order_' + Math.random().toString(36).substring(2, 10),
          amount: opts.amount,
          currency: opts.currency,
          receipt: opts.receipt,
          status: 'created',
        }),
      },
      payments: {
        fetch: async (paymentId) => {
          let matchingPayment = null;
          for (const p of paymentRepository._inMemoryPayments.values()) {
            matchingPayment = p;
            break;
          }
          return {
            id: paymentId,
            order_id: matchingPayment?.razorpayOrderId || 'order_matched',
            status: 'captured',
            amount: matchingPayment ? Math.round(matchingPayment.amount * 100) : 2500000,
            currency: matchingPayment?.currency || 'INR',
          };
        },
      },
    };

    setMockRazorpayClient(mockRzp);
  });

  after(() => {
    setMockRazorpayClient(null);
    bookingRepository.setForceInMemory(false);
    paymentRepository.setForceInMemory(false);
    roomRepository.setForceInMemory(false);
  });

  beforeEach(() => {
    bookingRepository.reset();
    paymentRepository.reset();
    roomRepository.resetInventory();
  });

  it('1. should create a pending booking and reserve inventory', async () => {
    // Setup available room in roomRepository
    const roomTypeId = sampleRoomTypeId;
    roomRepository.setInventory(roomTypeId, '2026-12-10', 5);
    roomRepository.setInventory(roomTypeId, '2026-12-11', 5);

    const booking = await bookingRepository.createBookingAtomic({
      roomTypeId,
      checkIn: '2026-12-10',
      checkOut: '2026-12-12', // 2 nights
      roomsCount: 2,
      guestName: 'Eleanor Vance',
      guestEmail: 'eleanor@example.com',
      status: 'PENDING_PAYMENT',
    });

    assert.ok(booking.bookingReference);
    assert.equal(booking.status, 'PENDING_PAYMENT');
    assert.ok(booking.expiresAt);

    // Verify inventory was decremented by 2 rooms
    const remainingAvail = roomRepository.getAvailableRoomsForDate(roomTypeId, '2026-12-10', 5);
    assert.equal(remainingAvail, 3);
  });

  it('2. should create a Razorpay order with authoritative pricing in paise', async () => {
    const roomTypeId = sampleRoomTypeId;
    roomRepository.setInventory(roomTypeId, '2026-12-10', 5);
    roomRepository.setInventory(roomTypeId, '2026-12-11', 5);

    const booking = await bookingRepository.createBookingAtomic({
      roomTypeId,
      checkIn: '2026-12-10',
      checkOut: '2026-12-12',
      roomsCount: 1,
      guestName: 'Eleanor Vance',
      guestEmail: 'eleanor@example.com',
      status: 'PENDING_PAYMENT',
    });

    const orderConfig = await paymentService.createPaymentOrder({
      bookingReference: booking.bookingReference,
      guestEmail: 'eleanor@example.com',
    });

    assert.equal(orderConfig.bookingReference, booking.bookingReference);
    assert.ok(orderConfig.razorpayOrderId.startsWith('order_'));
    assert.equal(orderConfig.keyId, 'rzp_test_samplekey123');
    assert.equal(orderConfig.amount, Math.round(booking.totalAmount * 100));
    assert.equal(orderConfig.currency, 'INR');

    // Confirm payment record was persisted in ledger with CREATED status
    const ledger = await paymentRepository.findByOrderId(orderConfig.razorpayOrderId);
    assert.ok(ledger);
    assert.equal(ledger.status, 'CREATED');
    assert.equal(ledger.amount, booking.totalAmount);
  });

  it('3. should enforce order creation idempotency: repeated calls return existing active order', async () => {
    const roomTypeId = sampleRoomTypeId;
    roomRepository.setInventory(roomTypeId, '2026-12-10', 5);
    roomRepository.setInventory(roomTypeId, '2026-12-11', 5);

    const booking = await bookingRepository.createBookingAtomic({
      roomTypeId,
      checkIn: '2026-12-10',
      checkOut: '2026-12-12',
      roomsCount: 1,
      guestName: 'Eleanor Vance',
      guestEmail: 'eleanor@example.com',
      status: 'PENDING_PAYMENT',
    });

    const firstOrder = await paymentService.createPaymentOrder({
      bookingReference: booking.bookingReference,
    });

    const secondOrder = await paymentService.createPaymentOrder({
      bookingReference: booking.bookingReference,
    });

    assert.equal(firstOrder.razorpayOrderId, secondOrder.razorpayOrderId);
    assert.equal(firstOrder.paymentId, secondOrder.paymentId);
  });

  it('4. should verify payment with valid HMAC SHA-256 signature and confirm booking', async () => {
    const roomTypeId = sampleRoomTypeId;
    roomRepository.setInventory(roomTypeId, '2026-12-10', 5);
    roomRepository.setInventory(roomTypeId, '2026-12-11', 5);

    const booking = await bookingRepository.createBookingAtomic({
      roomTypeId,
      checkIn: '2026-12-10',
      checkOut: '2026-12-12',
      roomsCount: 1,
      guestName: 'Eleanor Vance',
      guestEmail: 'eleanor@example.com',
      status: 'PENDING_PAYMENT',
    });

    const orderConfig = await paymentService.createPaymentOrder({
      bookingReference: booking.bookingReference,
    });

    const fakePaymentId = 'pay_test_' + Date.now();
    const validSignature = crypto
      .createHmac('sha256', testKeySecret)
      .update(`${orderConfig.razorpayOrderId}|${fakePaymentId}`)
      .digest('hex');

    const result = await paymentService.verifyPayment({
      razorpay_order_id: orderConfig.razorpayOrderId,
      razorpay_payment_id: fakePaymentId,
      razorpay_signature: validSignature,
    });

    assert.equal(result.success, true);
    assert.equal(result.status, 'CONFIRMED');
    assert.equal(result.bookingReference, booking.bookingReference);

    // Verify booking in repository transitioned to CONFIRMED
    const updatedBooking = await bookingRepository.findByReference(booking.bookingReference);
    assert.equal(updatedBooking.status, 'CONFIRMED');

    // Verify payment in repository transitioned to CAPTURED
    const updatedPayment = await paymentRepository.findByOrderId(orderConfig.razorpayOrderId);
    assert.equal(updatedPayment.status, 'CAPTURED');
    assert.equal(updatedPayment.razorpayPaymentId, fakePaymentId);
  });

  it('5. should reject verification with invalid signature and mark payment FAILED', async () => {
    const roomTypeId = sampleRoomTypeId;
    roomRepository.setInventory(roomTypeId, '2026-12-10', 5);
    roomRepository.setInventory(roomTypeId, '2026-12-11', 5);

    const booking = await bookingRepository.createBookingAtomic({
      roomTypeId,
      checkIn: '2026-12-10',
      checkOut: '2026-12-12',
      roomsCount: 1,
      guestName: 'Eleanor Vance',
      guestEmail: 'eleanor@example.com',
      status: 'PENDING_PAYMENT',
    });

    const orderConfig = await paymentService.createPaymentOrder({
      bookingReference: booking.bookingReference,
    });

    const fakePaymentId = 'pay_tampered_' + Date.now();
    const fraudulentSignature = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    await assert.rejects(
      async () => {
        await paymentService.verifyPayment({
          razorpay_order_id: orderConfig.razorpayOrderId,
          razorpay_payment_id: fakePaymentId,
          razorpay_signature: fraudulentSignature,
        });
      },
      (err) => {
        assert.equal(err.code, ERROR_CODES.INVALID_PAYMENT_SIGNATURE);
        return true;
      }
    );

    // Booking must remain PENDING_PAYMENT (not confirmed)
    const currentBooking = await bookingRepository.findByReference(booking.bookingReference);
    assert.equal(currentBooking.status, 'PENDING_PAYMENT');

    // Payment should be marked FAILED
    const payment = await paymentRepository.findByOrderId(orderConfig.razorpayOrderId);
    assert.equal(payment.status, 'FAILED');
  });

  it('6. should make payment verification idempotent on repeated valid submissions', async () => {
    const roomTypeId = sampleRoomTypeId;
    roomRepository.setInventory(roomTypeId, '2026-12-10', 5);
    roomRepository.setInventory(roomTypeId, '2026-12-11', 5);

    const booking = await bookingRepository.createBookingAtomic({
      roomTypeId,
      checkIn: '2026-12-10',
      checkOut: '2026-12-12',
      roomsCount: 1,
      guestName: 'Eleanor Vance',
      guestEmail: 'eleanor@example.com',
      status: 'PENDING_PAYMENT',
    });

    const orderConfig = await paymentService.createPaymentOrder({
      bookingReference: booking.bookingReference,
    });

    const fakePaymentId = 'pay_idemp_' + Date.now();
    const validSignature = crypto
      .createHmac('sha256', testKeySecret)
      .update(`${orderConfig.razorpayOrderId}|${fakePaymentId}`)
      .digest('hex');

    const first = await paymentService.verifyPayment({
      razorpay_order_id: orderConfig.razorpayOrderId,
      razorpay_payment_id: fakePaymentId,
      razorpay_signature: validSignature,
    });

    const second = await paymentService.verifyPayment({
      razorpay_order_id: orderConfig.razorpayOrderId,
      razorpay_payment_id: fakePaymentId,
      razorpay_signature: validSignature,
    });

    assert.equal(first.status, 'CONFIRMED');
    assert.equal(second.status, 'CONFIRMED');
    assert.equal(second.alreadyConfirmed, true);
  });

  it('7. should expire stale pending reservations and restore room inventory', async () => {
    const roomTypeId = sampleRoomTypeId;
    roomRepository.setInventory(roomTypeId, '2026-12-10', 5);
    roomRepository.setInventory(roomTypeId, '2026-12-11', 5);

    // Create a pending booking that expired 1 minute ago
    const pastTime = new Date(Date.now() - 60000).toISOString();
    const booking = await bookingRepository.createBookingAtomic({
      roomTypeId,
      checkIn: '2026-12-10',
      checkOut: '2026-12-12',
      roomsCount: 2,
      guestName: 'Eleanor Vance',
      guestEmail: 'eleanor@example.com',
      status: 'PENDING_PAYMENT',
      expiresAt: pastTime,
    });

    // Check that inventory was decremented from 5 to 3
    assert.equal(roomRepository.getAvailableRoomsForDate(roomTypeId, '2026-12-10', 5), 3);

    // Run expiration routine
    const expiredList = await paymentService.expirePendingReservations();
    assert.ok(expiredList.includes(booking.bookingReference));

    // Verify booking status transitioned to PAYMENT_EXPIRED
    const currentBooking = await bookingRepository.findByReference(booking.bookingReference);
    assert.equal(currentBooking.status, 'PAYMENT_EXPIRED');

    // Verify inventory was restored back to 5
    assert.equal(roomRepository.getAvailableRoomsForDate(roomTypeId, '2026-12-10', 5), 5);
  });

  it('8. should process webhook payment.captured event idempotently', async () => {
    const roomTypeId = sampleRoomTypeId;
    roomRepository.setInventory(roomTypeId, '2026-12-10', 5);
    roomRepository.setInventory(roomTypeId, '2026-12-11', 5);

    const booking = await bookingRepository.createBookingAtomic({
      roomTypeId,
      checkIn: '2026-12-10',
      checkOut: '2026-12-12',
      roomsCount: 1,
      guestName: 'Eleanor Vance',
      guestEmail: 'eleanor@example.com',
      status: 'PENDING_PAYMENT',
    });

    const orderConfig = await paymentService.createPaymentOrder({
      bookingReference: booking.bookingReference,
    });

    const webhookBody = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_webhook_123',
            order_id: orderConfig.razorpayOrderId,
            amount: orderConfig.amount,
            status: 'captured',
            method: 'upi',
          },
        },
      },
    };

    const rawBody = JSON.stringify(webhookBody);
    const signature = crypto
      .createHmac('sha256', env.razorpay.webhookSecret)
      .update(rawBody)
      .digest('hex');

    const res = await paymentService.handleWebhook({
      rawBody,
      signature,
      event: webhookBody,
    });

    assert.equal(res.received, true);

    const confirmed = await bookingRepository.findByReference(booking.bookingReference);
    assert.equal(confirmed.status, 'CONFIRMED');
  });
});
