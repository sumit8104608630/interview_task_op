import axios from 'axios';
import { env } from '../../config/env.js';

/**
 * HTTP Client adapter for the external OTP & Notification Microservice
 *
 * NOTE: The endpoints, request payloads, and response envelopes below are
 * clearly marked placeholders. Do not finalize or assume upstream contracts
 * until the microservice API documentation and specification are provided.
 */
export class NotificationClient {
  constructor() {
    this.client = axios.create({
      baseURL: env.notificationService.baseUrl,
      timeout: env.notificationService.timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        ...(env.notificationService.apiKey && {
          'x-api-key': env.notificationService.apiKey,
          Authorization: `Bearer ${env.notificationService.apiKey}`,
        }),
      },
    });

    // Logging interceptors for outbound service requests
    this.client.interceptors.request.use((config) => {
      if (process.env.DEBUG_MICROSERVICE === 'true') {
        console.log('[NotificationClient Outbound]', {
          method: config.method?.toUpperCase(),
          url: `${config.baseURL}${config.url}`,
        });
      }
      return config;
    });
  }

  /**
   * [PLACEHOLDER] Requests an email OTP from the external microservice
   * @param {object} params
   * @param {string} params.email - Guest email address
   * @param {string} params.purpose - 'BOOKING' | 'CANCELLATION'
   * @param {string} [params.reference] - Optional booking reference
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async requestEmailOtp({ email, purpose, reference }) {
    console.log('[NotificationClient Placeholder] requestEmailOtp called for:', { email, purpose, reference });

    // PLACEHOLDER: Replace with actual endpoint once API contract is provided
    // Example: return (await this.client.post('/otp/send', { email, purpose, reference })).data;
    return {
      success: true,
      message: 'OTP dispatch initiated (Placeholder - awaiting external microservice contract)',
    };
  }

  /**
   * [PLACEHOLDER] Verifies an email OTP with the external microservice
   * @param {object} params
   * @param {string} params.email - Guest email address
   * @param {string} params.otp - OTP entered by user
   * @param {string} params.purpose - 'BOOKING' | 'CANCELLATION'
   * @param {string} [params.reference] - Optional booking reference
   * @returns {Promise<{ valid: boolean, verificationToken?: string }>}
   */
  async verifyEmailOtp({ email, otp, purpose, reference }) {
    console.log('[NotificationClient Placeholder] verifyEmailOtp called for:', { email, purpose, reference });

    // PLACEHOLDER: Replace with actual endpoint once API contract is provided
    // Example: return (await this.client.post('/otp/verify', { email, otp, purpose, reference })).data;
    return {
      valid: true,
      verificationToken: `placeholder-token-${Date.now()}`,
    };
  }

  /**
   * [PLACEHOLDER] Resends an email OTP via the external microservice
   * @param {object} params
   * @param {string} params.email - Guest email address
   * @param {string} params.purpose - 'BOOKING' | 'CANCELLATION'
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async resendOtp({ email, purpose }) {
    console.log('[NotificationClient Placeholder] resendOtp called for:', { email, purpose });

    // PLACEHOLDER: Replace with actual endpoint once API contract is provided
    return {
      success: true,
      message: 'OTP resent successfully (Placeholder)',
    };
  }

  /**
   * [PLACEHOLDER] Sends booking confirmation notification to guest
   * @param {object} params
   * @param {string} params.email - Guest email address
   * @param {string} params.guestName - Guest full name
   * @param {object} params.bookingDetails - Booking info (reference, hotel, dates, price)
   * @returns {Promise<{ success: boolean, messageId?: string }>}
   */
  async sendBookingConfirmation({ email, guestName, bookingDetails }) {
    console.log('[NotificationClient Placeholder] sendBookingConfirmation called for:', { email, guestName });

    // PLACEHOLDER: Replace with actual endpoint once API contract is provided
    return {
      success: true,
      messageId: `msg-confirm-${Date.now()}`,
    };
  }

  /**
   * [PLACEHOLDER] Sends booking cancellation notification to guest
   * @param {object} params
   * @param {string} params.email - Guest email address
   * @param {string} params.guestName - Guest full name
   * @param {object} params.bookingDetails - Booking info (reference, cancellationTimestamp)
   * @returns {Promise<{ success: boolean, messageId?: string }>}
   */
  async sendBookingCancellation({ email, guestName, bookingDetails }) {
    console.log('[NotificationClient Placeholder] sendBookingCancellation called for:', { email, guestName });

    // PLACEHOLDER: Replace with actual endpoint once API contract is provided
    return {
      success: true,
      messageId: `msg-cancel-${Date.now()}`,
    };
  }
}

export const notificationClient = new NotificationClient();
export default notificationClient;
