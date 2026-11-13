import crypto from 'crypto';
import Razorpay from 'razorpay';
import { getRazorpayClient, getPublicRazorpayConfig } from '../config/razorpay.js';
import { env } from '../config/env.js';
import { bookingRepository } from '../repositories/booking.repository.js';
import { paymentRepository } from '../repositories/payment.repository.js';
import { notificationService } from './notification.service.js';
import { AppError } from '../middleware/error.middleware.js';
import { ERROR_CODES, ERROR_MESSAGES } from '../constants/errorMessages.js';

/**
 * Payment Domain Business Service
 * Coordinates Razorpay Order creation, cryptographic HMAC verification,
 * atomic booking confirmation, webhook reconciliation, and pending reservation expiry.
 */
export class PaymentService {
  /**
   * Creates or retrieves an existing Razorpay Order for a pending booking.
   * Authoritative pricing is strictly pulled from the database, never trusted from client.
   *
   * @param {object} params
   * @param {string} params.bookingReference
   * @param {string|null} [params.customerId=null]
   * @param {string|null} [params.guestEmail=null]
   * @returns {Promise<object>} Razorpay checkout parameters
   */
  async createPaymentOrder({ bookingReference, customerId = null, guestEmail = null }) {
    if (!bookingReference) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Booking reference is required to initiate payment.', 400);
    }

    // 1. Retrieve authoritative booking from database
    const booking = await bookingRepository.findByReference(bookingReference);
    if (!booking) {
      throw new AppError(ERROR_CODES.BOOKING_NOT_FOUND, ERROR_MESSAGES[ERROR_CODES.BOOKING_NOT_FOUND], 404);
    }

