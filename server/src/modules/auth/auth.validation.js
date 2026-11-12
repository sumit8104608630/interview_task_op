import { z } from 'zod';
import { normalizeEmail } from '../../utils/normalizeEmail.js';

/**
 * Reusable password validation schema
 * Enforces minimum 8 characters, maximum 100 characters, at least 1 letter, and at least 1 number.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long.')
  .max(100, 'Password cannot exceed 100 characters.')
  .regex(/[a-zA-Z]/, 'Password must contain at least one letter.')
  .regex(/[0-9]/, 'Password must contain at least one number.');

/**
 * Validation schema for POST /api/auth/send-otp
 *
 * Registration: requires email, fullName. Optional password can be provided upfront.
 * Login: requires email.
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
  password: passwordSchema.optional(),
});

/**
 * Validation schema for POST /api/auth/verify-otp
 *
 * Requires email and otp.
 * Optional fullName and password for registration.
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
  password: passwordSchema.optional(),
});

/**
 * Validation schema for POST /api/auth/login (Email + Password)
 */
export const loginWithPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email address is required.')
    .email('Please provide a valid email address.')
    .transform(normalizeEmail),
  password: z
    .string()
    .min(1, 'Password is required.'),
});

/**
 * Validation schema for POST /api/auth/forgot-password
 */
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email address is required.')
    .email('Please provide a valid email address.')
    .transform(normalizeEmail),
});

/**
 * Validation schema for POST /api/auth/reset-password
 */
export const resetPasswordSchema = z.object({
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
  newPassword: passwordSchema,
});

export default {
  passwordSchema,
  sendOtpSchema,
  verifyOtpSchema,
  loginWithPasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
