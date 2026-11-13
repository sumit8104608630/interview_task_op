import { verifyCustomerToken } from '../../utils/jwt.js';
import { authService } from './auth.service.js';
import { env } from '../../config/env.js';
import { sendError } from '../../utils/apiResponse.js';

/**
 * Authentication Middleware for protected customer routes
 * Reads JWT from HttpOnly cookie (or Bearer header), verifies claims and signature,
 * validates matching unrevoked session in database, and ensures customer is ACTIVE.
 */
export const requireAuth = async (req, res, next) => {
  try {
    // 1. Extract token from HttpOnly cookie or Authorization Bearer header
    let token = req.cookies ? req.cookies[env.cookies.authCookieName] : null;

    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.slice(7).trim();
    }

    if (!token) {
      return sendError(res, {
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please log in.',
      });
    }

    // 2. Cryptographically verify JWT signature, algorithm, issuer, audience, and exp
    const verification = verifyCustomerToken(token);
    if (!verification.valid) {
      return sendError(res, {
        statusCode: 401,
        code: 'INVALID_TOKEN',
        message: verification.error || 'Invalid or expired authentication token.',
      });
    }

    const { jti: sessionId, sub: customerId } = verification.payload;

    // 3. Verify session in auth_sessions table and retrieve customer profile
    const customer = await authService.getCurrentCustomer(sessionId);

    // 4. Ensure subject ID in token strictly matches database customer record
    if (customer.id !== customerId) {
      return sendError(res, {
        statusCode: 401,
        code: 'TOKEN_SUBJECT_MISMATCH',
        message: 'Security violation: token subject does not match authenticated record.',
      });
    }

    // 5. Attach authenticated customer context to request object
    req.customer = customer;
    req.user = customer;
    req.sessionId = sessionId;

    return next();
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, {
        statusCode: error.statusCode,
        code: error.code || 'UNAUTHORIZED',
        message: error.message,
      });
    }

    console.error('[requireAuth Middleware Error]', error.message);
    return sendError(res, {
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Authentication failed. Please log in again.',
    });
  }
};

/**
 * Optional Authentication Middleware
 * If auth cookie or Bearer token is provided and valid, attaches req.customer and req.user.
 * If no token is provided or customer is not authenticated, cleanly sets req.customer = null and continues.
 */
export const optionalAuth = async (req, res, next) => {
  try {
    let token = req.cookies ? req.cookies[env.cookies.authCookieName] : null;

    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.slice(7).trim();
    }

    if (!token) {
      req.customer = null;
      req.user = null;
      return next();
    }

    const verification = verifyCustomerToken(token);
    if (!verification.valid) {
      req.customer = null;
      req.user = null;
      return next();
    }

    const { jti: sessionId, sub: customerId } = verification.payload;
    const customer = await authService.getCurrentCustomer(sessionId);

    if (customer && customer.id === customerId && customer.status === 'ACTIVE') {
      req.customer = customer;
      req.user = customer;
      req.sessionId = sessionId;
    } else {
      req.customer = null;
      req.user = null;
    }

    return next();
  } catch {
    req.customer = null;
    req.user = null;
    return next();
  }
};

export default {
  requireAuth,
  optionalAuth,
};
