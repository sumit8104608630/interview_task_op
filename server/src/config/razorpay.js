import Razorpay from 'razorpay';
import { env } from './env.js';
import { AppError } from '../middleware/error.middleware.js';
import { ERROR_CODES } from '../constants/errorMessages.js';

let razorpayInstance = null;
let mockRazorpayInstance = null;

/**
 * Allows injecting a mock Razorpay client for deterministic isolated testing.
 * @param {object|null} mock
 */
export const setMockRazorpayClient = (mock = null) => {
  mockRazorpayInstance = mock;
};

/**
 * Validates and retrieves the singleton Razorpay SDK instance.
 * Throws a sanitized configuration error if credentials are missing.
 *
 * @returns {Razorpay}
 */
export const getRazorpayClient = () => {
  if (mockRazorpayInstance) {
    return mockRazorpayInstance;
  }

  const keyId = env.razorpay.keyId;
  const keySecret = env.razorpay.keySecret;

  if (!keyId || !keySecret) {
    throw new AppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      'Payment gateway configuration is missing or incomplete on the server.',
      503
    );
  }

  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  return razorpayInstance;
};

/**
 * Returns public Razorpay configuration for client checkout initialization.
 * Only the public key ID is exposed. The secret is strictly guarded.
 *
 * @returns {{ keyId: string, currency: string }}
 */
export const getPublicRazorpayConfig = () => {
  const keyId = env.razorpay.keyId;
  if (!keyId) {
    throw new AppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      'Payment gateway public key is not configured on the server.',
      503
    );
  }

  return {
    keyId,
    currency: env.razorpay.currency || 'INR',
  };
};

export default getRazorpayClient;
