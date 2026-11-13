import { bookingService } from '../services/booking.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../middleware/error.middleware.js';
import { ERROR_CODES } from '../constants/errorMessages.js';

/**
 * Controller handling Booking HTTP endpoints
 */
export class BookingController {
  /**
   * POST /api/bookings and /api/v1/bookings
   * Creates a booking with atomic inventory reservation for registered or guest customer
   */
  createBooking = asyncHandler(async (req, res) => {
    // Security check: strictly disallow passing customerId in request body
    if (req.body.customerId !== undefined || req.body.customer_id !== undefined) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Supplying customerId in request body is forbidden for security. Customer identity is established via authentication session.',
        400
      );
    }

    // Authenticated customer context (null for guest checkout)
    const customerId = req.customer?.id || req.user?.id || null;

    // Idempotency key from header or body
    const idempotencyKey =
      req.headers['idempotency-key'] ||
      req.headers['x-idempotency-key'] ||
      req.body.idempotencyKey ||
      null;

    const bookingResult = await bookingService.createBooking({
      ...req.body,
      customerId,
      idempotencyKey,
    });

    const statusCode = bookingResult.isExisting ? 200 : 201;

    return sendSuccess(res, {
      statusCode,
      data: bookingResult,
      message: bookingResult.isExisting
        ? 'Existing booking returned for provided idempotency key.'
        : 'Booking created successfully.',
    });
  });

  /**
   * POST /api/bookings/lookup and /api/v1/bookings/lookup
   * Looks up a booking by reference code and guest email
   */
  lookupBooking = asyncHandler(async (req, res) => {
    const { bookingReference, email } = req.body;
    const booking = await bookingService.lookupBooking({ bookingReference, email });

    return sendSuccess(res, {
      statusCode: 200,
      data: booking,
    });
  });

  /**
   * POST /api/bookings/:reference/cancellation-otp
   * Dispatches an OTP to guest email for cancellation verification
   */
  requestCancellationOtp = asyncHandler(async (req, res) => {
    const { reference } = req.params;
    const result = await bookingService.requestCancellationOtp(reference);

    return sendSuccess(res, {
      statusCode: 200,
      data: result,
    });
  });

  /**
   * POST /api/bookings/:reference/cancel
   * Cancels a booking upon OTP verification
   */
  cancelBooking = asyncHandler(async (req, res) => {
    const { reference } = req.params;
    const { cancellationOtp, reason } = req.body;

    const result = await bookingService.cancelBooking({
      bookingReference: reference,
      cancellationOtp,
      reason,
    });

    return sendSuccess(res, {
      statusCode: 200,
      data: result,
      message: 'Booking cancelled successfully.',
    });
  });
}

export const bookingController = new BookingController();
export default bookingController;
