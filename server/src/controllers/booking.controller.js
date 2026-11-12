import { bookingService } from '../services/booking.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Controller handling Booking HTTP endpoints
 */
export class BookingController {
  /**
   * POST /api/v1/bookings
   * Creates a one-room booking with verified guest details
   */
  createBooking = asyncHandler(async (req, res) => {
    const bookingResult = await bookingService.createBooking(req.body);

    return sendSuccess(res, {
      statusCode: 201,
      data: bookingResult,
      message: 'Booking created successfully.',
    });
  });

  /**
   * POST /api/v1/bookings/lookup
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
   * POST /api/v1/bookings/:reference/cancellation-otp
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
   * POST /api/v1/bookings/:reference/cancel
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
