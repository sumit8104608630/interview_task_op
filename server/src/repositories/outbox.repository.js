import { getClient, query, checkDatabaseConnection } from '../database/connection.js';

/**
 * Async Mutex for in-memory concurrency testing
 */
class AsyncMutex {
  constructor() {
    this._queue = Promise.resolve();
  }

  async acquire() {
    let release;
    const next = new Promise((resolve) => {
      release = resolve;
    });
    const wait = this._queue.then(() => release);
    this._queue = this._queue.then(() => next);
    return wait;
  }
}

/**
 * Notification Outbox Data Access Repository
 * Implements transactional outbox creation, safe row-locking batch claiming,
 * leasing to prevent duplicate concurrent processing, and status tracking.
 */
export class OutboxRepository {
  constructor() {
    this._forceInMemory = false;
    this._inMemoryEvents = [];
    this._mutex = new AsyncMutex();
  }

  setForceInMemory(force = true) {
    this._forceInMemory = force;
  }

  reset() {
    this._inMemoryEvents = [];
  }

  async _usePostgres() {
    if (this._forceInMemory) return false;
    const health = await checkDatabaseConnection();
    return health.healthy;
  }

  /**
   * Enqueues an outbox event.
   * If a client is provided, participates in an ongoing atomic database transaction.
   *
   * @param {object} params
   * @param {string} params.bookingId
   * @param {'BOOKING_CONFIRMED'|'BOOKING_CANCELLED'} params.eventType
   * @param {string} params.idempotencyKey
   * @param {object} params.payload
   * @param {object} [client] - Optional active pg transaction client
   * @returns {Promise<object>}
   */
  async createEvent({ bookingId, eventType, idempotencyKey, payload }, client = null) {
    if (await this._usePostgres()) {
      const sql = `
        INSERT INTO notification_outbox (
          booking_id, event_type, idempotency_key, payload, status, next_attempt_at, created_at
        )
        VALUES ($1, $2, $3, $4::jsonb, 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (idempotency_key) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
        RETURNING id, booking_id AS "bookingId", event_type AS "eventType",
                  idempotency_key AS "idempotencyKey", payload, status,
                  attempts, next_attempt_at AS "nextAttemptAt", last_error AS "lastError",
                  created_at AS "createdAt", sent_at AS "sentAt";
      `;

      // If existing schema doesn't have updated_at on notification_outbox, fallback to DO NOTHING
      const safeSql = `
        INSERT INTO notification_outbox (
          booking_id, event_type, idempotency_key, payload, status, next_attempt_at, created_at
        )
        VALUES ($1, $2, $3, $4::jsonb, 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id, booking_id AS "bookingId", event_type AS "eventType",
                  idempotency_key AS "idempotencyKey", payload, status,
                  attempts, next_attempt_at AS "nextAttemptAt", last_error AS "lastError",
                  created_at AS "createdAt", sent_at AS "sentAt";
      `;

      try {
        const executor = client || { query };
        const res = await executor.query(safeSql, [
          bookingId,
          eventType,
          idempotencyKey,
          JSON.stringify(payload),
        ]);

        if (res.rows.length > 0) {
          return res.rows[0];
        }

        // Row already existed due to idempotency conflict, fetch existing
        const existing = await (client || { query }).query(
          `SELECT id, booking_id AS "bookingId", event_type AS "eventType",
                  idempotency_key AS "idempotencyKey", payload, status,
                  attempts, next_attempt_at AS "nextAttemptAt", last_error AS "lastError",
                  created_at AS "createdAt", sent_at AS "sentAt"
           FROM notification_outbox WHERE idempotency_key = $1`,
          [idempotencyKey]
        );
        return existing.rows[0];
      } catch (err) {
        console.error('[OutboxRepository.createEvent] DB error:', err.message);
        throw err;
      }
    }

    // In-memory fallback
    const release = await this._mutex.acquire();
    try {
      const existing = this._inMemoryEvents.find((e) => e.idempotencyKey === idempotencyKey);
      if (existing) {
        return existing;
      }

      const newEvent = {
        id: `outbox-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        bookingId,
        eventType,
        idempotencyKey,
        payload: { ...payload },
        status: 'PENDING',
        attempts: 0,
        nextAttemptAt: new Date(),
        lastError: null,
        createdAt: new Date(),
        sentAt: null,
      };

      this._inMemoryEvents.push(newEvent);
      return newEvent;
    } finally {
      release();
    }
  }

  /**
   * Safely claims due PENDING notifications using FOR UPDATE SKIP LOCKED
   * Atomically leases them by advancing next_attempt_at so competing workers skip them.
   *
   * @param {number} [batchSize=10]
   * @param {number} [leaseDurationSec=120]
   * @returns {Promise<Array<object>>}
   */
  async claimDueEvents(batchSize = 10, leaseDurationSec = 120) {
    if (await this._usePostgres()) {
      const sql = `
        WITH claimed AS (
          SELECT id
          FROM notification_outbox
          WHERE status = 'PENDING'
            AND next_attempt_at <= CURRENT_TIMESTAMP
          ORDER BY next_attempt_at ASC, created_at ASC
          LIMIT $1
          FOR UPDATE SKIP LOCKED
        )
        UPDATE notification_outbox n
        SET next_attempt_at = CURRENT_TIMESTAMP + ($2 || ' seconds')::INTERVAL
        FROM claimed
        WHERE n.id = claimed.id
        RETURNING n.id, n.booking_id AS "bookingId", n.event_type AS "eventType",
                  n.idempotency_key AS "idempotencyKey", n.payload, n.status,
                  n.attempts, n.next_attempt_at AS "nextAttemptAt", n.last_error AS "lastError",
                  n.created_at AS "createdAt", n.sent_at AS "sentAt";
      `;

      const res = await query(sql, [batchSize, leaseDurationSec.toString()]);
      return res.rows;
    }

    // In-memory fallback with atomic lease acquisition
    const release = await this._mutex.acquire();
    try {
      const now = new Date();
      const due = this._inMemoryEvents
        .filter((e) => e.status === 'PENDING' && new Date(e.nextAttemptAt) <= now)
        .slice(0, batchSize);

      for (const event of due) {
        event.nextAttemptAt = new Date(Date.now() + leaseDurationSec * 1000);
      }

      return due.map((e) => ({ ...e, payload: { ...e.payload } }));
    } finally {
      release();
    }
  }

  /**
   * Marks an outbox event as successfully SENT
   *
   * @param {string} id
   * @returns {Promise<void>}
   */
  async markSent(id) {
    if (await this._usePostgres()) {
      await query(
        `UPDATE notification_outbox
         SET status = 'SENT',
             sent_at = CURRENT_TIMESTAMP,
             last_error = NULL
         WHERE id = $1`,
        [id]
      );
      return;
    }

    const release = await this._mutex.acquire();
    try {
      const event = this._inMemoryEvents.find((e) => e.id === id);
      if (event) {
        event.status = 'SENT';
        event.sentAt = new Date();
        event.lastError = null;
      }
    } finally {
      release();
    }
  }

  /**
   * Records a failure attempt:
   * Either reschedules with exponential backoff or marks FAILED if max attempts exceeded.
   *
   * @param {string} id
   * @param {object} params
   * @param {number} params.attempts
   * @param {Date} params.nextAttemptAt
   * @param {boolean} params.isFailed
   * @param {string} params.lastError
   * @returns {Promise<void>}
   */
  async recordFailure(id, { attempts, nextAttemptAt, isFailed, lastError }) {
    const status = isFailed ? 'FAILED' : 'PENDING';
    const safeError = typeof lastError === 'string' ? lastError.slice(0, 1000) : 'Unknown error';

    if (await this._usePostgres()) {
      await query(
        `UPDATE notification_outbox
         SET status = $2,
             attempts = $3,
             next_attempt_at = $4,
             last_error = $5
         WHERE id = $1`,
        [id, status, attempts, nextAttemptAt.toISOString(), safeError]
      );
      return;
    }

    const release = await this._mutex.acquire();
    try {
      const event = this._inMemoryEvents.find((e) => e.id === id);
      if (event) {
        event.status = status;
        event.attempts = attempts;
        event.nextAttemptAt = nextAttemptAt;
        event.lastError = safeError;
      }
    } finally {
      release();
    }
  }

  /**
   * Resets next_attempt_at for an event (useful for test acceleration or manual retries)
   * @param {string} id
   * @param {Date} [nextAttemptAt=new Date()]
   * @returns {Promise<void>}
   */
  async resetNextAttemptAt(id, nextAttemptAt = new Date()) {
    if (await this._usePostgres()) {
      await query(
        `UPDATE notification_outbox SET next_attempt_at = $2 WHERE id = $1`,
        [id, nextAttemptAt.toISOString()]
      );
      return;
    }

    const release = await this._mutex.acquire();
    try {
      const event = this._inMemoryEvents.find((e) => e.id === id);
      if (event) {
        event.nextAttemptAt = nextAttemptAt;
      }
    } finally {
      release();
    }
  }

  /**
   * Retrieves an outbox event by its ID
   *
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async getById(id) {
    if (await this._usePostgres()) {
      const res = await query(
        `SELECT id, booking_id AS "bookingId", event_type AS "eventType",
                idempotency_key AS "idempotencyKey", payload, status,
                attempts, next_attempt_at AS "nextAttemptAt", last_error AS "lastError",
                created_at AS "createdAt", sent_at AS "sentAt"
         FROM notification_outbox WHERE id = $1`,
        [id]
      );
      return res.rows[0] || null;
    }

    const event = this._inMemoryEvents.find((e) => e.id === id);
    return event ? { ...event, payload: { ...event.payload } } : null;
  }

  /**
   * Retrieves all outbox events for a booking
   *
   * @param {string} bookingId
   * @returns {Promise<Array<object>>}
   */
  async getByBookingId(bookingId) {
    if (await this._usePostgres()) {
      const res = await query(
        `SELECT id, booking_id AS "bookingId", event_type AS "eventType",
                idempotency_key AS "idempotencyKey", payload, status,
                attempts, next_attempt_at AS "nextAttemptAt", last_error AS "lastError",
                created_at AS "createdAt", sent_at AS "sentAt"
         FROM notification_outbox WHERE booking_id = $1
         ORDER BY created_at ASC`,
        [bookingId]
      );
      return res.rows;
    }

    return this._inMemoryEvents
      .filter((e) => e.bookingId === bookingId)
      .map((e) => ({ ...e, payload: { ...e.payload } }));
  }

  /**
   * Retrieves all events in the outbox (useful for test assertions)
   * @returns {Promise<Array<object>>}
   */
  async getAllEvents() {
    if (await this._usePostgres()) {
      const res = await query(
        `SELECT id, booking_id AS "bookingId", event_type AS "eventType",
                idempotency_key AS "idempotencyKey", payload, status,
                attempts, next_attempt_at AS "nextAttemptAt", last_error AS "lastError",
                created_at AS "createdAt", sent_at AS "sentAt"
         FROM notification_outbox
         ORDER BY created_at ASC`
      );
      return res.rows;
    }

    return this._inMemoryEvents.map((e) => ({ ...e, payload: { ...e.payload } }));
  }
}

export const outboxRepository = new OutboxRepository();
export default outboxRepository;
