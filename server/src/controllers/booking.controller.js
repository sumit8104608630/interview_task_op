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
   * GET /api/bookings/my-bookings
   * Retrieves booking history for authenticated customer with pagination and status filtering
   */
  getMyBookings = asyncHandler(async (req, res) => {
    const customerId = req.customer?.id || req.user?.id;
    if (!customerId) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, 'Authentication required to access booking history.', 401);
    }

    const { page, limit, status } = req.query;

    const result = await bookingService.getCustomerBookings({
      customerId,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      status: status ? status.toUpperCase() : null,
    });

    return sendSuccess(res, {
      statusCode: 200,
      data: result.bookings,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  });

  /**
   * POST /api/bookings/cancellation/send-otp and POST /api/bookings/:reference/cancellation-otp
   * Dispatches an OTP to guest email for cancellation verification
   */
  requestCancellationOtp = asyncHandler(async (req, res) => {
    const bookingReference = req.params.reference || req.body.bookingReference;
    const email = req.body.email || req.customer?.email;

    const result = await bookingService.requestCancellationOtp({
      bookingReference,
      email,
    });

    return sendSuccess(res, {
      statusCode: 200,
      data: result,
    });
  });

  /**
   * POST /api/bookings/cancellation/verify-otp
   * Verifies OTP and generates short-lived, booking-scoped cancellation proof token
   */
  verifyCancellationOtp = asyncHandler(async (req, res) => {
    const bookingReference = req.body.bookingReference || req.params.reference;
    const email = req.body.email || req.customer?.email;
    const otp = req.body.otp || req.body.cancellationOtp;

    const result = await bookingService.verifyCancellationOtp({
      bookingReference,
      email,
      otp,
    });

    return sendSuccess(res, {
      statusCode: 200,
      data: result,
      message: 'Cancellation authorization proof generated successfully.',
    });
  });

  /**
   * POST /api/bookings/cancellation/cancel and POST /api/bookings/:reference/cancel
   * Confirms cancellation with single-use cancellation proof, restores inventory atomically
   */
  cancelBooking = asyncHandler(async (req, res) => {
    const bookingReference = req.params.reference || req.body.bookingReference;
    const email = req.body.email || req.customer?.email;
    const cancellationProof =
      req.body.cancellationProof || req.body.cancellationToken || req.body.cancellationOtp;
    const { reason } = req.body;

    const result = await bookingService.cancelBooking({
      bookingReference,
      email,
      cancellationProof,
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
