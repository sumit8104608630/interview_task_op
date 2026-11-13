import { query, checkDatabaseConnection } from '../database/connection.js';
import crypto from 'crypto';

/**
 * Payment Data Access Repository
 * Handles Razorpay order-payment ledger transactions, status updates, and lookup.
 */
export class PaymentRepository {
  constructor() {
    this._forceInMemory = false;
    this._inMemoryPayments = new Map();
  }

  setForceInMemory(force = true) {
    this._forceInMemory = force;
  }

  reset() {
    this._inMemoryPayments.clear();
  }

  async _usePostgres() {
    if (this._forceInMemory) return false;
    const health = await checkDatabaseConnection();
    return health.healthy;
  }

  /**
   * Persists a new payment record linked to a booking and Razorpay order ID.
   *
   * @param {object} params
   * @param {string} params.bookingId
   * @param {string} params.razorpayOrderId
   * @param {number} params.amount
   * @param {string} [params.currency='INR']
   * @param {'CREATED'|'AUTHORIZED'|'CAPTURED'|'FAILED'|'REFUNDED'} [params.status='CREATED']
   * @param {object} [client] - Optional active PostgreSQL transaction client
   * @returns {Promise<object>}
   */
  async createPayment(
    {
      bookingId,
      bookingReference = null,
      razorpayOrderId,
      amount,
      currency = 'INR',
      status = 'CREATED',
    },
    client = null
  ) {
    const now = new Date();

    if (await this._usePostgres()) {
      const sql = `
        INSERT INTO payments (
          booking_id, razorpay_order_id, amount, currency, status, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $6)
        RETURNING 
          id,
          booking_id AS "bookingId",
          razorpay_order_id AS "razorpayOrderId",
          razorpay_payment_id AS "razorpayPaymentId",
          razorpay_signature AS "razorpaySignature",
          amount,
          currency,
          status,
          created_at AS "createdAt",
          updated_at AS "updatedAt";
      `;
      const values = [bookingId, razorpayOrderId, amount, currency, status, now];
      const res = client ? await client.query(sql, values) : await query(sql, values);
      return { ...res.rows[0], bookingReference };
    }

    // In-memory fallback
    const id = crypto.randomUUID();
    const record = {
      id,
      bookingId,
      bookingReference,
      razorpayOrderId,
      razorpayPaymentId: null,
      razorpaySignature: null,
      amount: Number(amount),
      currency,
      status,
      paymentMethod: null,
      errorCode: null,
      errorDescription: null,
      createdAt: now,
      updatedAt: now,
      capturedAt: null,
      failedAt: null,
    };
    this._inMemoryPayments.set(id, record);
    return record;
  }

  /**
   * Finds a payment record by its Razorpay Order ID
   *
   * @param {string} razorpayOrderId
   * @returns {Promise<object|null>}
   */
  async findByOrderId(razorpayOrderId) {
    if (!razorpayOrderId) return null;

    if (await this._usePostgres()) {
      const sql = `
        SELECT 
          p.id,
          p.booking_id AS "bookingId",
          p.razorpay_order_id AS "razorpayOrderId",
          p.razorpay_payment_id AS "razorpayPaymentId",
          p.razorpay_signature AS "razorpaySignature",
          p.amount,
          p.currency,
          p.status,
          p.payment_method AS "paymentMethod",
          p.created_at AS "createdAt",
          p.updated_at AS "updatedAt",
          p.captured_at AS "capturedAt",
          b.booking_reference AS "bookingReference",
          b.status AS "bookingStatus",
          b.total_amount AS "bookingTotalAmount",
          b.expires_at AS "bookingExpiresAt"
        FROM payments p
        JOIN bookings b ON b.id = p.booking_id
        WHERE p.razorpay_order_id = $1
        LIMIT 1;
      `;
      const res = await query(sql, [razorpayOrderId]);
      return res.rows[0] || null;
    }

    for (const payment of this._inMemoryPayments.values()) {
      if (payment.razorpayOrderId === razorpayOrderId) {
        if (!payment.bookingReference) {
          const { bookingRepository } = await import('./booking.repository.js');
          for (const b of bookingRepository.inMemoryBookings.values()) {
            if (b.id === payment.bookingId) {
              payment.bookingReference = b.bookingReference;
              payment.bookingStatus = b.status;
              payment.bookingTotalAmount = b.totalAmount;
              payment.bookingExpiresAt = b.expiresAt;
              break;
            }
          }
        }
        return { ...payment };
      }
    }
    return null;
  }