    // 2. Validate ownership if customer is authenticated
    if (customerId && booking.customerId && booking.customerId !== customerId) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'You are not authorized to pay for this reservation.', 403);
    }

    // 3. Confirm booking is in PENDING_PAYMENT status
    if (booking.status === 'CONFIRMED') {
      throw new AppError(
        ERROR_CODES.BOOKING_ALREADY_CONFIRMED,
        'This reservation is already confirmed and paid.',
        400
      );
    }

    if (booking.status === 'CANCELLED' || booking.status === 'PAYMENT_EXPIRED') {
      throw new AppError(
        ERROR_CODES.RESERVATION_EXPIRED,
        'This reservation has expired or was cancelled. Please create a new booking.',
        400
      );
    }

    if (booking.status !== 'PENDING_PAYMENT') {
      throw new AppError(
        ERROR_CODES.PAYMENT_REQUIRED,
        `Booking is in ${booking.status} status and cannot accept payment.`,
        400
      );
    }

    // 4. Confirm reservation has not expired
    if (booking.expiresAt && new Date(booking.expiresAt).getTime() < Date.now()) {
      await bookingRepository.expirePendingBookingsAtomic();
      throw new AppError(
        ERROR_CODES.RESERVATION_EXPIRED,
        'Reservation holding window (15 minutes) has elapsed. Rooms have been released to inventory.',
        400
      );
    }

    // 5. Authoritative amount conversion: INR to Paise
    const authoritativeAmount = Number(booking.totalAmount);
    if (isNaN(authoritativeAmount) || authoritativeAmount <= 0) {
      throw new AppError(ERROR_CODES.INTERNAL_SERVER_ERROR, 'Invalid booking total amount.', 500);
    }
    const amountInPaise = Math.round(authoritativeAmount * 100);
    const currency = (booking.currency || env.razorpay.currency || 'INR').toUpperCase();

    // 6. Idempotency: check if an active CREATED order already exists for this booking
    const activePayment = await paymentRepository.findActiveOrderForBooking(booking.id);
    if (activePayment && activePayment.razorpayOrderId) {
      return {
        keyId: env.razorpay.keyId,
        razorpayOrderId: activePayment.razorpayOrderId,
        amount: amountInPaise,
        currency,
        bookingReference: booking.bookingReference,
        hotelName: booking.hotelName,
        roomName: booking.roomName,
        guestName: booking.guest?.fullName || '',
        guestEmail: booking.guest?.email || '',
        guestPhone: booking.guest?.phone || '',
        paymentId: activePayment.id,
        expiresAt: booking.expiresAt,
      };
    }

    // 7. Create Razorpay Order via official SDK
    const razorpay = getRazorpayClient();
    const receipt = booking.bookingReference.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);

    const orderOptions = {
      amount: amountInPaise,
      currency,
      receipt,
      notes: {
        bookingReference: booking.bookingReference,
        hotelName: booking.hotelName ? booking.hotelName.slice(0, 50) : '',
        roomName: booking.roomName ? booking.roomName.slice(0, 50) : '',
        guestEmail: booking.guest?.email || '',
      },
    };

    let rzpOrder;
    try {
      rzpOrder = await razorpay.orders.create(orderOptions);
    } catch (sdkError) {
      console.error('[PaymentService.createPaymentOrder] Razorpay SDK order creation error:', sdkError.message);
      throw new AppError(
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        `Payment gateway initialization error: ${sdkError.message || 'Unable to create payment order.'}`,
        502
      );
    }

    // 8. Link Razorpay order ID to internal payment ledger record
    const paymentRecord = await paymentRepository.createPayment({
      bookingId: booking.id,
      bookingReference: booking.bookingReference,
      razorpayOrderId: rzpOrder.id,
      amount: authoritativeAmount,
      currency,
      status: 'CREATED',
    });

    return {
      keyId: env.razorpay.keyId,
      razorpayOrderId: rzpOrder.id,
      amount: amountInPaise,
      currency,
      bookingReference: booking.bookingReference,
      hotelName: booking.hotelName,
      roomName: booking.roomName,
      guestName: booking.guest?.fullName || '',
      guestEmail: booking.guest?.email || '',
      guestPhone: booking.guest?.phone || '',
      paymentId: paymentRecord.id,
      expiresAt: booking.expiresAt,
    };
  }

  /**
   * Verifies Razorpay HMAC signature server-side and captures payment.
   * Never trusts the frontend alone; signature is calculated with server-side RAZORPAY_KEY_SECRET.
   *
   * @param {object} params
   * @param {string} params.razorpay_order_id
   * @param {string} params.razorpay_payment_id
   * @param {string} params.razorpay_signature
   * @returns {Promise<object>} Confirmed booking and payment result
   */
  async verifyPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.',
        400
      );
    }

    // 1. Look up internal payment record by order ID
    const payment = await paymentRepository.findByOrderId(razorpay_order_id);
    if (!payment) {
      throw new AppError(
        ERROR_CODES.PAYMENT_ORDER_NOT_FOUND,
        'No matching internal payment record found for this order ID.',
        404
      );
    }

    // 2. Idempotency Check: if already captured, return immediate confirmation
    if (payment.status === 'CAPTURED') {
      return {
        success: true,
        bookingReference: payment.bookingReference,
        status: 'CONFIRMED',
        paymentId: payment.razorpayPaymentId || razorpay_payment_id,
        amount: payment.amount,
        currency: payment.currency,
        alreadyConfirmed: true,
      };
    }

    // 3. Cryptographic Signature Verification (HMAC-SHA256 with timingSafeEqual)
    const expectedSignature = crypto
      .createHmac('sha256', env.razorpay.keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'utf-8');
    const actualBuf = Buffer.from(razorpay_signature, 'utf-8');

    const isSignatureValid =
      expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);

    if (!isSignatureValid) {
      await paymentRepository.updateStatus(payment.id, {
        status: 'FAILED',
        razorpayPaymentId: razorpay_payment_id,
        errorCode: 'INVALID_SIGNATURE',
        errorDescription: 'HMAC signature verification failed.',
        failedAt: new Date(),
      });

      throw new AppError(
        ERROR_CODES.INVALID_PAYMENT_SIGNATURE,
        'Payment signature verification failed. Untrusted transaction signature.',
        400
      );
    }

    // 4. Remote Razorpay status validation (if online/available)
    try {
      const razorpay = getRazorpayClient();
      const rzpPayment = await razorpay.payments.fetch(razorpay_payment_id);
      if (rzpPayment) {
        if (rzpPayment.order_id && rzpPayment.order_id !== razorpay_order_id) {
          throw new AppError(
            ERROR_CODES.PAYMENT_FAILED,
            'Payment is associated with a mismatched Razorpay order ID.',
            400
          );
        }

        const expectedPaise = Math.round(Number(payment.amount) * 100);
        if (rzpPayment.amount && rzpPayment.amount !== expectedPaise) {
          throw new AppError(
            ERROR_CODES.AMOUNT_MISMATCH,
            `Paid amount (${rzpPayment.amount} paise) does not match expected booking total (${expectedPaise} paise).`,
            400
          );
        }

        if (rzpPayment.currency && rzpPayment.currency.toUpperCase() !== payment.currency.toUpperCase()) {
          throw new AppError(
            ERROR_CODES.CURRENCY_MISMATCH,
            `Paid currency (${rzpPayment.currency}) does not match expected (${payment.currency}).`,
            400
          );
        }
      }
    } catch (fetchErr) {
      if (fetchErr instanceof AppError) throw fetchErr;
      // In offline/test environments, log and proceed with cryptographic HMAC verification
      console.warn('[PaymentService.verifyPayment] Remote payment fetch skipped/unavailable:', fetchErr.message);
    }

    // 5. Atomically Confirm Booking, Capture Payment, and Enqueue Outbox Notification
    const { booking, alreadyConfirmed } = await bookingRepository.confirmBookingWithPaymentAtomic({
      bookingReference: payment.bookingReference,
      paymentId: payment.id,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      paymentMethod: 'razorpay',
    });

    // 6. Asynchronously trigger confirmation email (non-blocking)
    if (!alreadyConfirmed) {
      notificationService
        .sendBookingConfirmationSafe({
          email: booking.guest?.email || booking.guest_email,
          guestName: booking.guest?.fullName || booking.guest_name,
          bookingDetails: {
            bookingReference: booking.bookingReference || booking.booking_reference,
            hotelName: booking.hotelName || booking.hotel_name,
            roomName: booking.roomName || booking.room_name,
            checkIn: booking.checkIn || booking.check_in,
            checkOut: booking.checkOut || booking.check_out,
            nights: booking.nights,
            roomsCount: booking.roomsCount || booking.rooms_count,
            totalAmount: Number(booking.totalAmount || booking.total_amount),
            currency: booking.currency || 'INR',
          },
        })
        .catch((emailErr) => {
          console.error('[PaymentService.verifyPayment] Email dispatch error caught:', emailErr.message);
        });
    }

    return {
      success: true,
      bookingReference: booking.bookingReference || booking.booking_reference,
      status: 'CONFIRMED',
      paymentId: razorpay_payment_id,
      amount: payment.amount,
      currency: payment.currency,
      alreadyConfirmed,
    };
  }

  /**
   * Handles incoming Razorpay Webhook events idempotently.
   *
   * @param {object} params
   * @param {string|Buffer} params.rawBody
   * @param {string} params.signature
   * @param {object} params.event
   * @returns {Promise<{ received: boolean }>}
   */
  async handleWebhook({ rawBody, signature, event }) {
    // 1. Verify Webhook Signature if secret configured
    if (env.razorpay.webhookSecret && signature) {
      try {
        const expectedSignature = crypto
          .createHmac('sha256', env.razorpay.webhookSecret)
          .update(rawBody)
          .digest('hex');

        const expectedBuf = Buffer.from(expectedSignature, 'utf-8');
        const actualBuf = Buffer.from(signature, 'utf-8');

        const isValid =
          expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);

        if (!isValid) {
          throw new AppError(ERROR_CODES.INVALID_PAYMENT_SIGNATURE, 'Invalid webhook signature.', 400);
        }
      } catch (sigErr) {
        if (sigErr instanceof AppError) throw sigErr;
        throw new AppError(ERROR_CODES.INVALID_PAYMENT_SIGNATURE, 'Webhook signature verification failed.', 400);
      }
    }

    // 2. Dispatch events safely
    const eventType = event.event;
    const payload = event.payload || {};

    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const paymentEntity = payload.payment?.entity;
      const orderId = paymentEntity?.order_id || payload.order?.entity?.id;
      const paymentId = paymentEntity?.id;

      if (orderId && paymentId) {
        const payment = await paymentRepository.findByOrderId(orderId);
        if (payment && payment.status !== 'CAPTURED') {
          await bookingRepository.confirmBookingWithPaymentAtomic({
            bookingReference: payment.bookingReference,
            paymentId: payment.id,
            razorpayOrderId: orderId,
            razorpayPaymentId: paymentId,
            razorpaySignature: 'WEBHOOK_VERIFIED',
            paymentMethod: paymentEntity?.method || 'razorpay_webhook',
          });
        }
      }
    } else if (eventType === 'payment.failed') {
      const paymentEntity = payload.payment?.entity;
      const orderId = paymentEntity?.order_id;
      if (orderId) {
        const payment = await paymentRepository.findByOrderId(orderId);
        if (payment && payment.status === 'CREATED') {
          await paymentRepository.updateStatus(payment.id, {
            status: 'FAILED',
            razorpayPaymentId: paymentEntity?.id,
            errorCode: paymentEntity?.error_code,
            errorDescription: paymentEntity?.error_description,
            failedAt: new Date(),
          });
        }
      }
    }

    return { received: true };
  }

  /**
   * Periodic background routine to release inventory for reservations that expired without payment.
   *
   * @returns {Promise<Array<string>>}
   */
  async expirePendingReservations() {
    return await bookingRepository.expirePendingBookingsAtomic();
  }

  /**
   * Retrieves full booking details along with its payment transaction record.
   * Used by confirmation page for authoritative display.
   *
   * @param {string} bookingReference
   * @returns {Promise<object>}
   */
  async getBookingPaymentDetails(bookingReference) {
    if (!bookingReference) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Booking reference is required.', 400);
    }

    const booking = await bookingRepository.findByReference(bookingReference);
    if (!booking) {
      throw new AppError(ERROR_CODES.BOOKING_NOT_FOUND, ERROR_MESSAGES[ERROR_CODES.BOOKING_NOT_FOUND], 404);
    }

    const payments = await paymentRepository.findByBookingId(booking.id);
    const successfulPayment = payments.find((p) => p.status === 'CAPTURED') || payments[0] || null;

    return {
      booking: {
        bookingReference: booking.bookingReference,
        status: booking.status,
        hotelName: booking.hotelName,
        roomName: booking.roomName,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        nights: booking.nights,
        roomsCount: booking.roomsCount,
        nightlyPriceSnapshot: booking.nightlyPriceSnapshot,
        totalAmount: booking.totalAmount,
        currency: booking.currency || 'INR',
        createdAt: booking.createdAt,
        expiresAt: booking.expiresAt,
        guest: booking.guest,
      },
      payment: successfulPayment
        ? {
            id: successfulPayment.id,
            razorpayOrderId: successfulPayment.razorpayOrderId,
            razorpayPaymentId: successfulPayment.razorpayPaymentId,
            status: successfulPayment.status,
            amount: successfulPayment.amount,
            currency: successfulPayment.currency,
            capturedAt: successfulPayment.capturedAt,
          }
        : null,
    };
  }
}

export const paymentService = new PaymentService();
export default paymentService;
