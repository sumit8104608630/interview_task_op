import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import crypto from 'crypto';
import { app } from '../../src/app.js';
import { hotelRepository } from '../../src/repositories/hotel.repository.js';
import { locationRepository } from '../../src/repositories/location.repository.js';
import { roomRepository } from '../../src/repositories/room.repository.js';
import { bookingRepository } from '../../src/repositories/booking.repository.js';
import { paymentRepository } from '../../src/repositories/payment.repository.js';
import { setMockRazorpayClient } from '../../src/config/razorpay.js';
import { env } from '../../src/config/env.js';

describe('Payment & Razorpay API Integration Tests', () => {
  let server;
  let baseUrl;
  let sampleRoomTypeId;
  let testSecret = 'rzp_test_secret_for_integration_tests';

  before(async () => {
    hotelRepository.setForceInMemory(true);
    locationRepository.setForceInMemory(true);
    roomRepository.setForceInMemory(true);
    bookingRepository.setForceInMemory(true);
    paymentRepository.setForceInMemory(true);

    env.razorpay.keyId = 'rzp_test_int_key123';
    env.razorpay.keySecret = testSecret;
    env.razorpay.webhookSecret = 'test_webhook_sec_abc';

    setMockRazorpayClient({
      orders: {
        create: async (opts) => ({
          id: 'order_test_' + Math.random().toString(36).substring(2, 9),
          amount: opts.amount,
          currency: opts.currency,
          receipt: opts.receipt,
          status: 'created',
        }),
      },
      payments: {
        fetch: async (paymentId) => {
          let matching = null;
          for (const p of paymentRepository._inMemoryPayments.values()) {
            matching = p;
            break;
          }
          return {
            id: paymentId,
            order_id: matching?.razorpayOrderId || 'order_default',
            status: 'captured',
            amount: matching ? Math.round(matching.amount * 100) : 100000,
            currency: 'INR',
          };
        },
      },
    });

    await new Promise((resolve) => {
      server = http.createServer(app).listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    // Seed/discover valid room type
    const hotelsRes = await fetch(`${baseUrl}/api/hotels`);
    const hotelsJson = await hotelsRes.json();
    sampleRoomTypeId = hotelsJson.data[0].roomCategories[0].id;
  });

  after(async () => {
    setMockRazorpayClient(null);
    hotelRepository.setForceInMemory(false);
    locationRepository.setForceInMemory(false);
    roomRepository.setForceInMemory(false);
    bookingRepository.setForceInMemory(false);
    paymentRepository.setForceInMemory(false);

    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    bookingRepository.reset();
    paymentRepository.reset();
    roomRepository.resetInventory();
  });

  it('1. GET /api/payments/config returns public key ID and currency', async () => {
    const res = await fetch(`${baseUrl}/api/payments/config`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.keyId, 'rzp_test_int_key123');
    assert.equal(json.data.currency, 'INR');
  });

  it('2. POST /api/bookings with requirePayment: true creates PENDING_PAYMENT booking', async () => {
    const res = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomTypeId: sampleRoomTypeId,
        checkIn: '2026-12-15',
        checkOut: '2026-12-18',
        rooms: 1,
        requirePayment: true,
        guest: {
          name: 'Arthur Pendelton',
          email: 'arthur@example.com',
          phone: '+919999988888',
        },
      }),
    });

    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.status, 'PENDING_PAYMENT');
    assert.ok(json.data.expiresAt);
  });

  it('3. POST /api/payments/create-order creates order for pending booking', async () => {
    // 1. Create pending booking
    const bookRes = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomTypeId: sampleRoomTypeId,
        checkIn: '2026-12-15',
        checkOut: '2026-12-18',
        rooms: 1,
        requirePayment: true,
        guest: {
          name: 'Arthur Pendelton',
          email: 'arthur@example.com',
        },
      }),
    });
    const { data: booking } = await bookRes.json();

    // 2. Create Razorpay order
    const orderRes = await fetch(`${baseUrl}/api/payments/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingReference: booking.bookingReference,
      }),
    });

    assert.equal(orderRes.status, 200);
    const orderJson = await orderRes.json();
    assert.equal(orderJson.success, true);
    assert.equal(orderJson.data.bookingReference, booking.bookingReference);
    assert.ok(orderJson.data.razorpayOrderId.startsWith('order_test_'));
    assert.equal(orderJson.data.amount, Math.round(booking.totalAmount * 100));
  });

  it('4. POST /api/payments/verify cryptographically confirms booking on valid signature', async () => {
    // 1. Create pending booking
    const bookRes = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomTypeId: sampleRoomTypeId,
        checkIn: '2026-12-15',
        checkOut: '2026-12-18',
        rooms: 1,
        requirePayment: true,
        guest: {
          name: 'Arthur Pendelton',
          email: 'arthur@example.com',
        },
      }),
    });
    const { data: booking } = await bookRes.json();

    // 2. Create order
    const orderRes = await fetch(`${baseUrl}/api/payments/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingReference: booking.bookingReference,
      }),
    });
    const { data: orderData } = await orderRes.json();

    // 3. Compute HMAC signature
    const paymentId = 'pay_integ_' + Date.now();
    const signature = crypto
      .createHmac('sha256', testSecret)
      .update(`${orderData.razorpayOrderId}|${paymentId}`)
      .digest('hex');

    // 4. Verify payment
    const verifyRes = await fetch(`${baseUrl}/api/payments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: orderData.razorpayOrderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      }),
    });

    assert.equal(verifyRes.status, 200);
    const verifyJson = await verifyRes.json();
    assert.equal(verifyJson.success, true);
    assert.equal(verifyJson.data.status, 'CONFIRMED');
    assert.equal(verifyJson.data.bookingReference, booking.bookingReference);

    // 5. Query authoritative payment details
    const detailsRes = await fetch(`${baseUrl}/api/payments/booking/${booking.bookingReference}`);
    assert.equal(detailsRes.status, 200);
    const detailsJson = await detailsRes.json();
    assert.equal(detailsJson.data.booking.status, 'CONFIRMED');
    assert.equal(detailsJson.data.payment.status, 'CAPTURED');
  });

  it('5. POST /api/payments/verify rejects fraudulent signature with 400', async () => {
    const bookRes = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomTypeId: sampleRoomTypeId,
        checkIn: '2026-12-15',
        checkOut: '2026-12-18',
        rooms: 1,
        requirePayment: true,
        guest: {
          name: 'Arthur Pendelton',
          email: 'arthur@example.com',
        },
      }),
    });
    const { data: booking } = await bookRes.json();

    const orderRes = await fetch(`${baseUrl}/api/payments/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingReference: booking.bookingReference,
      }),
    });
    const { data: orderData } = await orderRes.json();

    const verifyRes = await fetch(`${baseUrl}/api/payments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: orderData.razorpayOrderId,
        razorpay_payment_id: 'pay_fraud_123',
        razorpay_signature: 'invalid_fraudulent_signature_00000000000000000000000000000000',
      }),
    });

    assert.equal(verifyRes.status, 400);
    const errJson = await verifyRes.json();
    assert.equal(errJson.success, false);
    assert.equal(errJson.error.code, 'INVALID_PAYMENT_SIGNATURE');
  });
});