  /**
   * Finds all payments for a given booking ID
   *
   * @param {string} bookingId
   * @returns {Promise<Array<object>>}
   */
  async findByBookingId(bookingId) {
    if (!bookingId) return [];

    if (await this._usePostgres()) {
      const sql = `
        SELECT 
          id,
          booking_id AS "bookingId",
          razorpay_order_id AS "razorpayOrderId",
          razorpay_payment_id AS "razorpayPaymentId",
          amount,
          currency,
          status,
          created_at AS "createdAt",
          updated_at AS "updatedAt",
          captured_at AS "capturedAt"
        FROM payments
        WHERE booking_id = $1
        ORDER BY created_at DESC;
      `;
      const res = await query(sql, [bookingId]);
      return res.rows;
    }

    const matches = [];
    for (const payment of this._inMemoryPayments.values()) {
      if (payment.bookingId === bookingId) {
        matches.push({ ...payment });
      }
    }
    return matches.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Finds an existing active / created order for a booking to ensure order creation idempotency.
   *
   * @param {string} bookingId
   * @returns {Promise<object|null>}
   */
  async findActiveOrderForBooking(bookingId) {
    if (!bookingId) return null;

    if (await this._usePostgres()) {
      const sql = `
        SELECT 
          id,
          booking_id AS "bookingId",
          razorpay_order_id AS "razorpayOrderId",
          amount,
          currency,
          status,
          created_at AS "createdAt"
        FROM payments
        WHERE booking_id = $1 AND status = 'CREATED'
        ORDER BY created_at DESC
        LIMIT 1;
      `;
      const res = await query(sql, [bookingId]);
      return res.rows[0] || null;
    }

    for (const payment of this._inMemoryPayments.values()) {
      if (payment.bookingId === bookingId && payment.status === 'CREATED') {
        return { ...payment };
      }
    }
    return null;
  }

  /**
   * Updates payment record status, captured timestamp, or error details.
   *
   * @param {string} id
   * @param {object} updates
   * @param {object} [client] - Optional active PostgreSQL transaction client
   * @returns {Promise<object>}
   */
  async updateStatus(id, updates = {}, client = null) {
    const {
      status,
      razorpayPaymentId = null,
      razorpaySignature = null,
      paymentMethod = null,
      errorCode = null,
      errorDescription = null,
      capturedAt = null,
      failedAt = null,
    } = updates;

    const now = new Date();

    if (await this._usePostgres()) {
      const sql = `
        UPDATE payments
        SET 
          status = COALESCE($1, status),
          razorpay_payment_id = COALESCE($2, razorpay_payment_id),
          razorpay_signature = COALESCE($3, razorpay_signature),
          payment_method = COALESCE($4, payment_method),
          error_code = COALESCE($5, error_code),
          error_description = COALESCE($6, error_description),
          captured_at = COALESCE($7, captured_at),
          failed_at = COALESCE($8, failed_at),
          updated_at = $9
        WHERE id = $10
        RETURNING 
          id,
          booking_id AS "bookingId",
          razorpay_order_id AS "razorpayOrderId",
          razorpay_payment_id AS "razorpayPaymentId",
          amount,
          currency,
          status,
          captured_at AS "capturedAt",
          updated_at AS "updatedAt";
      `;
      const values = [
        status,
        razorpayPaymentId,
        razorpaySignature,
        paymentMethod,
        errorCode,
        errorDescription,
        capturedAt,
        failedAt,
        now,
        id,
      ];
      const res = client ? await client.query(sql, values) : await query(sql, values);
      return res.rows[0] || null;
    }

    const record = this._inMemoryPayments.get(id);
    if (!record) return null;

    if (status) record.status = status;
    if (razorpayPaymentId) record.razorpayPaymentId = razorpayPaymentId;
    if (razorpaySignature) record.razorpaySignature = razorpaySignature;
    if (paymentMethod) record.paymentMethod = paymentMethod;
    if (errorCode) record.errorCode = errorCode;
    if (errorDescription) record.errorDescription = errorDescription;
    if (capturedAt) record.capturedAt = capturedAt;
    if (failedAt) record.failedAt = failedAt;
    record.updatedAt = now;

    this._inMemoryPayments.set(id, record);
    return { ...record };
  }
}

export const paymentRepository = new PaymentRepository();
export default paymentRepository;
