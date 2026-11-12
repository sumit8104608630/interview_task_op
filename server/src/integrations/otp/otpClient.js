import axios from 'axios';
import { env } from '../../config/env.js';

/**
 * OTP Microservice Integration Adapter
 *
 * Implements client communication with the deployed OTP & Notification Microservice:
 * API Source: https://otp-microservise.vercel.app/
 *
 * Verified Endpoints:
 * - GET  /api/health      → Health check
 * - POST /api/send-otp    → Body: { email } → Response: { success, message, expiresIn }
 * - POST /api/verify-otp  → Body: { email, otp } → Response: { success, message }
 * - POST /api/send-email  → Body: { to, subject, html, text, ... }
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

    // Mock handler hook for deterministic unit & integration test suites
    this.mockHandler = null;
  }

  /**
   * Sets or clears a mock handler for automated tests
   * @param {object|null} handler
   */
  setMockHandler(handler) {
    this.mockHandler = handler;
  }

  /**
   * Clears active mock handler
   */
  clearMockHandler() {
    this.mockHandler = null;
  }

  /**
   * Dispatches an email OTP using the external microservice
   *
   * @param {object} params
   * @param {string} params.email - Normalized customer email
   * @param {'REGISTRATION'|'LOGIN'} [params.purpose] - Internal context
   * @param {string} [params.fullName] - Optional guest name
   * @returns {Promise<{ success: boolean, message: string, expiresIn?: number }>}
   */
  async sendOtp({ email, purpose, fullName }) {
    if (this.mockHandler?.sendOtp) {
      return this.mockHandler.sendOtp({ email, purpose, fullName });
    }

    try {
      // Endpoint contract: POST /api/send-otp with body: { email }
      const response = await this.client.post('/api/send-otp', {
        email,
      });

      const data = response.data || {};
      const isSuccess = response.status >= 200 && response.status < 300 && data.success === true;

      return {
        success: isSuccess,
        message: data.message || 'Verification code dispatched.',
        expiresIn: data.expiresIn,
      };
    } catch (error) {
      console.error('[OtpClient.sendOtp] External microservice error:', {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
      });

      // Fail-closed with non-leaking user message
      return {
        success: false,
        message: error.response?.data?.message || 'Unable to dispatch verification code at this time.',
        error: error.message,
      };
    }
  }

  /**
   * Verifies an email OTP using the external microservice
   *
   * @param {object} params
   * @param {string} params.email - Normalized customer email
   * @param {string} params.otp - User entered OTP digits
   * @param {'REGISTRATION'|'LOGIN'} [params.purpose] - Internal context
   * @returns {Promise<{ valid: boolean, message?: string, error?: string }>}
   */
  async verifyOtp({ email, otp, purpose }) {
    if (this.mockHandler?.verifyOtp) {
      return this.mockHandler.verifyOtp({ email, otp, purpose });
    }

    try {
      // Endpoint contract: POST /api/verify-otp with body: { email, otp }
      const response = await this.client.post('/api/verify-otp', {
        email,
        otp,
      });

      const data = response.data || {};
      const isValid = response.status === 200 && data.success === true;

      if (!isValid) {
        return {
          valid: false,
          error: data.message || 'Invalid or expired verification code.',
        };
      }

      return {
        valid: true,
        message: data.message || 'OTP verified successfully.',
      };
    } catch (error) {
      console.error('[OtpClient.verifyOtp] External microservice error:', {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
      });

      const errorMessage =
        error.response?.data?.message ||
        (error.response?.status === 400
          ? 'Invalid or expired verification code.'
          : 'Verification service temporarily unavailable.');

      return {
        valid: false,
        error: errorMessage,
      };
    }
  }
}

export const otpClient = new OtpClient();
export default otpClient;
