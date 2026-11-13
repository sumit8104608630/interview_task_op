import { z } from 'zod';

/**
 * Common password validation rules matching backend security constraints:
 * Minimum 8 characters, maximum 100 characters, at least 1 letter, and at least 1 number.
 */
export const passwordRule = z
  .string()
  .min(8, 'Password must be at least 8 characters long.')
  .max(100, 'Password cannot exceed 100 characters.')
  .regex(/[a-zA-Z]/, 'Password must contain at least one letter.')
  .regex(/[0-9]/, 'Password must contain at least one number.');

/**
 * Login schema (Email + Password)
 */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email address is required.')
    .email('Please enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

/**
 * Step 1: Send registration OTP
 */
export const sendRegistrationOtpSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters.')
    .max(100, 'Full name cannot exceed 100 characters.'),
  email: z
    .string()
    .trim()
    .min(1, 'Email address is required.')
    .email('Please enter a valid email address.'),
});

/**
 * Step 2: Verify registration OTP with initial password creation
 */
export const verifyRegistrationWithPasswordSchema = z
  .object({
    otp: z
      .string()
      .trim()
      .min(4, 'OTP must be at least 4 digits.')
      .max(10, 'OTP cannot exceed 10 digits.')
      .regex(/^\d+$/, 'OTP must contain numeric digits only.'),
    password: passwordRule,
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

/**
 * Forgot password schema
 */
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email address is required.')
    .email('Please enter a valid email address.'),
});

/**
 * Reset password schema
 */
export const resetPasswordSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, 'Email address is required.')
      .email('Please enter a valid email address.'),
    otp: z
      .string()
      .trim()
      .min(4, 'OTP must be at least 4 digits.')
      .max(10, 'OTP cannot exceed 10 digits.')
      .regex(/^\d+$/, 'OTP must contain numeric digits only.'),
    newPassword: passwordRule,
    confirmPassword: z.string().min(1, 'Please confirm your new password.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });
