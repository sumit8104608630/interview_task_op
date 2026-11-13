import { Router } from 'express';
import { bookingController } from '../controllers/booking.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { optionalAuth, requireAuth } from '../modules/auth/auth.middleware.js';
import {
  createBookingBodySchema,
  lookupBookingBodySchema,
  myBookingsQuerySchema,
  bookingReferenceParamSchema,
  cancellationSendOtpSchema,
  cancellationVerifyOtpSchema,
  cancelBookingBodySchema,
} from '../validators/booking.validator.js';

const router = Router();

/**
 * @route   POST /api/bookings and /api/v1/bookings
 * @desc    Create a booking for registered customer or guest with atomic inventory reservation
 * @access  Public (supports optional authenticated customer session)
 */
router.post(
  '/',
  optionalAuth,
  validate({ body: createBookingBodySchema }),
  bookingController.createBooking
);

/**
 * @route   POST /api/bookings/lookup and /api/v1/bookings/lookup
 * @desc    Look up an existing booking by reference and email
 * @access  Public
 */
router.post(
  '/lookup',
  validate({ body: lookupBookingBodySchema }),
  bookingController.lookupBooking
);

/**
 * @route   GET /api/bookings/my-bookings and /api/v1/bookings/my-bookings
 * @desc    Get booking history for authenticated customer
 * @access  Protected (Requires active customer session)
 */
router.get(
  '/my-bookings',
  requireAuth,
  validate({ query: myBookingsQuerySchema }),
  bookingController.getMyBookings
);

/**
 * @route   POST /api/bookings/cancellation/send-otp
 * @desc    Request an OTP to verify cancellation of a booking
 * @access  Public / Optional Auth
 */
router.post(
  '/cancellation/send-otp',
  optionalAuth,
  validate({ body: cancellationSendOtpSchema }),
  bookingController.requestCancellationOtp
);

/**
 * @route   POST /api/bookings/cancellation/verify-otp
 * @desc    Verify cancellation OTP and generate single-use, booking-scoped cancellation proof
 * @access  Public / Optional Auth
 */
router.post(
  '/cancellation/verify-otp',
  optionalAuth,
  validate({ body: cancellationVerifyOtpSchema }),
  bookingController.verifyCancellationOtp
);

/**
 * @route   POST /api/bookings/cancellation/cancel
 * @desc    Confirm cancellation using verified single-use proof and restore inventory atomically
 * @access  Public / Optional Auth
 */
router.post(
  '/cancellation/cancel',
  optionalAuth,
  validate({ body: cancelBookingBodySchema }),
  bookingController.cancelBooking
);

/**
 * @route   POST /api/bookings/:reference/cancellation-otp
 * @desc    Request an OTP to cancel a booking (reference-scoped URL)
 * @access  Public / Optional Auth
 */
router.post(
  '/:reference/cancellation-otp',
  optionalAuth,
  validate({ params: bookingReferenceParamSchema }),
  bookingController.requestCancellationOtp
);

/**
 * @route   POST /api/bookings/:reference/cancel
 * @desc    Confirm booking cancellation with single-use cancellation proof (reference-scoped URL)
 * @access  Public / Optional Auth
 */
router.post(
  '/:reference/cancel',
  optionalAuth,
  validate({ params: bookingReferenceParamSchema }),
  bookingController.cancelBooking
);

export default router;
