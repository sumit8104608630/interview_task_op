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
