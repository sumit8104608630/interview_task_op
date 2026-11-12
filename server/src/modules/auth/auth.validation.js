import { z } from 'zod';
import { normalizeEmail } from '../../utils/normalizeEmail.js';

/**
 * Validation schema for POST /api/auth/send-otp
 *
 * Registration: requires email and fullName.
 * Login: requires email (fullName omitted or empty).
 */
export const sendOtpSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email address is required.')
    .email('Please provide a valid email address.')
    .transform(normalizeEmail),
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters long.')
    .max(100, 'Full name cannot exceed 100 characters.')
    .optional(),
});

/**
 * Validation schema for POST /api/auth/verify-otp
 *
 * Requires email and otp.
 * fullName is optional, but if provided (during registration), must be valid.
 */
export const verifyOtpSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email address is required.')
    .email('Please provide a valid email address.')
    .transform(normalizeEmail),
  otp: z
    .string()
    .trim()
    .min(4, 'OTP must be at least 4 digits.')
    .max(10, 'OTP cannot exceed 10 digits.')
    .regex(/^[0-9]+$/, 'OTP must contain numeric digits only.'),
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters long.')
    .max(100, 'Full name cannot exceed 100 characters.')
    .optional(),
});

export default {
  sendOtpSchema,
  verifyOtpSchema,
};
