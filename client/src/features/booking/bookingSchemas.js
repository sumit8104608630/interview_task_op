import { z } from 'zod';

/**
 * Validation schema for Guest Traveler details during checkout
 */
export const guestCheckoutSchema = z.object({
  guestName: z
    .string()
    .trim()
    .min(2, 'Guest full name must be at least 2 characters.')
    .max(100, 'Guest full name cannot exceed 100 characters.'),
  guestEmail: z
    .string()
    .trim()
    .min(1, 'A valid email address is required for confirmation.')
    .email('Please enter a valid email address.'),
  guestPhone: z
    .string()
    .trim()
    .max(20, 'Phone number cannot exceed 20 characters.')
    .optional()
    .or(z.literal('')),
});

/**
 * Validation schema for Booking Lookup
 */
export const bookingLookupSchema = z.object({
  bookingReference: z
    .string()
    .trim()
    .min(3, 'Booking reference is required (e.g., HBP-A83F9D21).')
    .max(50, 'Booking reference cannot exceed 50 characters.'),
  email: z
    .string()
    .trim()
    .min(1, 'Guest email address is required.')
    .email('Please enter a valid email address.'),
});

/**
 * Validation schema for Cancellation OTP submission
 */
export const cancellationOtpSchema = z.object({
  otp: z
    .string()
    .trim()
    .min(4, 'OTP must be at least 4 digits.')
    .max(10, 'OTP cannot exceed 10 digits.')
    .regex(/^\d+$/, 'OTP must contain numeric digits only.'),
  reason: z
    .string()
    .trim()
    .max(255, 'Reason cannot exceed 255 characters.')
    .optional(),
});
