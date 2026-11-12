import { Router } from 'express';
import { authController } from './auth.controller.js';
import { requireAuth } from './auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { sendOtpSchema, verifyOtpSchema } from './auth.validation.js';
import { otpSendRateLimiter, otpVerifyRateLimiter } from '../../middleware/rateLimiter.middleware.js';
import { verifyCsrf } from '../../middleware/csrf.middleware.js';

const router = Router();

/**
 * @route   POST /api/auth/send-otp
 * @desc    Request an email OTP for customer registration or login
 * @access  Public (Rate limited)
 */
router.post(
  '/send-otp',
  otpSendRateLimiter.middleware(),
  validate({ body: sendOtpSchema }),
  authController.sendOtp
);

/**
 * @route   POST /api/auth/verify-otp
 * @desc    Verify OTP and complete customer authentication
 * @access  Public (Rate limited)
 */
router.post(
  '/verify-otp',
  otpVerifyRateLimiter.middleware(),
  validate({ body: verifyOtpSchema }),
  authController.verifyOtp
);

/**
 * @route   GET /api/auth/me
 * @desc    Get currently authenticated customer profile
 * @access  Private (HttpOnly cookie / Bearer JWT)
 */
router.get(
  '/me',
  requireAuth,
  authController.me
);

/**
 * @route   POST /api/auth/logout
 * @desc    Revoke current authentication session and clear cookie
 * @access  Public / Private (CSRF protected if cookie present)
 */
router.post(
  '/logout',
  verifyCsrf,
  authController.logout
);

export default router;
