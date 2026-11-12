import crypto from 'crypto';
import { env } from '../config/env.js';
import { sendError } from '../utils/apiResponse.js';

/**
 * CSRF Protection Middleware using Double-Submit Cookie Pattern
 *
 * FRONTEND INTEGRATION CONTRACT:
 * 1. Upon authentication (POST /api/auth/verify-otp), the server sets a readable cookie:
 *    `csrf_token` (httpOnly: false, sameSite: 'lax', secure: production)
 * 2. The frontend reads this `csrf_token` cookie and sends it in the header:
 *    `x-csrf-token: <token-value>`
 *    for all state-changing requests (POST, PUT, PATCH, DELETE) to protected endpoints.
 * 3. Safe HTTP methods (GET, HEAD, OPTIONS) do not require the header.
 * 4. Pre-authentication endpoints (POST /api/auth/send-otp, POST /api/auth/verify-otp)
 *    are exempt from incoming token check, but set/refresh the CSRF cookie on success.
 */

const CSRF_COOKIE_NAME = env.cookies.csrfCookieName || 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Generates a cryptographically strong random token
 * @returns {string} 64-char hex string
 */
export const generateCsrfToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Attaches a fresh CSRF cookie to the response for the client to read
 * @param {import('express').Response} res
 * @returns {string} The generated CSRF token
 */
export const setCsrfCookie = (res) => {
  const token = generateCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Must be readable by client JavaScript to set x-csrf-token header
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  return token;
};

/**
 * Middleware that verifies CSRF token on state-changing requests
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const verifyCsrf = (req, res, next) => {
  // Safe idempotent methods are exempt
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Pre-authentication endpoints (registration and login OTP verification) do not have a prior session
  const exemptPaths = ['/send-otp', '/verify-otp', '/api/auth/send-otp', '/api/auth/verify-otp', '/api/v1/auth/send-otp', '/api/v1/auth/verify-otp'];
  if (exemptPaths.some((p) => req.path === p || req.originalUrl?.includes(p))) {
    return next();
  }

  // Only enforce CSRF if an authentication cookie is present (cookie-authenticated request)
  const hasAuthCookie = req.cookies && req.cookies[env.cookies.authCookieName];
  if (!hasAuthCookie) {
    return next();
  }

  const clientToken = req.headers[CSRF_HEADER_NAME] || req.headers[CSRF_HEADER_NAME.toLowerCase()];
  const cookieToken = req.cookies ? req.cookies[CSRF_COOKIE_NAME] : null;

  if (!clientToken || !cookieToken || clientToken !== cookieToken) {
    return sendError(res, {
      statusCode: 403,
      code: 'CSRF_VALIDATION_FAILED',
      message: 'CSRF token validation failed. Ensure the x-csrf-token header matches the csrf_token cookie.',
    });
  }

  return next();
};

export default {
  generateCsrfToken,
  setCsrfCookie,
  verifyCsrf,
};
