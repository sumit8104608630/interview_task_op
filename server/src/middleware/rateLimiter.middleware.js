import { sendError } from '../utils/apiResponse.js';
import { ERROR_CODES, ERROR_MESSAGES } from '../constants/errorMessages.js';

/**
 * High-performance, in-memory sliding window rate limiter
 * Protects OTP generation and verification endpoints against enumeration and brute force attacks.
 */
export class MemoryRateLimiter {
  constructor({ windowMs = 60000, max = 5, keyGenerator = null, message = null } = {}) {
    this.windowMs = windowMs;
    this.max = max;
    this.keyGenerator = keyGenerator || ((req) => req.ip || req.headers['x-forwarded-for'] || 'anonymous');
    this.message = message || ERROR_MESSAGES[ERROR_CODES.RATE_LIMIT_EXCEEDED];
    this.hits = new Map();
  }

  /**
   * Resets all tracked rate limit records (useful for testing)
   */
  reset() {
    this.hits.clear();
  }

  /**
   * Middleware handler function
   */
  middleware() {
    return (req, res, next) => {
      const key = this.keyGenerator(req);
      const now = Date.now();
      const windowStart = now - this.windowMs;

      // Clean old timestamps outside the window
      let timestamps = this.hits.get(key) || [];
      timestamps = timestamps.filter((t) => t > windowStart);

      if (timestamps.length >= this.max) {
        const earliest = timestamps[0];
        const retryAfterSeconds = Math.ceil((earliest + this.windowMs - now) / 1000);

        res.setHeader('Retry-After', Math.max(1, retryAfterSeconds));
        return sendError(res, {
          statusCode: 429,
          code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
          message: this.message,
          details: { retryAfterSeconds: Math.max(1, retryAfterSeconds) },
        });
      }

      timestamps.push(now);
      this.hits.set(key, timestamps);
      return next();
    };
  }
}

/**
 * Rate limiter for OTP dispatch: max 5 requests per 10 minutes per IP/email
 */
export const otpSendRateLimiter = new MemoryRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'ip';
    const email = (req.body?.email || '').trim().toLowerCase();
    return `otp-send:${ip}:${email}`;
  },
  message: 'Too many OTP dispatch requests. Please wait 10 minutes before requesting another code.',
});

/**
 * Rate limiter for OTP verification: max 5 verification attempts per 10 minutes per email
 */
export const otpVerifyRateLimiter = new MemoryRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'ip';
    const email = (req.body?.email || '').trim().toLowerCase();
    return `otp-verify:${ip}:${email}`;
  },
  message: 'Too many verification attempts. Please wait 10 minutes before trying again.',
});

export default {
  MemoryRateLimiter,
  otpSendRateLimiter,
  otpVerifyRateLimiter,
};
