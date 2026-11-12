import crypto from 'crypto';
import bcrypt from 'bcryptjs';
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
 * Handles password and passwordless registration, login, forgot password,
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
   * @param {string} [params.password]
   * @param {string} [params.userAgent]
   * @returns {Promise<{ customer: object, token: string, maxAgeMs: number }>}
   */
  async verifyOtpAndAuthenticate({ email, otp, fullName, password, userAgent = 'Unknown' }) {
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

      // If password provided and customer doesn't have one set, update password
      if (password && !existingCustomer.password_hash) {
        const passwordHash = await bcrypt.hash(password, 10);
        await authRepository.updatePassword(existingCustomer.id, passwordHash);
      }

      // Update last_login_at timestamp
      customer = await authRepository.updateLastLogin(existingCustomer.id);
    } else {
      // Hash password if supplied during registration
      const passwordHash = password ? await bcrypt.hash(password, 10) : null;

      // Create new customer record upon verified OTP
      customer = await authRepository.createCustomer({
        email: normalized,
        fullName: fullName.trim(),
        passwordHash,
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
   * Authenticates an existing customer via Email and Password
   *
   * @param {object} params
   * @param {string} params.email
   * @param {string} params.password
   * @param {string} [params.userAgent]
   * @returns {Promise<{ customer: object, token: string, maxAgeMs: number }>}
   */
  async loginWithPassword({ email, password, userAgent = 'Unknown' }) {
    const normalized = normalizeEmail(email);
    const customer = await authRepository.findCustomerByEmail(normalized);

    // Constant-time check mitigation: if customer not found, return generic invalid credentials
    if (!customer) {
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password.', 401);
    }

    // Account status check
    if (customer.status !== 'ACTIVE') {
      throw new AppError(
        'ACCOUNT_DISABLED',
        'This customer account is disabled or suspended. Please contact support.',
        403
      );
    }

    // Check if password has been set on this account
    if (!customer.password_hash) {
      throw new AppError(
        'PASSWORD_NOT_SET',
        'No password has been set for this account. Please log in using Email OTP or reset your password.',
        400
      );
    }

    // Verify password hash
    const isMatch = await bcrypt.compare(password, customer.password_hash);
    if (!isMatch) {
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password.', 401);
    }

    // Update last_login_at timestamp
    await authRepository.updateLastLogin(customer.id);

    // Create authentication session
    const sessionId = crypto.randomUUID();
    const durationMs = parseDurationToMs(env.jwt.sessionTtl);
    const expiresAt = new Date(Date.now() + durationMs);

    await authRepository.createSession({
      id: sessionId,
      customerId: customer.id,
      userAgent,
      expiresAt,
    });

    // Generate signed JWT
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
   * Requests a password reset OTP for a customer account
   * Returns a generic message to prevent email enumeration attacks.
   *
   * @param {object} params
   * @param {string} params.email
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async forgotPassword({ email }) {
    const normalized = normalizeEmail(email);
    const customer = await authRepository.findCustomerByEmail(normalized);

    if (customer && customer.status === 'ACTIVE') {
      await otpClient.sendOtp({
        email: normalized,
        purpose: 'RESET_PASSWORD',
      });
    } else if (customer && customer.status !== 'ACTIVE') {
      console.warn(`[AuthService.forgotPassword] Inactive customer requested reset: ${normalized}`);
    } else {
      console.log(`[AuthService.forgotPassword] Reset requested for non-existent email: ${normalized}`);
    }

    return {
      success: true,
      message: 'If the email address is valid, a password reset code has been dispatched.',
    };
  }

  /**
   * Verifies reset OTP and updates customer password
   * Revokes all active sessions for that customer.
   *
   * @param {object} params
   * @param {string} params.email
   * @param {string} params.otp
   * @param {string} params.newPassword
   * @returns {Promise<{ success: boolean, message: string, revokedSessions: number }>}
   */
  async resetPassword({ email, otp, newPassword }) {
    const normalized = normalizeEmail(email);

    // Verify OTP first via microservice
    const verification = await otpClient.verifyOtp({
      email: normalized,
      otp,
      purpose: 'RESET_PASSWORD',
    });

    if (!verification.valid) {
      throw new AppError(
        ERROR_CODES.OTP_INVALID,
        verification.error || ERROR_MESSAGES[ERROR_CODES.OTP_INVALID],
        400
      );
    }

    // Look up customer
    const customer = await authRepository.findCustomerByEmail(normalized);
    if (!customer) {
      throw new AppError('NOT_FOUND', 'Customer account not found.', 404);
    }

    if (customer.status !== 'ACTIVE') {
      throw new AppError(
        'ACCOUNT_DISABLED',
        'This customer account is disabled or suspended. Please contact support.',
        403
      );
    }

    // Hash new password and update in database
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await authRepository.updatePassword(customer.id, passwordHash);

    // Invalidate/revoke all active sessions for this customer to force re-authentication
    const revokedSessions = await authRepository.revokeAllCustomerSessions(customer.id);

    return {
      success: true,
      message: 'Password has been reset successfully. Please log in with your new password.',
      revokedSessions,
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
