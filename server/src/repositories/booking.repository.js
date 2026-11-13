import { getClient, query, checkDatabaseConnection } from '../database/connection.js';
import { roomRepository } from './room.repository.js';
import { generateBookingReference } from '../utils/generateBookingReference.js';
import { getStayDates, calculateNights, isCancellationEligible } from '../utils/dateUtils.js';
import { AppError } from '../middleware/error.middleware.js';
import { ERROR_CODES, ERROR_MESSAGES } from '../constants/errorMessages.js';
import crypto from 'crypto';

/**
 * Async Mutex for in-memory concurrency control
 * Ensures simultaneous booking attempts against the same room type serialize their checks and decrements.
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
 * Booking and Guest Data Access Repository
 * Handles transactional booking creation, row-level inventory locks, guest records, and idempotent lookups.
 */
export class BookingRepository {
  constructor() {
    this.forceInMemory = false;
    this.inMemoryBookings = new Map();
    this.inMemoryGuests = new Map();
    this.inMemoryGuestSessions = new Map();
    this.inMemoryOutbox = [];
    this.mutex = new AsyncMutex();
  }

  setForceInMemory(flag) {
    this.forceInMemory = flag;
    if (!flag) {
      this.reset();
    }
  }

  reset() {
    this.inMemoryBookings.clear();
    this.inMemoryGuests.clear();
    this.inMemoryGuestSessions.clear();
    this.inMemoryOutbox = [];
  }

  async _usePostgres() {
    if (this.forceInMemory) return false;
    const health = await checkDatabaseConnection();
    return health.healthy;
  }

