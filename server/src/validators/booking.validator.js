import { z } from 'zod';
import { isValidIsoDate } from '../utils/dateUtils.js';

/**
 * Validation schema for booking creation
 * Supports both registered customers and guest checkout with 1 or multiple rooms
 */
export const createBookingBodySchema = z
  .object({
    roomTypeId: z.string().trim().min(1, 'Room type ID is required'),
    checkIn: z.string().refine(isValidIsoDate, {
      message: 'checkIn must be a valid date in YYYY-MM-DD format',
    }),
    checkOut: z.string().refine(isValidIsoDate, {
      message: 'checkOut must be a valid date in YYYY-MM-DD format',
    }),
    rooms: z.coerce.number().int().positive().default(1).optional(),
    roomsCount: z.coerce.number().int().positive().optional(),
    guests: z.coerce.number().int().positive().default(1).optional(),
    guest: z
      .object({
        name: z.string().trim().min(2, 'Guest name must be at least 2 characters').optional(),
        fullName: z.string().trim().min(2, 'Guest full name must be at least 2 characters').optional(),
        email: z.string().trim().email('Valid guest email is required').optional(),
        phone: z.string().trim().optional(),
      })
      .optional(),
    guestName: z.string().trim().min(2, 'Guest name must be at least 2 characters').optional(),
    guestEmail: z.string().trim().email('Valid guest email is required').optional(),
    guestPhone: z.string().trim().optional(),
    otp: z.string().trim().optional(),
    otpToken: z.string().trim().optional(),
    idempotencyKey: z.string().trim().optional(),
    requirePayment: z.boolean().optional(),
    paymentMethod: z.string().trim().optional(),
    status: z.enum(['PENDING_PAYMENT', 'CONFIRMED']).optional(),
    // Security check: Reject explicit customerId injection in request body
    customerId: z.any().optional(),
    customer_id: z.any().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.customerId !== undefined || data.customer_id !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Supplying customerId in request body is forbidden for security. Customer identity is established via authentication session.',
        path: ['customerId'],
      });
    }
  });

/**
 * Validation schema for booking lookup using reference code and email
 */
export const lookupBookingBodySchema = z.object({
  bookingReference: z.string().trim().min(1, 'Booking reference is required'),
  email: z.string().trim().email('A valid guest email is required'),
});

/**
 * Validation schema for customer booking history query parameters
 */
export const myBookingsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(10).optional(),
  status: z.enum(['CONFIRMED', 'CANCELLED', 'confirmed', 'cancelled']).optional(),
  // Security check: Reject explicit customerId injection in query parameters
  customerId: z.any().optional(),
  customer_id: z.any().optional(),
}).superRefine((data, ctx) => {
  if (data.customerId !== undefined || data.customer_id !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Supplying customerId in query parameters is forbidden for security. Customer identity is established via authentication session.',
      path: ['customerId'],
    });
  }
});

/**
 * Validation schema for booking reference parameter
 */
export const bookingReferenceParamSchema = z.object({
  reference: z.string().trim().min(1, 'Booking reference is required'),
});

/**
 * Validation schema for requesting cancellation OTP
 */
export const cancellationSendOtpSchema = z.object({
  bookingReference: z.string().trim().min(1, 'Booking reference is required').optional(),
  email: z.string().trim().email('A valid guest email is required').optional(),
});

/**
 * Validation schema for verifying cancellation OTP
 */
export const cancellationVerifyOtpSchema = z.object({
  bookingReference: z.string().trim().min(1, 'Booking reference is required').optional(),
  email: z.string().trim().email('A valid guest email is required').optional(),
  otp: z.string().trim().min(4, 'Verification OTP is required').optional(),
  cancellationOtp: z.string().trim().min(4, 'Verification OTP is required').optional(),
});

/**
 * Validation schema for booking cancellation confirmation
 */
export const cancelBookingBodySchema = z.object({
  bookingReference: z.string().trim().min(1, 'Booking reference is required').optional(),
  email: z.string().trim().email('A valid guest email is required').optional(),
  cancellationProof: z.string().trim().min(1, 'Cancellation proof token is required').optional(),
  cancellationToken: z.string().trim().min(1, 'Cancellation proof token is required').optional(),
  cancellationOtp: z.string().trim().min(1, 'Cancellation proof token is required').optional(),
  reason: z.string().trim().max(500).optional(),
});

export default {
  createBookingBodySchema,
  lookupBookingBodySchema,
  myBookingsQuerySchema,
  bookingReferenceParamSchema,
  cancellationSendOtpSchema,
  cancellationVerifyOtpSchema,
  cancelBookingBodySchema,
};
