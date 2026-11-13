import { Router } from 'express';
import { bookingController } from '../controllers/booking.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { optionalAuth } from '../modules/auth/auth.middleware.js';
import {
  createBookingBodySchema,
  lookupBookingBodySchema,
  bookingReferenceParamSchema,
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
 * @route   POST /api/v1/bookings/lookup
 * @desc    Look up an existing booking by reference and email
 * @access  Public
 */
router.post(
  '/lookup',
  validate({ body: lookupBookingBodySchema }),
  bookingController.lookupBooking
);

/**
 * @route   POST /api/v1/bookings/:reference/cancellation-otp
 * @desc    Request an OTP to cancel a booking
 * @access  Public
 */
router.post(
  '/:reference/cancellation-otp',
  validate({ params: bookingReferenceParamSchema }),
  bookingController.requestCancellationOtp
);

/**
 * @route   POST /api/v1/bookings/:reference/cancel
 * @desc    Confirm booking cancellation with OTP
 * @access  Public
 */
router.post(
  '/:reference/cancel',
  validate({
    params: bookingReferenceParamSchema,
    body: cancelBookingBodySchema,
  }),
  bookingController.cancelBooking
);

export default router;
