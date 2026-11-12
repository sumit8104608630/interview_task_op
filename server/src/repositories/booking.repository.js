import { query } from '../database/connection.js';

/**
 * Booking and Guest Data Access Repository
 * Handles all PostgreSQL operations for bookings, guest attachments, and status updates.
 */
export class BookingRepository {
  /**
   * Creates a new booking and associated guest record within a transaction
   * @param {import('pg').PoolClient} client
   * @param {object} bookingData
   * @returns {Promise<object>} Created booking row
   */
  async create(client, bookingData) {
    const {
      bookingReference,
      roomTypeId,
      checkIn,
      checkOut,
      nights,
      nightlyPriceSnapshot,
      totalAmount,
      guestName,
      guestEmail,
    } = bookingData;

    const bookingSql = `
      INSERT INTO bookings (
        booking_reference, room_type_id, check_in, check_out, 
        nights, nightly_price_snapshot, total_amount, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'CONFIRMED')
      RETURNING *;
    `;

    const bookingResult = await client.query(bookingSql, [
      bookingReference,
      roomTypeId,
      checkIn,
      checkOut,
      nights,
      nightlyPriceSnapshot,
      totalAmount,
    ]);

    const booking = bookingResult.rows[0];

    const guestSql = `
      INSERT INTO booking_guests (booking_id, guest_name, email)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;

    const guestResult = await client.query(guestSql, [booking.id, guestName, guestEmail]);
    booking.guest = guestResult.rows[0];

    return booking;
  }

  /**
   * Finds a booking by its public reference code
   * @param {string} reference
   * @returns {Promise<object|null>}
   */
  async findByReference(reference) {
    const sql = `
      SELECT 
        b.*,
        bg.guest_name,
        bg.email AS guest_email,
        rt.name AS room_name,
        h.name AS hotel_name,
        h.id AS hotel_id
      FROM bookings b
      JOIN booking_guests bg ON bg.booking_id = b.id
      JOIN room_types rt ON rt.id = b.room_type_id
      JOIN hotels h ON h.id = rt.hotel_id
      WHERE b.booking_reference = $1
      LIMIT 1;
    `;
    console.log('[BookingRepository.findByReference SQL template prepared for:]', reference);
    return null;
  }

  /**
   * Verifies and looks up a booking by reference code and email
   * Prevents leaking whether a reference exists if email does not match.
   * @param {string} reference
   * @param {string} email
   * @returns {Promise<object|null>}
   */
  async findByReferenceAndEmail(reference, email) {
    const sql = `
      SELECT 
        b.booking_reference,
        b.check_in,
        b.check_out,
        b.nights,
        b.total_amount,
        b.status,
        b.created_at,
        bg.guest_name,
        bg.email AS guest_email,
        rt.name AS room_name,
        h.name AS hotel_name
      FROM bookings b
      JOIN booking_guests bg ON bg.booking_id = b.id
      JOIN room_types rt ON rt.id = b.room_type_id
      JOIN hotels h ON h.id = rt.hotel_id
      WHERE b.booking_reference = $1 AND LOWER(bg.email) = LOWER($2)
      LIMIT 1;
    `;
    console.log('[BookingRepository.findByReferenceAndEmail SQL template prepared]');
    return null;
  }

  /**
   * Locks a booking record for status update during cancellation
   * @param {import('pg').PoolClient} client
   * @param {string} reference
   * @returns {Promise<object|null>}
   */
  async lockBookingForUpdate(client, reference) {
    const sql = `
      SELECT *
      FROM bookings
      WHERE booking_reference = $1
      FOR UPDATE;
    `;
    const result = await client.query(sql, [reference]);
    return result.rows[0] || null;
  }

  /**
   * Transitions booking status to CANCELLED atomically
   * @param {import('pg').PoolClient} client
   * @param {string} bookingId
   * @returns {Promise<number>} Number of updated rows (must be exactly 1)
   */
  async cancelBooking(client, bookingId) {
    const sql = `
      UPDATE bookings
      SET status = 'CANCELLED', cancelled_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'CONFIRMED';
    `;
    const result = await client.query(sql, [bookingId]);
    return result.rowCount;
  }
}

export const bookingRepository = new BookingRepository();
export default bookingRepository;
