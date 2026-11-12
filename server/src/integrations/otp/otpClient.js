import axios from 'axios';
import { env } from '../../config/env.js';

/**
 * OTP Microservice Integration Adapter
 *
 * Encapsulates all outbound communication with the external OTP/Notification Microservice.
 *
 * DESIGN CONTRACT & MISSING DETAILS DOCUMENTATION:
 * The external microservice documentation is pending delivery from the evaluator/maintainer.
 * Required specification details to confirm before production live switch:
 *   1. Precise endpoint URI paths (Assumed convention: /otp/send and /otp/verify)
 *   2. Request payload schema (Assumed convention: { email, purpose, fullName })
 *   3. Service-to-service authentication header (Assumed: x-api-key and Authorization: Bearer)
 *   4. Response envelope (Assumed: { success: boolean, message?: string, verified?: boolean })
 *   5. Error codes for expired OTP vs invalid OTP vs rate limits
 *
 * FAIL-CLOSED BEHAVIOR:
 * When live requests fail, time out, or receive ambiguous status codes, this adapter
 * intentionally fails closed by rejecting verification to preserve authentication security.
 */
export class OtpClient {
  constructor() {
    this.client = axios.create({
      baseURL: env.otpService.baseUrl,
      timeout: env.otpService.timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        ...(env.otpService.apiKey && {
          'x-api-key': env.otpService.apiKey,
          Authorization: `Bearer ${env.otpService.apiKey}`,
        }),
      },
    });

    // Mock handler for automated testing and isolated development
    this.mockHandler = null;
  }

  /**
   * Sets or clears a mock handler for automated tests
   * @param {object|null} handler - Object implementing sendOtp and verifyOtp
   */
  setMockHandler(handler) {
    this.mockHandler = handler;
  }

  /**
   * Clears the active mock handler
   */
  clearMockHandler() {
    this.mockHandler = null;
  }

  /**
   * Requests an email OTP dispatch via the external microservice
   *
   * @param {object} params
   * @param {string} params.email - Normalized customer email
   * @param {'REGISTRATION'|'LOGIN'} params.purpose - Purpose of the OTP
   * @param {string} [params.fullName] - Required for registration
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async sendOtp({ email, purpose, fullName }) {
    if (this.mockHandler?.sendOtp) {
      return this.mockHandler.sendOtp({ email, purpose, fullName });
    }

    try {
      const response = await this.client.post('/otp/send', {
        email,
        purpose,
        ...(fullName && { fullName }),
      });

      const isSuccess = response.status >= 200 && response.status < 300 &&
        (response.data?.success === true || response.data?.status === 'success');

      return {
        success: isSuccess,
        message: response.data?.message || 'Verification code dispatched.',
      };
    } catch (error) {
      console.error('[OtpClient.sendOtp] External microservice error:', {
        status: error.response?.status,
        message: error.message,
      });

      // Fail-closed with safe non-leaking message
      return {
        success: false,
        message: 'Unable to dispatch verification code at this time.',
        error: error.message,
      };
    }
  }

  /**
   * Verifies an email OTP with the external microservice
   *
   * @param {object} params
   * @param {string} params.email - Normalized customer email
   * @param {string} params.otp - User provided OTP digits
   * @param {'REGISTRATION'|'LOGIN'} params.purpose - Verification purpose
   * @returns {Promise<{ valid: boolean, error?: string }>}
   */
  async verifyOtp({ email, otp, purpose }) {
    if (this.mockHandler?.verifyOtp) {
      return this.mockHandler.verifyOtp({ email, otp, purpose });
    }

    try {
      const response = await this.client.post('/otp/verify', {
        email,
        otp,
        purpose,
      });

      const isValid = response.status === 200 && (
        response.data?.valid === true ||
        response.data?.verified === true ||
        response.data?.success === true
      );

      if (!isValid) {
        return {
          valid: false,
          error: response.data?.message || 'Invalid or expired verification code.',
        };
      }

      return { valid: true };
    } catch (error) {
      console.error('[OtpClient.verifyOtp] External microservice error:', {
        status: error.response?.status,
        message: error.message,
      });

      const errorMessage = error.response?.data?.message ||
        (error.response?.status === 400 ? 'Invalid or expired verification code.' : 'Verification service temporarily unavailable.');

      // Fail-closed on any network or upstream failure
      return {
        valid: false,
        error: errorMessage,
      };
    }
  }
}

export const otpClient = new OtpClient();
export default otpClient;
