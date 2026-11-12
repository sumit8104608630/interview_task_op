import { env } from '../../config/env.js';

/**
 * Parses a duration string (e.g. '7d', '24h', '60m', '3600s') or number to milliseconds
 * @param {string|number} duration
 * @returns {number} Milliseconds
 */
export const parseDurationToMs = (duration) => {
  if (typeof duration === 'number') {
    return duration;
  }
  if (typeof duration !== 'string') {
    return 7 * 24 * 60 * 60 * 1000; // default 7 days
  }

  const match = duration.match(/^(\d+)([dhms])?$/);
  if (!match) {
    return 7 * 24 * 60 * 60 * 1000;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'm':
      return value * 60 * 1000;
    case 's':
      return value * 1000;
    default:
      return value;
  }
};

/**
 * Computes base cookie options consistent between setting and clearing
 * @returns {import('express').CookieOptions}
 */
export const getBaseCookieOptions = () => ({
  httpOnly: true,
  secure: env.isProduction,
  sameSite: env.isProduction ? 'lax' : 'lax',
  path: '/',
});

/**
 * Sets the customer authentication JWT in an HttpOnly cookie
 *
 * @param {import('express').Response} res - Express response
 * @param {string} token - Signed JWT
 * @param {number} [maxAgeMs] - Cookie lifetime in milliseconds
 */
export const setAuthCookie = (res, token, maxAgeMs) => {
  const duration = maxAgeMs || parseDurationToMs(env.jwt.sessionTtl);
  const options = {
    ...getBaseCookieOptions(),
    maxAge: duration,
  };

  res.cookie(env.cookies.authCookieName, token, options);
};

/**
 * Clears the customer authentication cookie upon logout
 * Uses matching cookie path and security attributes.
 *
 * @param {import('express').Response} res - Express response
 */
export const clearAuthCookie = (res) => {
  res.clearCookie(env.cookies.authCookieName, getBaseCookieOptions());
};

export default {
  setAuthCookie,
  clearAuthCookie,
  getBaseCookieOptions,
  parseDurationToMs,
};