  /**
   * Atomically reserves room inventory, creates the booking and guest record,
   * and records a notification outbox event inside a database transaction.
   *
   * @param {object} params
   * @param {string} params.roomTypeId
   * @param {string} params.checkIn - YYYY-MM-DD
   * @param {string} params.checkOut - YYYY-MM-DD
   * @param {number} [params.roomsCount=1]
   * @param {number} [params.guests=1]
   * @param {string} params.guestName
   * @param {string} params.guestEmail
   * @param {string} [params.guestPhone]
   * @param {string|null} [params.customerId=null]
   * @param {string|null} [params.idempotencyKey=null]
   * @returns {Promise<object>} Created booking with guest details
   */
  async createBookingAtomic({
    roomTypeId,
    checkIn,
    checkOut,
    roomsCount = 1,
    guests = 1,
    guestName,
    guestEmail,
    guestPhone = null,
    customerId = null,
    idempotencyKey = null,
  }) {
    const stayDates = getStayDates(checkIn, checkOut);
    const nights = stayDates.length;

    if (await this._usePostgres()) {
      const client = await getClient();
      try {
        await client.query('BEGIN');

        // 1. Idempotency Check
        if (idempotencyKey) {
          const existingRes = await client.query(
            `SELECT b.*, bg.full_name AS guest_name, bg.email AS guest_email, bg.phone AS guest_phone,
                    rt.name AS room_name, h.name AS hotel_name
             FROM bookings b
             JOIN booking_guests bg ON bg.booking_id = b.id
             JOIN room_types rt ON rt.id = b.room_type_id
             JOIN hotels h ON h.id = rt.hotel_id
             WHERE b.idempotency_key = $1
             LIMIT 1;`,
            [idempotencyKey]
          );

          if (existingRes.rows.length > 0) {
            await client.query('COMMIT');
            const row = existingRes.rows[0];
            return {
              id: row.id,
              bookingReference: row.booking_reference,
              customerId: row.customer_id,
              roomTypeId: row.room_type_id,
              hotelName: row.hotel_name,
              roomName: row.room_name,
              checkIn: row.check_in,
              checkOut: row.check_out,
              nights: row.nights,
              roomsCount: row.rooms_count,
              nightlyPriceSnapshot: Number(row.nightly_price_snapshot),
              totalAmount: Number(row.total_amount),
              status: row.status,
              createdAt: row.created_at,
              guest: {
                fullName: row.guest_name,
                email: row.guest_email,
                phone: row.guest_phone,
              },
              isExisting: true,
            };
          }
        }

        // 2. Validate Room Category & Hotel Active Status
        const roomRes = await client.query(
          `SELECT rt.*, h.name AS hotel_name, h.is_active AS hotel_is_active
           FROM room_types rt
           JOIN hotels h ON h.id = rt.hotel_id
           WHERE rt.id = $1
           FOR SHARE;`,
          [roomTypeId]
        );

        if (roomRes.rows.length === 0) {
          throw new AppError(ERROR_CODES.ROOM_NOT_FOUND, 'The requested room category could not be found.', 404);
        }

        const room = roomRes.rows[0];
        if (!room.active || !room.hotel_is_active) {
          throw new AppError(ERROR_CODES.ROOM_NOT_FOUND, 'The requested room category is inactive or unavailable.', 400);
        }

        // Validate guest capacity
        const minGuestsPerRoom = Math.ceil(guests / roomsCount);
        if (room.max_guests < minGuestsPerRoom) {
          throw new AppError(
            ERROR_CODES.VALIDATION_ERROR,
            `Requested room accommodates up to ${room.max_guests} guests per room, but ${minGuestsPerRoom} guests per room requested.`,
            400
          );
        }

        // 3. Lock Inventory Rows in Sorted Order (FOR UPDATE)
        const invRes = await client.query(
          `SELECT id, TO_CHAR(inventory_date, 'YYYY-MM-DD') AS inventory_date, available_rooms
           FROM room_inventory
           WHERE room_type_id = $1
             AND inventory_date >= $2::date
             AND inventory_date < $3::date
           ORDER BY inventory_date ASC
           FOR UPDATE;`,
          [roomTypeId, checkIn, checkOut]
        );

        const inventoryMap = new Map(invRes.rows.map((r) => [r.inventory_date, r.available_rooms]));

        // Verify every night has inventory record and available_rooms >= roomsCount
        for (const date of stayDates) {
          if (!inventoryMap.has(date)) {
            throw new AppError(
              ERROR_CODES.MISSING_INVENTORY,
              `Room inventory is not configured for ${date}.`,
              400
            );
          }
          const avail = inventoryMap.get(date);
          if (avail < roomsCount) {
            throw new AppError(
              ERROR_CODES.ROOM_UNAVAILABLE,
              `Insufficient rooms available for stay date ${date}. Requested: ${roomsCount}, Available: ${avail}.`,
              409
            );
          }
        }

        // 4. Atomically Decrement Inventory
        await client.query(
          `UPDATE room_inventory
           SET available_rooms = available_rooms - $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE room_type_id = $2
             AND inventory_date >= $3::date
             AND inventory_date < $4::date;`,
          [roomsCount, roomTypeId, checkIn, checkOut]
        );

        // 5. Generate Collision-Resistant Unique Booking Reference
        let bookingReference = null;
        let attempts = 0;
        while (!bookingReference && attempts < 5) {
          attempts += 1;
          const candidate = generateBookingReference('HBP', 8);
          const refCheck = await client.query(
            `SELECT id FROM bookings WHERE booking_reference = $1;`,
            [candidate]
          );
          if (refCheck.rows.length === 0) {
            bookingReference = candidate;
          }
        }

        if (!bookingReference) {
          throw new AppError(ERROR_CODES.INTERNAL_SERVER_ERROR, 'Failed to generate a unique booking reference.', 500);
        }

        // 6. Strict Decimal Arithmetic for Server-Side Pricing
        const pricePerNightNum = Number(room.price_per_night);
        const priceInCents = Math.round(pricePerNightNum * 100);
        const totalInCents = priceInCents * nights * roomsCount;
        const nightlyPriceSnapshot = Number((priceInCents / 100).toFixed(2));
        const totalAmount = Number((totalInCents / 100).toFixed(2));

        // 7. Insert Booking
        const bookingRes = await client.query(
          `INSERT INTO bookings (
             booking_reference, customer_id, room_type_id,
             check_in, check_out, nights, rooms_count,
             nightly_price_snapshot, total_amount, status, idempotency_key
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'CONFIRMED', $10)
           RETURNING *;`,
          [
            bookingReference,
            customerId,
            roomTypeId,
            checkIn,
            checkOut,
            nights,
            roomsCount,
            nightlyPriceSnapshot,
            totalAmount,
            idempotencyKey || null,
          ]
        );
        const booking = bookingRes.rows[0];

        // 8. Insert Booking Guest
        const guestRes = await client.query(
          `INSERT INTO booking_guests (booking_id, full_name, guest_name, email, phone)
           VALUES ($1, $2, $2, $3, $4)
           RETURNING *;`,
          [booking.id, guestName, guestEmail, guestPhone]
        );
        const guest = guestRes.rows[0];

        // 9. Enqueue Notification Outbox Record
        const outboxPayload = {
          bookingReference: booking.booking_reference,
          hotelName: room.hotel_name,
          roomName: room.name,
          checkIn,
          checkOut,
          nights,
          roomsCount,
          nightlyPriceSnapshot,
          totalAmount,
          currency: room.currency || 'INR',
          guestName,
          guestEmail,
          guestPhone,
        };

        await client.query(
          `INSERT INTO notification_outbox (booking_id, event_type, payload, status)
           VALUES ($1, 'BOOKING_CONFIRMATION', $2::jsonb, 'PENDING');`,
          [booking.id, JSON.stringify(outboxPayload)]
        );

        await client.query('COMMIT');

        return {
          id: booking.id,
          bookingReference: booking.booking_reference,
          customerId: booking.customer_id,
          roomTypeId: booking.room_type_id,
          hotelName: room.hotel_name,
          roomName: room.name,
          checkIn: booking.check_in,
          checkOut: booking.check_out,
          nights: booking.nights,
          roomsCount: booking.rooms_count,
          nightlyPriceSnapshot: Number(booking.nightly_price_snapshot),
          totalAmount: Number(booking.total_amount),
          status: booking.status,
          createdAt: booking.created_at,
          guest: {
            fullName: guest.full_name,
            email: guest.email,
            phone: guest.phone,
          },
          isExisting: false,
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

    // ==========================================
    // IN-MEMORY FALLBACK WITH ASYNC MUTEX
    // ==========================================
    const release = await this.mutex.acquire();
    try {
      // 1. Idempotency Check
      if (idempotencyKey) {
        for (const b of this.inMemoryBookings.values()) {
          if (b.idempotencyKey === idempotencyKey) {
            return { ...b, isExisting: true };
          }
        }
      }

      // 2. Room & Hotel Validation
      const room = await roomRepository.findById(roomTypeId);
      if (!room) {
        throw new AppError(ERROR_CODES.ROOM_NOT_FOUND, 'The requested room category could not be found.', 404);
      }
      if (!room.active || !room.hotelIsActive) {
        throw new AppError(ERROR_CODES.ROOM_NOT_FOUND, 'The requested room category is inactive or unavailable.', 400);
      }

      // Capacity Validation
      const minGuestsPerRoom = Math.ceil(guests / roomsCount);
      if (room.maxGuests < minGuestsPerRoom) {
        throw new AppError(
          ERROR_CODES.VALIDATION_ERROR,
          `Requested room accommodates up to ${room.maxGuests} guests per room, but ${minGuestsPerRoom} guests per room requested.`,
          400
        );
      }

      // 3. Check All Stay Dates Availability
      const defaultTotal = room.totalRooms ?? 10;
      const originalInventories = new Map();

      for (const date of stayDates) {
        const avail = roomRepository.getAvailableRoomsForDate(roomTypeId, date, defaultTotal);
        if (avail === null || avail === undefined) {
          throw new AppError(
            ERROR_CODES.MISSING_INVENTORY,
            `Room inventory is not configured for ${date}.`,
            400
          );
        }
        if (avail < roomsCount) {
          throw new AppError(
            ERROR_CODES.ROOM_UNAVAILABLE,
            `Insufficient rooms available for stay date ${date}. Requested: ${roomsCount}, Available: ${avail}.`,
            409
          );
        }
        originalInventories.set(date, avail);
      }

      // 4. Atomically Decrement Inventory (with rollback guarantee)
      try {
        for (const date of stayDates) {
          const currentAvail = originalInventories.get(date);
          roomRepository.setInventory(roomTypeId, date, currentAvail - roomsCount);
        }

        // 5. Generate Collision-Safe Booking Reference
        let bookingReference = null;
        let attempts = 0;
        while (!bookingReference && attempts < 5) {
          attempts += 1;
          const candidate = generateBookingReference('HBP', 8);
          if (!this.inMemoryBookings.has(candidate)) {
            bookingReference = candidate;
          }
        }

        if (!bookingReference) {
          throw new AppError(ERROR_CODES.INTERNAL_SERVER_ERROR, 'Failed to generate unique booking reference.', 500);
        }

        // 6. Decimal Arithmetic
        const pricePerNightNum = Number(room.pricePerNight);
        const priceInCents = Math.round(pricePerNightNum * 100);
        const totalInCents = priceInCents * nights * roomsCount;
        const nightlyPriceSnapshot = Number((priceInCents / 100).toFixed(2));
        const totalAmount = Number((totalInCents / 100).toFixed(2));

        const bookingId = crypto.randomUUID();
        const guestId = crypto.randomUUID();
        const now = new Date().toISOString();

        const createdBooking = {
          id: bookingId,
          bookingReference,
          customerId,
          roomTypeId,
          hotelName: room.hotelName,
          roomName: room.name,
          checkIn,
          checkOut,
          nights,
          roomsCount,
          nightlyPriceSnapshot,
          totalAmount,
          currency: room.currency || 'INR',
          status: 'CONFIRMED',
          idempotencyKey: idempotencyKey || null,
          createdAt: now,
          guest: {
            id: guestId,
            fullName: guestName,
            email: guestEmail,
            phone: guestPhone,
          },
          isExisting: false,
        };

        this.inMemoryBookings.set(bookingReference, createdBooking);
        this.inMemoryOutbox.push({
          id: crypto.randomUUID(),
          bookingId,
          eventType: 'BOOKING_CONFIRMATION',
          payload: {
            bookingReference,
            hotelName: room.hotelName,
            roomName: room.name,
            checkIn,
            checkOut,
            nights,
            roomsCount,
            nightlyPriceSnapshot,
            totalAmount,
            currency: room.currency || 'INR',
            guestName,
            guestEmail,
            guestPhone,
          },
          status: 'PENDING',
          createdAt: now,
        });

        return createdBooking;
      } catch (rollbackErr) {
        // Restore inventory on failure
        for (const [date, originalAvail] of originalInventories.entries()) {
          roomRepository.setInventory(roomTypeId, date, originalAvail);
        }
        throw rollbackErr;
      }
    } finally {
      release();
    }
  }

  /**
   * Looks up a booking by its public reference
   * @param {string} reference
   * @returns {Promise<object|null>}
   */
  async findByReference(reference) {
    if (!reference) return null;

    if (await this._usePostgres()) {
      const sql = `
        SELECT 
          b.id,
          b.booking_reference AS "bookingReference",
          b.customer_id AS "customerId",
          b.room_type_id AS "roomTypeId",
          b.check_in AS "checkIn",
          b.check_out AS "checkOut",
          b.nights,
          b.rooms_count AS "roomsCount",
          b.nightly_price_snapshot AS "nightlyPriceSnapshot",
          b.total_amount AS "totalAmount",
          b.status,
          b.created_at AS "createdAt",
          b.cancelled_at AS "cancelledAt",
          bg.full_name AS "guestName",
          bg.email AS "guestEmail",
          bg.phone AS "guestPhone",
          rt.name AS "roomName",
          h.name AS "hotelName",
          h.id AS "hotelId"
        FROM bookings b
        JOIN booking_guests bg ON bg.booking_id = b.id
        JOIN room_types rt ON rt.id = b.room_type_id
        JOIN hotels h ON h.id = rt.hotel_id
        WHERE b.booking_reference = $1
        LIMIT 1;
      `;
      const result = await query(sql, [reference.trim()]);
      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      return {
        ...row,
        nightlyPriceSnapshot: Number(row.nightlyPriceSnapshot),
        totalAmount: Number(row.totalAmount),
        guest: {
          fullName: row.guestName,
          email: row.guestEmail,
          phone: row.guestPhone,
        },
      };
    }

    return this.inMemoryBookings.get(reference.trim()) || null;
  }

  /**
   * Verifies and looks up a booking by reference code and guest email
   * Prevents leaking whether a reference exists if email does not match.
   * @param {string} reference
   * @param {string} email
   * @returns {Promise<object|null>}
   */
  async findByReferenceAndEmail(reference, email) {
    if (!reference || !email) return null;

    if (await this._usePostgres()) {
      const sql = `
        SELECT 
          b.id,
          b.booking_reference AS "bookingReference",
          b.customer_id AS "customerId",
          b.room_type_id AS "roomTypeId",
          b.check_in AS "checkIn",
          b.check_out AS "checkOut",
          b.nights,
          b.rooms_count AS "roomsCount",
          b.nightly_price_snapshot AS "nightlyPriceSnapshot",
          b.total_amount AS "totalAmount",
          b.status,
          b.created_at AS "createdAt",
          b.cancelled_at AS "cancelledAt",
          bg.full_name AS "guestName",
          bg.email AS "guestEmail",
          bg.phone AS "guestPhone",
          rt.name AS "roomName",
          h.name AS "hotelName",
          h.id AS "hotelId"
        FROM bookings b
        JOIN booking_guests bg ON bg.booking_id = b.id
        JOIN room_types rt ON rt.id = b.room_type_id
        JOIN hotels h ON h.id = rt.hotel_id
        WHERE b.booking_reference = $1 AND LOWER(bg.email) = LOWER($2)
        LIMIT 1;
      `;
      const result = await query(sql, [reference.trim(), email.trim()]);
      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      return {
        ...row,
        nightlyPriceSnapshot: Number(row.nightlyPriceSnapshot),
        totalAmount: Number(row.totalAmount),
        guest: {
          fullName: row.guestName,
          email: row.guestEmail,
          phone: row.guestPhone,
        },
      };
    }

    const booking = this.inMemoryBookings.get(reference.trim());
    if (!booking) return null;

    if (booking.guest?.email?.toLowerCase() !== email.trim().toLowerCase()) {
      return null;
    }

    return booking;
  }

  /**
   * Retrieves all bookings belonging to a registered customer with pagination and status filter
   *
   * @param {object} params
   * @param {string} params.customerId
   * @param {number} [params.page=1]
   * @param {number} [params.limit=10]
   * @param {'CONFIRMED'|'CANCELLED'|null} [params.status=null]
   * @returns {Promise<{ bookings: Array<object>, total: number }>}
   */
  async findByCustomerId({ customerId, page = 1, limit = 10, status = null }) {
    if (!customerId) return { bookings: [], total: 0 };

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 10));
    const offset = (safePage - 1) * safeLimit;

    if (await this._usePostgres()) {
      const sql = `
        SELECT 
          b.id,
          b.booking_reference AS "bookingReference",
          b.customer_id AS "customerId",
          b.room_type_id AS "roomTypeId",
          b.check_in AS "checkIn",
          b.check_out AS "checkOut",
          b.nights,
          b.rooms_count AS "roomsCount",
          b.nightly_price_snapshot AS "nightlyPriceSnapshot",
          b.total_amount AS "totalAmount",
          b.status,
          b.created_at AS "createdAt",
          b.cancelled_at AS "cancelledAt",
          bg.full_name AS "guestName",
          bg.email AS "guestEmail",
          bg.phone AS "guestPhone",
          rt.name AS "roomName",
          h.name AS "hotelName",
          h.id AS "hotelId"
        FROM bookings b
        JOIN booking_guests bg ON bg.booking_id = b.id
        JOIN room_types rt ON rt.id = b.room_type_id
        JOIN hotels h ON h.id = rt.hotel_id
        WHERE b.customer_id = $1
          AND ($2::text IS NULL OR b.status = $2)
        ORDER BY b.created_at DESC
        LIMIT $3 OFFSET $4;
      `;

      const countSql = `
        SELECT COUNT(*) AS total
        FROM bookings b
        WHERE b.customer_id = $1
          AND ($2::text IS NULL OR b.status = $2);
      `;

      const [res, countRes] = await Promise.all([
        query(sql, [customerId, status, safeLimit, offset]),
        query(countSql, [customerId, status]),
      ]);

      const total = parseInt(countRes.rows[0]?.total || 0, 10);
      const bookings = res.rows.map((row) => ({
        ...row,
        nightlyPriceSnapshot: Number(row.nightlyPriceSnapshot),
        totalAmount: Number(row.totalAmount),
        guest: {
          fullName: row.guestName,
          email: row.guestEmail,
          phone: row.guestPhone,
        },
      }));

      return { bookings, total };
    }

    // In-memory fallback
    let list = Array.from(this.inMemoryBookings.values()).filter(
      (b) => b.customerId === customerId
    );

    if (status) {
      list = list.filter((b) => b.status === status);
    }

    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = list.length;
    const paginated = list.slice(offset, offset + safeLimit);

    return { bookings: paginated, total };
  }

  /**
   * Creates a single-use, booking-scoped authorization session / proof
   *
   * @param {object} params
   * @param {string} params.bookingId
   * @param {string} params.email
   * @param {'CANCELLATION'|'BOOKING'} params.purpose
   * @param {number} [params.expiresInMinutes=15]
   * @returns {Promise<{ token: string, expiresAt: string }>}
   */
  async createGuestSession({ bookingId, email, purpose = 'CANCELLATION', expiresInMinutes = 15 }) {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();

    if (await this._usePostgres()) {
      const sql = `
        INSERT INTO guest_sessions (booking_id, email, purpose, token_hash, expires_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, expires_at;
      `;
      await query(sql, [bookingId, email.trim().toLowerCase(), purpose, tokenHash, expiresAt]);
      return { token, expiresAt };
    }

    // In-memory fallback
    const id = crypto.randomUUID();
    this.inMemoryGuestSessions.set(token, {
      id,
      bookingId,
      email: email.trim().toLowerCase(),
      purpose,
      token,
      tokenHash,
      expiresAt,
      consumedAt: null,
      createdAt: new Date().toISOString(),
    });

    return { token, expiresAt };
  }

  /**
   * Atomically verifies cancellation proof, locks booking, validates deadline,
   * updates status to CANCELLED, restores room inventory, and enqueues outbox event.
   *
   * @param {object} params
   * @param {string} params.bookingReference
   * @param {string} params.email
   * @param {string} params.cancellationProof
   * @param {string} [params.reason]
   * @returns {Promise<object>} Cancelled booking details
   */
  async cancelBookingAtomic({ bookingReference, email, cancellationProof, reason = null }) {
    if (!bookingReference || !email) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Booking reference and email are required.', 400);
    }
    if (!cancellationProof) {
      throw new AppError(ERROR_CODES.INVALID_CANCELLATION_PROOF, 'Cancellation authorization proof is required.', 400);
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (await this._usePostgres()) {
      const client = await getClient();
      try {
        await client.query('BEGIN');

        // 1. Lock the booking and retrieve room + hotel timezone
        const bookingSql = `
          SELECT 
            b.*,
            bg.email AS guest_email,
            bg.full_name AS guest_name,
            rt.id AS room_type_id,
            rt.name AS room_name,
            h.name AS hotel_name,
            l.timezone
          FROM bookings b
          JOIN booking_guests bg ON bg.booking_id = b.id
          JOIN room_types rt ON rt.id = b.room_type_id
          JOIN hotels h ON h.id = rt.hotel_id
          JOIN locations l ON l.id = h.location_id
          WHERE b.booking_reference = $1
          FOR UPDATE;
        `;
        const bookingRes = await client.query(bookingSql, [bookingReference.trim()]);

        if (bookingRes.rows.length === 0) {
          throw new AppError(ERROR_CODES.BOOKING_NOT_FOUND, ERROR_MESSAGES[ERROR_CODES.BOOKING_NOT_FOUND], 404);
        }

        const b = bookingRes.rows[0];

        // Ensure email matches guest email (generic 404 to avoid enumeration)
        if (b.guest_email.trim().toLowerCase() !== normalizedEmail) {
          throw new AppError(ERROR_CODES.BOOKING_NOT_FOUND, ERROR_MESSAGES[ERROR_CODES.BOOKING_NOT_FOUND], 404);
        }

        // Prevent duplicate cancellation
        if (b.status === 'CANCELLED') {
          throw new AppError(
            ERROR_CODES.BOOKING_ALREADY_CANCELLED,
            ERROR_MESSAGES[ERROR_CODES.BOOKING_ALREADY_CANCELLED],
            400
          );
        }

        // 2. Validate cancellation proof from guest_sessions table
        const tokenHash = crypto.createHash('sha256').update(cancellationProof.trim()).digest('hex');
        const sessionSql = `
          SELECT *
          FROM guest_sessions
          WHERE booking_id = $1
            AND purpose = 'CANCELLATION'
            AND (token_hash = $2 OR token_hash = $3)
          FOR UPDATE;
        `;
        const sessionRes = await client.query(sessionSql, [b.id, tokenHash, cancellationProof.trim()]);

        if (sessionRes.rows.length === 0) {
          throw new AppError(
            ERROR_CODES.INVALID_CANCELLATION_PROOF,
            ERROR_MESSAGES[ERROR_CODES.INVALID_CANCELLATION_PROOF],
            400
          );
        }

        const session = sessionRes.rows[0];

        // Check single-use: must not have been consumed
        if (session.consumed_at) {
          throw new AppError(
            ERROR_CODES.INVALID_CANCELLATION_PROOF,
            'This cancellation proof has already been consumed.',
            400
          );
        }

        // Check expiration
        if (new Date(session.expires_at).getTime() < Date.now()) {
          throw new AppError(
            ERROR_CODES.EXPIRED_CANCELLATION_PROOF,
            ERROR_MESSAGES[ERROR_CODES.EXPIRED_CANCELLATION_PROOF],
            400
          );
        }

        // 3. Verify cancellation deadline based on hotel local timezone
        const hotelTimezone = b.timezone || 'Asia/Kolkata';
        const eligible = isCancellationEligible(b.check_in, hotelTimezone);

        if (!eligible) {
          throw new AppError(
            ERROR_CODES.CANCELLATION_DEADLINE_PASSED,
            ERROR_MESSAGES[ERROR_CODES.CANCELLATION_DEADLINE_PASSED],
            400
          );
        }

        // 4. Mark proof as consumed (single use)
        await client.query(
          `UPDATE guest_sessions SET consumed_at = CURRENT_TIMESTAMP WHERE id = $1;`,
          [session.id]
        );

        // 5. Update booking status to CANCELLED
        await client.query(
          `UPDATE bookings
           SET status = 'CANCELLED',
               cancelled_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1;`,
          [b.id]
        );

        // 6. Restore inventory for all occupied stay nights [checkIn, checkOut)
        const roomsToRestore = b.rooms_count || 1;
        await client.query(
          `UPDATE room_inventory
           SET available_rooms = available_rooms + $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE room_type_id = $2
             AND inventory_date >= $3::date
             AND inventory_date < $4::date;`,
          [roomsToRestore, b.room_type_id, b.check_in, b.check_out]
        );

        // 7. Enqueue cancellation outbox event
        const outboxPayload = {
          bookingReference: b.booking_reference,
          hotelName: b.hotel_name,
          roomName: b.room_name,
          checkIn: b.check_in,
          checkOut: b.check_out,
          nights: b.nights,
          roomsCount: roomsToRestore,
          guestName: b.guest_name,
          guestEmail: b.guest_email,
          reason,
          cancelledAt: new Date().toISOString(),
        };

        await client.query(
          `INSERT INTO notification_outbox (booking_id, event_type, payload, status)
           VALUES ($1, 'BOOKING_CANCELLATION', $2::jsonb, 'PENDING');`,
          [b.id, JSON.stringify(outboxPayload)]
        );

        await client.query('COMMIT');

        return {
          bookingReference: b.booking_reference,
          status: 'CANCELLED',
          hotelName: b.hotel_name,
          roomName: b.room_name,
          checkIn: b.check_in,
          checkOut: b.check_out,
          nights: b.nights,
          roomsCount: roomsToRestore,
          totalAmount: Number(b.total_amount),
          cancelledAt: new Date().toISOString(),
          guest: {
            fullName: b.guest_name,
            email: b.guest_email,
          },
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

    // ==========================================
    // IN-MEMORY FALLBACK WITH ASYNC MUTEX
    // ==========================================
    const release = await this.mutex.acquire();
    try {
      const booking = this.inMemoryBookings.get(bookingReference.trim());

      if (!booking) {
        throw new AppError(ERROR_CODES.BOOKING_NOT_FOUND, ERROR_MESSAGES[ERROR_CODES.BOOKING_NOT_FOUND], 404);
      }

      if (booking.guest?.email?.toLowerCase() !== normalizedEmail) {
        throw new AppError(ERROR_CODES.BOOKING_NOT_FOUND, ERROR_MESSAGES[ERROR_CODES.BOOKING_NOT_FOUND], 404);
      }

      if (booking.status === 'CANCELLED') {
        throw new AppError(
          ERROR_CODES.BOOKING_ALREADY_CANCELLED,
          ERROR_MESSAGES[ERROR_CODES.BOOKING_ALREADY_CANCELLED],
          400
        );
      }

      // Check cancellation proof
      const session = this.inMemoryGuestSessions.get(cancellationProof.trim());
      if (!session || session.bookingId !== booking.id || session.purpose !== 'CANCELLATION') {
        throw new AppError(
          ERROR_CODES.INVALID_CANCELLATION_PROOF,
          ERROR_MESSAGES[ERROR_CODES.INVALID_CANCELLATION_PROOF],
          400
        );
      }

      if (session.consumedAt) {
        throw new AppError(
          ERROR_CODES.INVALID_CANCELLATION_PROOF,
          'This cancellation proof has already been consumed.',
          400
        );
      }

      if (new Date(session.expiresAt).getTime() < Date.now()) {
        throw new AppError(
          ERROR_CODES.EXPIRED_CANCELLATION_PROOF,
          ERROR_MESSAGES[ERROR_CODES.EXPIRED_CANCELLATION_PROOF],
          400
        );
      }

      // Check cancellation cutoff
      const eligible = isCancellationEligible(booking.checkIn);
      if (!eligible) {
        throw new AppError(
          ERROR_CODES.CANCELLATION_DEADLINE_PASSED,
          ERROR_MESSAGES[ERROR_CODES.CANCELLATION_DEADLINE_PASSED],
          400
        );
      }

      // Mark proof consumed (single-use)
      session.consumedAt = new Date().toISOString();

      // Update booking status
      booking.status = 'CANCELLED';
      booking.cancelledAt = new Date().toISOString();

      // Restore inventory
      const stayDates = getStayDates(booking.checkIn, booking.checkOut);
      for (const date of stayDates) {
        const currentAvail = roomRepository.getAvailableRoomsForDate(booking.roomTypeId, date, 10);
        roomRepository.setInventory(booking.roomTypeId, date, currentAvail + booking.roomsCount);
      }

      // Enqueue outbox
      this.inMemoryOutbox.push({
        id: crypto.randomUUID(),
        bookingId: booking.id,
        eventType: 'BOOKING_CANCELLATION',
        payload: {
          bookingReference: booking.bookingReference,
          hotelName: booking.hotelName,
          roomName: booking.roomName,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          nights: booking.nights,
          roomsCount: booking.roomsCount,
          guestName: booking.guest?.fullName,
          guestEmail: booking.guest?.email,
          reason,
          cancelledAt: booking.cancelledAt,
        },
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      });

      return {
        bookingReference: booking.bookingReference,
        status: 'CANCELLED',
        hotelName: booking.hotelName,
        roomName: booking.roomName,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        nights: booking.nights,
        roomsCount: booking.roomsCount,
        totalAmount: booking.totalAmount,
        cancelledAt: booking.cancelledAt,
        guest: booking.guest,
      };
    } finally {
      release();
    }
  }
}

export const bookingRepository = new BookingRepository();
export default bookingRepository;
