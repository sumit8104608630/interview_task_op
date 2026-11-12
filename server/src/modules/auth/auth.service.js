import crypto from 'crypto';
import { authRepository } from './auth.repository.js';
import { otpClient } from '../../integrations/otp/otpClient.js';
import { signCustomerToken } from '../../utils/jwt.js';
import { normalizeEmail } from '../../utils/normalizeEmail.js';
import { parseDurationToMs } from './auth.cookies.js';
import { env } from '../../config/env.js';
import { AppError } from '../../middleware/error.middleware.js';
import { ERROR_CODES, ERROR_MESSAGES } from '../../constants/errorMessages.js';

/**
 * Customer Authentication Business Logic Service
 * Handles passwordless registration and login via email OTP,
 * session lifecycle management, and active session verification.
 */
export class AuthService {
  /**
   * Dispatches an email OTP for customer registration or login
   * Employs generic response messaging to prevent email enumeration attacks.
   *
   * @param {object} params
   * @param {string} params.email - Raw email input
   * @param {string} [params.fullName] - Full name (present for registration)
   * @returns {Promise<{ success: boolean, message: string, flow: 'REGISTRATION'|'LOGIN' }>}
   */
  async sendOtp({ email, fullName }) {
    const normalized = normalizeEmail(email);
    const existingCustomer = await authRepository.findCustomerByEmail(normalized);

    let flow = 'REGISTRATION';

    if (existingCustomer) {
      flow = 'LOGIN';

      // If customer account is disabled, do not send OTP, but return generic success to prevent enumeration
      if (existingCustomer.status !== 'ACTIVE') {
        console.warn(`[AuthService.sendOtp] Disabled customer attempted login: ${normalized}`);
        return {
          success: true,
          message: 'If the email address is valid, a one-time verification code has been dispatched.',
          flow,
        };
      }

      // Dispatch login OTP via external microservice
      await otpClient.sendOtp({
        email: normalized,
        purpose: 'LOGIN',
      });
    } else {
      flow = 'REGISTRATION';

      // If fullName is not provided when an unknown email is submitted, do not create unverified account
      if (fullName && fullName.trim().length >= 2) {
        await otpClient.sendOtp({
          email: normalized,
          purpose: 'REGISTRATION',
          fullName: fullName.trim(),
        });
      } else {
        // Safe generic behavior for login attempt on non-existent account
        console.log(`[AuthService.sendOtp] Login attempt on non-existent email: ${normalized}`);
      }
    }

    return {
      success: true,
      message: 'If the email address is valid, a one-time verification code has been dispatched.',
      flow,
    };
  }

  /**
   * Verifies OTP and completes registration or login authentication
   *
   * @param {object} params
   * @param {string} params.email
   * @param {string} params.otp
   * @param {string} [params.fullName]
   * @param {string} [params.userAgent]
   * @returns {Promise<{ customer: object, token: string, maxAgeMs: number }>}
   */
  async verifyOtpAndAuthenticate({ email, otp, fullName, userAgent = 'Unknown' }) {
    const normalized = normalizeEmail(email);
    const existingCustomer = await authRepository.findCustomerByEmail(normalized);

    const purpose = existingCustomer ? 'LOGIN' : 'REGISTRATION';

    // Registration requires full name
    if (!existingCustomer && (!fullName || fullName.trim().length < 2)) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        'Full name is required for new customer registration.',
        400
      );
    }

    // Verify OTP via external microservice adapter (fail-closed)
    const verification = await otpClient.verifyOtp({
      email: normalized,
      otp,
      purpose,
    });

    if (!verification.valid) {
      throw new AppError(
        ERROR_CODES.OTP_INVALID,
        verification.error || ERROR_MESSAGES[ERROR_CODES.OTP_INVALID],
        400
      );
    }

    let customer = existingCustomer;

    if (existingCustomer) {
      // Disallow login for inactive/disabled customers
      if (existingCustomer.status !== 'ACTIVE') {
        throw new AppError(
          'ACCOUNT_DISABLED',
          'This customer account is disabled or suspended. Please contact support.',
          403
        );
      }

      // Update last_login_at timestamp
      customer = await authRepository.updateLastLogin(existingCustomer.id);
    } else {
      // Create new customer record upon verified OTP
      customer = await authRepository.createCustomer({
        email: normalized,
        fullName: fullName.trim(),
      });
    }

    // Create authentication session record
    const sessionId = crypto.randomUUID();
    const durationMs = parseDurationToMs(env.jwt.sessionTtl);
    const expiresAt = new Date(Date.now() + durationMs);

    await authRepository.createSession({
      id: sessionId,
      customerId: customer.id,
      userAgent,
      expiresAt,
    });

    // Generate signed JWT with sub = customerId and jti = sessionId
    const token = signCustomerToken({
      customerId: customer.id,
      sessionId,
    });

    return {
      customer: {
        id: customer.id,
        email: customer.email,
        fullName: customer.full_name,
        phone: customer.phone,
        status: customer.status,
      },
      token,
      maxAgeMs: durationMs,
    };
  }

  /**
   * Retrieves authenticated customer details from valid session
   *
   * @param {string} sessionId - Corresponds to JWT jti
   * @returns {Promise<object>} Customer profile information
   */
  async getCurrentCustomer(sessionId) {
    if (!sessionId) {
      throw new AppError('UNAUTHORIZED', 'Session identifier is missing.', 401);
    }

    const sessionWithCustomer = await authRepository.findActiveSessionWithCustomer(sessionId);

    if (!sessionWithCustomer) {
      throw new AppError(
        'SESSION_REVOKED_OR_EXPIRED',
        'Authentication session is invalid, expired, or has been revoked.',
        401
      );
    }

    if (sessionWithCustomer.revoked_at) {
      throw new AppError(
        'SESSION_REVOKED',
        'Authentication session has been revoked. Please log in again.',
        401
      );
    }

    if (new Date(sessionWithCustomer.expires_at) <= new Date()) {
      throw new AppError(
        'SESSION_EXPIRED',
        'Authentication session has expired. Please log in again.',
        401
      );
    }

    if (sessionWithCustomer.status !== 'ACTIVE') {
      throw new AppError(
        'ACCOUNT_DISABLED',
        'Customer account is currently disabled or inactive.',
        403
      );
    }

    return {
      id: sessionWithCustomer.id,
      email: sessionWithCustomer.email,
      fullName: sessionWithCustomer.full_name,
      phone: sessionWithCustomer.phone,
      status: sessionWithCustomer.status,
      lastLoginAt: sessionWithCustomer.last_login_at,
    };
  }

  /**
   * Revokes an authentication session upon customer logout
   *
   * @param {string} [sessionId] - Active session ID (jti)
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async logout(sessionId) {
    if (sessionId) {
      await authRepository.revokeSession(sessionId);
    }
    return {
      success: true,
      message: 'Logged out successfully.',
    };
  }
}

export const authService = new AuthService();
export default authService;
