import { bookingRepository } from '../repositories/booking.repository.js';
import { notificationService } from './notification.service.js';
import { validateStayDates, isCancellationEligible } from '../utils/dateUtils.js';
import { AppError } from '../middleware/error.middleware.js';
import { ERROR_CODES, ERROR_MESSAGES } from '../constants/errorMessages.js';

/**
 * Booking Domain Business Service
 * Coordinates atomic booking creation, multi-room reservations, stay price recalculation,
 * guest details, idempotency, and asynchronous confirmation notifications.
 */
export class BookingService {
  /**
   * Creates a secure booking for either a registered customer or a guest checkout.
   *
   * @param {object} params
   * @param {string} params.roomTypeId
   * @param {string} params.checkIn
   * @param {string} params.checkOut
   * @param {number} [params.rooms=1]
   * @param {number} [params.roomsCount=1]
   * @param {number} [params.guests=1]
   * @param {object} [params.guest]
   * @param {string} [params.guestName]
   * @param {string} [params.guestEmail]
   * @param {string} [params.guestPhone]
   * @param {string|null} [params.customerId=null] - Strictly from auth session, NEVER from client body
   * @param {string|null} [params.idempotencyKey=null]
   * @param {string} [params.otp]
   * @param {string} [params.otpToken]
   * @returns {Promise<object>}
   */
  async createBooking({
    roomTypeId,
    checkIn,
    checkOut,
    rooms = 1,
    roomsCount = null,
    guests = 1,
    guest = null,
    guestName = null,
    guestEmail = null,
    guestPhone = null,
    customerId = null,
    idempotencyKey = null,
    otp = null,
    otpToken = null,
  }) {
    // 1. Validate stay date interval and policy
    const dateValidation = validateStayDates(checkIn, checkOut, {
      timezone: 'Asia/Kolkata',
      maxStayNights: 30,
    });

    if (!dateValidation.valid) {
      throw new AppError(dateValidation.code, dateValidation.error, 400);
    }

    // 2. Resolve room and guest parameters
    const safeRoomsCount = Math.max(1, Number(roomsCount || rooms || 1));
    const safeGuests = Math.max(1, Number(guests || 1));

    const finalGuestName = (guest?.fullName || guest?.name || guestName)?.trim();
    const finalGuestEmail = (guest?.email || guestEmail)?.trim().toLowerCase();
    const finalGuestPhone = (guest?.phone || guestPhone)?.trim() || null;

    if (!finalGuestName || finalGuestName.length < 2) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Guest name must be at least 2 characters.', 400);
    }

