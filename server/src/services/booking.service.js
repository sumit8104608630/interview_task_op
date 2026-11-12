import { bookingRepository } from '../repositories/booking.repository.js';
import { roomRepository } from '../repositories/room.repository.js';
import { notificationService } from './notification.service.js';
import { generateBookingReference } from '../utils/generateBookingReference.js';
import { calculateNights, validateStayDates } from '../utils/dateUtils.js';
import { AppError } from '../middleware/error.middleware.js';
import { ERROR_CODES, ERROR_MESSAGES } from '../constants/errorMessages.js';

/**
 * Booking Domain Business Service
 * Coordinates booking creation, stay price recalculation, lookup, cancellation,
 * inventory decrements/restorations, and notification dispatches.
 */
export class BookingService {
  /**
   * Foundational method for creating a booking
   * In full implementation: runs inside a database transaction with row-level inventory locks.
   * @param {object} input
   * @param {string} input.roomTypeId
   * @param {string} input.checkIn
   * @param {string} input.checkOut
   * @param {string} input.guestName
   * @param {string} input.guestEmail
   * @param {string} input.otpToken
   * @returns {Promise<{ bookingReference: string, status: string, totalAmount: number }>}
   */
  async createBooking(input) {
    const { roomTypeId, checkIn, checkOut, guestName, guestEmail } = input;

    // 1. Validate stay date interval
    const dateValidation = validateStayDates(checkIn, checkOut);
    if (!dateValidation.valid) {
      throw new AppError(ERROR_CODES.INVALID_DATE_RANGE, dateValidation.error, 400);
    }

    const nights = calculateNights(checkIn, checkOut);
    const bookingReference = generateBookingReference();

    // Foundational structural response (transactional implementation in Day 2)
    console.log('[BookingService.createBooking] Foundational setup invoked:', {
      bookingReference,
      roomTypeId,
      nights,
      guestEmail,
    });

    return {
      bookingReference,
      status: 'CONFIRMED',
      nights,
      guestName,
      guestEmail,
      message: 'Booking structure initialized successfully.',
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
    const booking = await bookingRepository.findByReferenceAndEmail(bookingReference, email);

    if (!booking) {
      // Intentionally generic error to prevent reference enumeration or privacy leak
      throw new AppError(
        ERROR_CODES.BOOKING_NOT_FOUND,
        ERROR_MESSAGES[ERROR_CODES.BOOKING_NOT_FOUND],
        404
      );
    }

    return booking;
  }

  /**
   * Requests a cancellation OTP for an existing booking
   * @param {string} bookingReference
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async requestCancellationOtp(bookingReference) {
    console.log('[BookingService.requestCancellationOtp] For booking:', bookingReference);
    return {
      success: true,
      message: 'Cancellation OTP dispatched to registered guest email.',
    };
  }

  /**
   * Cancels a booking before check-in date
   * @param {object} params
   * @param {string} params.bookingReference
   * @param {string} params.cancellationOtp
   * @param {string} [params.reason]
   * @returns {Promise<{ bookingReference: string, status: string, message: string }>}
   */
  async cancelBooking({ bookingReference, cancellationOtp, reason }) {
    console.log('[BookingService.cancelBooking] Foundational setup invoked for:', bookingReference);
    return {
      bookingReference,
      status: 'CANCELLED',
      message: 'Booking cancellation registered.',
    };
  }
}

export const bookingService = new BookingService();
export default bookingService;
