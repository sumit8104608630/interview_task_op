import axios from 'axios';
import { env } from '../../config/env.js';
import { otpClient } from '../otp/otpClient.js';

/**
 * HTTP Client adapter for the external OTP & Notification Microservice
 * Source: https://otp-microservise.vercel.app/
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
  }

  /**
   * Requests an email OTP (delegates to OtpClient)
   * @param {object} params
   * @param {string} params.email
   * @param {string} [params.purpose]
   * @param {string} [params.reference]
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async requestEmailOtp({ email, purpose, reference }) {
    return otpClient.sendOtp({ email, purpose, reference });
  }

  /**
   * Verifies an email OTP (delegates to OtpClient)
   * @param {object} params
   * @param {string} params.email
   * @param {string} params.otp
   * @param {string} [params.purpose]
   * @returns {Promise<{ valid: boolean, error?: string }>}
   */
  async verifyEmailOtp({ email, otp, purpose }) {
    return otpClient.verifyOtp({ email, otp, purpose });
  }

  /**
   * Sends booking confirmation notification to guest via POST /api/send-email
   *
   * @param {object} params
   * @param {string} params.email - Guest email address
   * @param {string} params.guestName - Guest full name
   * @param {object} params.bookingDetails - Booking info
   * @returns {Promise<{ success: boolean, messageId?: string }>}
   */
  async sendBookingConfirmation({ email, guestName, bookingDetails = {} }) {
    try {
      const subject = `Booking Confirmation - ${bookingDetails.bookingReference || 'Hotel Booking Portal'}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb;">Hotel Booking Confirmation</h2>
          <p>Dear <strong>${guestName}</strong>,</p>
          <p>Your hotel reservation has been confirmed!</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Booking Reference:</strong> ${bookingDetails.bookingReference || 'N/A'}</p>
            <p><strong>Check-In Date:</strong> ${bookingDetails.checkIn || 'N/A'}</p>
            <p><strong>Check-Out Date:</strong> ${bookingDetails.checkOut || 'N/A'}</p>
            <p><strong>Total Amount:</strong> ₹${bookingDetails.totalAmount || '0.00'}</p>
          </div>
          <p>We look forward to hosting you. Thank you for choosing our portal!</p>
        </div>
      `;

      const response = await this.client.post('/api/send-email', {
        to: email,
        subject,
        html,
        text: `Dear ${guestName}, your booking (${bookingDetails.bookingReference || ''}) is confirmed!`,
      });

      return {
        success: response.data?.success === true,
        messageId: response.data?.messageId,
      };
    } catch (error) {
      console.error('[NotificationClient.sendBookingConfirmation] Error:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Sends booking cancellation notification to guest via POST /api/send-email
   *
   * @param {object} params
   * @param {string} params.email - Guest email address
   * @param {string} params.guestName - Guest full name
   * @param {object} params.bookingDetails - Booking info
   * @returns {Promise<{ success: boolean, messageId?: string }>}
   */
  async sendBookingCancellation({ email, guestName, bookingDetails = {} }) {
    try {
      const subject = `Booking Cancelled - ${bookingDetails.bookingReference || 'Hotel Booking Portal'}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #dc2626;">Booking Cancellation Notice</h2>
          <p>Dear <strong>${guestName}</strong>,</p>
          <p>Your booking with reference <strong>${bookingDetails.bookingReference}</strong> has been cancelled as requested.</p>
          <p>If you did not request this cancellation, please contact our support team immediately.</p>
        </div>
      `;

      const response = await this.client.post('/api/send-email', {
        to: email,
        subject,
        html,
        text: `Dear ${guestName}, your booking (${bookingDetails.bookingReference}) has been cancelled.`,
      });

      return {
        success: response.data?.success === true,
        messageId: response.data?.messageId,
      };
    } catch (error) {
      console.error('[NotificationClient.sendBookingCancellation] Error:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export const notificationClient = new NotificationClient();
export default notificationClient;
