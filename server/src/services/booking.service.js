import { bookingRepository } from '../repositories/booking.repository.js';
import { notificationService } from './notification.service.js';
import { validateStayDates } from '../utils/dateUtils.js';
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
   * Requests a cancellation OTP for an existing booking
   * @param {string} bookingReference
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async requestCancellationOtp(bookingReference) {
    if (!bookingReference) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Booking reference is required.', 400);
    }

    const booking = await bookingRepository.findByReference(bookingReference);
    if (!booking) {
      throw new AppError(ERROR_CODES.BOOKING_NOT_FOUND, ERROR_MESSAGES[ERROR_CODES.BOOKING_NOT_FOUND], 404);
    }

    await notificationService.requestOtp({
      email: booking.guest.email,
      purpose: 'CANCELLATION',
      reference: bookingReference,
    });

    return {
      success: true,
      message: 'Cancellation OTP dispatched to registered guest email.',
    };
  }

  /**
   * Cancels a booking upon OTP verification
   * (Phase 5 will fully expand cancellation workflows; placeholder preserved)
   */
  async cancelBooking({ bookingReference, cancellationOtp, reason }) {
    throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Cancellation is not implemented in this phase.', 501);
  }
}

export const bookingService = new BookingService();
export default bookingService;
