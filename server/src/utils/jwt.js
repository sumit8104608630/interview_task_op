import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * Signs a customer authentication JWT
 * Contains minimal necessary claims: subject (customer ID) and jti (session ID).
 *
 * @param {object} params
 * @param {string} params.customerId - Customer UUID
 * @param {string} params.sessionId - Auth session UUID
 * @param {string|number} [params.expiresIn] - Optional override for token duration
 * @returns {string} Signed JWT string
 */
export const signCustomerToken = ({ customerId, sessionId, expiresIn = env.jwt.sessionTtl }) => {
  if (!customerId || !sessionId) {
    throw new Error('JWT signing requires both customerId and sessionId.');
  }

  const payload = {
    sub: customerId,
    jti: sessionId,
  };

  const options = {
    algorithm: env.jwt.algorithm,
    issuer: env.jwt.issuer,
    audience: env.jwt.audience,
    expiresIn,
  };

  return jwt.sign(payload, env.jwt.secret, options);
};

/**
 * Verifies a customer authentication JWT
 * Enforces algorithm allowlisting, signature validity, issuer, audience, and expiration.
 *
 * @param {string} token - Raw JWT string
 * @returns {{ valid: boolean, payload?: object, error?: string }}
 */
export const verifyCustomerToken = (token) => {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token is missing or malformed.' };
  }

  try {
    const payload = jwt.verify(token, env.jwt.secret, {
      algorithms: [env.jwt.algorithm],
      issuer: env.jwt.issuer,
      audience: env.jwt.audience,
    });

    if (!payload.sub || !payload.jti) {
      return { valid: false, error: 'Token payload missing essential claims (sub or jti).' };
    }

    return { valid: true, payload };
  } catch (error) {
    let message = 'Invalid authentication token.';
    if (error.name === 'TokenExpiredError') {
      message = 'Authentication token has expired.';
    } else if (error.name === 'JsonWebTokenError') {
      message = error.message;
    }

    return { valid: false, error: message };
  }
};

export default {
  signCustomerToken,
  verifyCustomerToken,
};