    if (!finalGuestEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(finalGuestEmail)) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'A valid guest email address is required.', 400);
    }

    // 3. Optional Guest OTP Verification (if requested/provided by flow)
    const verificationCode = otp || otpToken;
    if (verificationCode) {
      const verifyRes = await notificationService.verifyOtp({
        email: finalGuestEmail,
        otp: verificationCode,
        purpose: 'BOOKING',
      });

      if (!verifyRes.valid) {
        throw new AppError(ERROR_CODES.OTP_INVALID, verifyRes.error || ERROR_MESSAGES[ERROR_CODES.OTP_INVALID], 400);
      }
    }

    // 4. Atomically Reserve Inventory and Persist Booking
    const booking = await bookingRepository.createBookingAtomic({
      roomTypeId: roomTypeId.trim(),
      checkIn,
      checkOut,
      roomsCount: safeRoomsCount,
      guests: safeGuests,
      guestName: finalGuestName,
      guestEmail: finalGuestEmail,
      guestPhone: finalGuestPhone,
      customerId: customerId || null,
      idempotencyKey: idempotencyKey ? idempotencyKey.trim() : null,
    });

    // 5. Asynchronously trigger confirmation email (non-blocking)
    if (!booking.isExisting) {
      notificationService
        .sendBookingConfirmationSafe({
          email: finalGuestEmail,
          guestName: finalGuestName,
          bookingDetails: {
            bookingReference: booking.bookingReference,
            hotelName: booking.hotelName,
            roomName: booking.roomName,
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            nights: booking.nights,
            roomsCount: booking.roomsCount,
            totalAmount: booking.totalAmount,
            currency: booking.currency || 'INR',
          },
        })
        .catch((err) => {
          console.error('[BookingService] Non-blocking email dispatch caught:', err.message);
        });
    }

    return {
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
      guest: {
        fullName: booking.guest.fullName,
        email: booking.guest.email,
        phone: booking.guest.phone,
      },
      customerId: booking.customerId || null,
      isRegisteredCustomer: Boolean(booking.customerId),
      isExisting: booking.isExisting || false,
    };
  }

  /**
   * Looks up a booking by reference code and verified email
   * @param {object} params
   * @param {string} params.bookingReference
   * @param {string} params.email
   * @returns {Promise<object>}
   */
  async lookupBooking({ bookingReference, email }) {
    if (!bookingReference || !email) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Booking reference and email are required.', 400);
    }

    const booking = await bookingRepository.findByReferenceAndEmail(bookingReference, email);

    if (!booking) {
      // Intentionally generic error to prevent reference enumeration
      throw new AppError(
        ERROR_CODES.BOOKING_NOT_FOUND,
        ERROR_MESSAGES[ERROR_CODES.BOOKING_NOT_FOUND],
        404
      );
    }

    return {
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
      cancelledAt: booking.cancelledAt,
      guest: booking.guest,
    };
  }

  /**
   * Retrieves paginated booking history for an authenticated customer
   *
   * @param {object} params
   * @param {string} params.customerId
   * @param {number} [params.page=1]
   * @param {number} [params.limit=10]
   * @param {'CONFIRMED'|'CANCELLED'|null} [params.status=null]
   * @returns {Promise<{ bookings: Array<object>, total: number, page: number, limit: number, totalPages: number }>}
   */
  async getCustomerBookings({ customerId, page = 1, limit = 10, status = null }) {
    if (!customerId) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Authentication required to view booking history.', 401);
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 10));

    const result = await bookingRepository.findByCustomerId({
      customerId,
      page: safePage,
      limit: safeLimit,
      status: ['CONFIRMED', 'CANCELLED'].includes(status) ? status : null,
    });

    const totalPages = Math.ceil(result.total / safeLimit) || 1;

    return {
      bookings: result.bookings,
      total: result.total,
      page: safePage,
      limit: safeLimit,
      totalPages,
    };
  }

  /**
   * Requests a cancellation OTP for an existing booking after verifying ownership
   *
   * @param {object} params
   * @param {string} params.bookingReference
   * @param {string} params.email
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async requestCancellationOtp({ bookingReference, email }) {
    if (!bookingReference || !email) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Booking reference and email are required.', 400);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const booking = await bookingRepository.findByReferenceAndEmail(bookingReference, normalizedEmail);

    if (!booking) {
      // Intentionally generic error to prevent reference enumeration
      throw new AppError(ERROR_CODES.BOOKING_NOT_FOUND, ERROR_MESSAGES[ERROR_CODES.BOOKING_NOT_FOUND], 404);
    }

    if (booking.status === 'CANCELLED') {
      throw new AppError(
        ERROR_CODES.BOOKING_ALREADY_CANCELLED,
        ERROR_MESSAGES[ERROR_CODES.BOOKING_ALREADY_CANCELLED],
        400
      );
    }

    // Check cancellation deadline policy
    const eligible = isCancellationEligible(booking.checkIn);
    if (!eligible) {
      throw new AppError(
        ERROR_CODES.CANCELLATION_DEADLINE_PASSED,
        ERROR_MESSAGES[ERROR_CODES.CANCELLATION_DEADLINE_PASSED],
        400
      );
    }

    await notificationService.requestOtp({
      email: normalizedEmail,
      purpose: 'CANCELLATION',
      reference: bookingReference.trim(),
    });

    return {
      success: true,
      message: 'Cancellation verification code dispatched to registered guest email.',
    };
  }

  /**
   * Verifies cancellation OTP and issues a short-lived, booking-scoped cancellation proof token
   *
   * @param {object} params
   * @param {string} params.bookingReference
   * @param {string} params.email
   * @param {string} params.otp
   * @returns {Promise<{ cancellationProof: string, expiresAt: string, bookingReference: string }>}
   */
  async verifyCancellationOtp({ bookingReference, email, otp }) {
    if (!bookingReference || !email || !otp) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Booking reference, email, and OTP are required.', 400);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const booking = await bookingRepository.findByReferenceAndEmail(bookingReference, normalizedEmail);

    if (!booking) {
      throw new AppError(ERROR_CODES.BOOKING_NOT_FOUND, ERROR_MESSAGES[ERROR_CODES.BOOKING_NOT_FOUND], 404);
    }

    if (booking.status === 'CANCELLED') {
      throw new AppError(
        ERROR_CODES.BOOKING_ALREADY_CANCELLED,
        ERROR_MESSAGES[ERROR_CODES.BOOKING_ALREADY_CANCELLED],
        400
      );
    }

    // Verify OTP via notification service
    const verifyRes = await notificationService.verifyOtp({
      email: normalizedEmail,
      otp: otp.trim(),
      purpose: 'CANCELLATION',
      reference: bookingReference.trim(),
    });

    if (!verifyRes.valid) {
      throw new AppError(ERROR_CODES.OTP_INVALID, verifyRes.error || ERROR_MESSAGES[ERROR_CODES.OTP_INVALID], 400);
    }

    // Generate short-lived (15 min), single-use cancellation proof bound to this exact booking
    const session = await bookingRepository.createGuestSession({
      bookingId: booking.id,
      email: normalizedEmail,
      purpose: 'CANCELLATION',
      expiresInMinutes: 15,
    });

    return {
      cancellationProof: session.token,
      expiresAt: session.expiresAt,
      bookingReference: booking.bookingReference,
    };
  }

  /**
   * Confirms booking cancellation atomically using the verified cancellation proof
   * Restores occupied room inventory, updates status, and queues outbox event.
   *
   * @param {object} params
   * @param {string} params.bookingReference
   * @param {string} params.email
   * @param {string} params.cancellationProof
   * @param {string} [params.reason]
   * @returns {Promise<object>} Cancelled booking confirmation
   */
  async cancelBooking({ bookingReference, email, cancellationProof, reason = null }) {
    const cancelled = await bookingRepository.cancelBookingAtomic({
      bookingReference,
      email,
      cancellationProof,
      reason,
    });

    // Asynchronously dispatch cancellation confirmation email (non-blocking)
    notificationService
      .sendBookingCancellationSafe({
        email: cancelled.guest.email,
        guestName: cancelled.guest.fullName,
        bookingDetails: {
          bookingReference: cancelled.bookingReference,
          hotelName: cancelled.hotelName,
          roomName: cancelled.roomName,
          checkIn: cancelled.checkIn,
          checkOut: cancelled.checkOut,
          nights: cancelled.nights,
          roomsCount: cancelled.roomsCount,
          totalAmount: cancelled.totalAmount,
          cancelledAt: cancelled.cancelledAt,
        },
      })
      .catch((err) => {
        console.error('[BookingService] Non-blocking cancellation email dispatch caught:', err.message);
      });

    return cancelled;
  }
}

export const bookingService = new BookingService();
export default bookingService;
