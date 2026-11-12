import { z } from 'zod';
import { isValidIsoDate } from '../utils/dateUtils.js';

/**
 * Validation schema for booking creation
 * Supports one-room booking with verified guest details
 */
export const createBookingBodySchema = z.object({
  roomTypeId: z.string().trim().min(1, 'Room type ID is required'),
  checkIn: z.string().refine(isValidIsoDate, {
    message: 'checkIn must be a valid date in YYYY-MM-DD format',
  }),
  checkOut: z.string().refine(isValidIsoDate, {
    message: 'checkOut must be a valid date in YYYY-MM-DD format',
  }),
  guestName: z.string().trim().min(2, 'Guest name must be at least 2 characters'),
  guestEmail: z.string().trim().email('A valid email address is required'),
  otpToken: z.string().trim().min(1, 'OTP verification token is required'),
});

/**
 * Validation schema for booking lookup using reference code and email
 */
export const lookupBookingBodySchema = z.object({
  bookingReference: z.string().trim().min(1, 'Booking reference is required'),
  email: z.string().trim().email('A valid guest email is required'),
});

/**
 * Validation schema for booking reference parameter
 */
export const bookingReferenceParamSchema = z.object({
  reference: z.string().trim().min(1, 'Booking reference is required'),
});

/**
 * Validation schema for booking cancellation request
 */
export const cancelBookingBodySchema = z.object({
  cancellationOtp: z.string().trim().min(4, 'Valid cancellation OTP is required'),
  reason: z.string().trim().max(500).optional(),
});

export default {
  createBookingBodySchema,
  lookupBookingBodySchema,
  bookingReferenceParamSchema,
  cancelBookingBodySchema,
};
