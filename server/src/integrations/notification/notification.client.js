import axios from 'axios';
import { env } from '../../config/env.js';
import { otpClient } from '../otp/otpClient.js';

/**
 * HTTP Client adapter for the external OTP & Notification Microservice
 * Source: https://otp-microservise.vercel.app/
 *
 * Implements isolated, resilient email notification and OTP communication.
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

    // Mock handler for deterministic unit & integration tests
    this.mockHandler = null;
  }

  /**
   * Sets mock handler for automated testing
   * @param {object|null} handler
   */
  setMockHandler(handler) {
    this.mockHandler = handler;
  }

  /**
   * Clears mock handler
   */
  clearMockHandler() {
    this.mockHandler = null;
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
   * Generic low-level email sender conforming strictly to microservice contract:
   * POST /api/send-email with body: { to, subject, html, text }
   *
   * @param {object} params
   * @param {string|string[]} params.to
   * @param {string} params.subject
   * @param {string} [params.html]
   * @param {string} [params.text]
   * @returns {Promise<{ success: boolean, messageId?: string, error?: string, status?: number }>}
   */
  async sendEmail({ to, subject, html, text }) {
    if (this.mockHandler?.sendEmail) {
      return this.mockHandler.sendEmail({ to, subject, html, text });
    }

    try {
      const response = await this.client.post('/api/send-email', {
        to,
        subject,
        html,
        text,
      });

      const data = response.data || {};
      const isSuccess = response.status >= 200 && response.status < 300 && (data.success === true || !!data.messageId);

      return {
        success: isSuccess,
        messageId: data.messageId,
        message: data.message,
      };
    } catch (error) {
      const status = error.response?.status;
      const errorMsg = error.response?.data?.message || error.message || 'Notification service request failed';
      return {
        success: false,
        error: errorMsg,
        status,
      };
    }
  }

  /**
   * Formats and dispatches a Booking Confirmed notification
   *
   * Required fields per Phase 6 specifications:
   * - bookingReference
   * - hotelName
   * - roomCategory
   * - guestName
   * - checkIn
   * - checkOut
   * - numberOfRooms (roomsCount)
   * - nights
   * - totalAmount
   * - currency
   *
   * @param {object} params
   * @param {string} params.email - Recipient email
   * @param {string} params.guestName - Recipient full name
   * @param {object} params.bookingDetails - Complete confirmed booking information
   * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
   */
  async sendBookingConfirmation({ email, guestName, bookingDetails = {} }) {
    if (this.mockHandler?.sendBookingConfirmation) {
      return this.mockHandler.sendBookingConfirmation({ email, guestName, bookingDetails });
    }

    const ref = bookingDetails.bookingReference || 'N/A';
    const hotel = bookingDetails.hotelName || 'Luxury Hotel';
    const roomCategory = bookingDetails.roomCategory || bookingDetails.roomName || 'Standard Room';
    const checkIn = bookingDetails.checkIn || 'N/A';
    const checkOut = bookingDetails.checkOut || 'N/A';
    const roomsCount = bookingDetails.numberOfRooms || bookingDetails.roomsCount || 1;
    const nights = bookingDetails.nights || 1;
    const currency = bookingDetails.currency || 'INR';
    const totalAmount = bookingDetails.totalAmount != null ? Number(bookingDetails.totalAmount).toFixed(2) : '0.00';

    const subject = `Booking Confirmation - ${ref} | ${hotel}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #2563eb; margin-top: 0;">Hotel Booking Confirmation</h2>
        <p>Dear <strong>${guestName}</strong>,</p>
        <p>Your hotel reservation has been successfully confirmed. Below are your booking details:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; color: #64748b;">Booking Reference</td>
            <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #0f172a;">${ref}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; color: #64748b;">Hotel</td>
            <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #0f172a;">${hotel}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; color: #64748b;">Room Category</td>
            <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #0f172a;">${roomCategory}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; color: #64748b;">Stay Dates</td>
            <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #0f172a;">${checkIn} to ${checkOut} (${nights} ${nights === 1 ? 'night' : 'nights'})</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; color: #64748b;">Number of Rooms</td>
            <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #0f172a;">${roomsCount}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; font-weight: 600; font-size: 16px; color: #0f172a;">Total Amount</td>
            <td style="padding: 12px 0; text-align: right; font-weight: 700; font-size: 18px; color: #2563eb;">${currency} ${totalAmount}</td>
          </tr>
        </table>

        <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
          You can look up or manage this booking at any time using your booking reference <strong>${ref}</strong> and email address.
        </p>
        <p style="margin-top: 24px; font-size: 14px; color: #334155;">We look forward to welcoming you!</p>
      </div>
    `;

    const text = `
Hotel Booking Confirmation
Dear ${guestName},

Your hotel reservation is confirmed!
Booking Reference: ${ref}
Hotel: ${hotel}
Room Category: ${roomCategory}
Check-In: ${checkIn}
Check-Out: ${checkOut}
Nights: ${nights}
Rooms: ${roomsCount}
Total Amount: ${currency} ${totalAmount}

Thank you for booking with us!
    `.trim();

    return this.sendEmail({
      to: email,
      subject,
      html,
      text,
    });
  }

  /**
   * Formats and dispatches a Booking Cancelled notification
   *
   * Required fields per Phase 6 specifications:
   * - bookingReference
   * - hotelName
   * - guestName
   * - cancellationTimestamp
   * - cancellationStatus
   *
   * @param {object} params
   * @param {string} params.email - Recipient email
   * @param {string} params.guestName - Recipient full name
   * @param {object} params.bookingDetails - Complete cancellation details
   * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
   */
  async sendBookingCancellation({ email, guestName, bookingDetails = {} }) {
    if (this.mockHandler?.sendBookingCancellation) {
      return this.mockHandler.sendBookingCancellation({ email, guestName, bookingDetails });
    }

    const ref = bookingDetails.bookingReference || 'N/A';
    const hotel = bookingDetails.hotelName || 'Luxury Hotel';
    const timestamp = bookingDetails.cancellationTimestamp || bookingDetails.cancelledAt || new Date().toISOString();
    const status = bookingDetails.cancellationStatus || 'CANCELLED';

    const subject = `Booking Cancelled - ${ref} | ${hotel}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #dc2626; margin-top: 0;">Booking Cancellation Notice</h2>
        <p>Dear <strong>${guestName}</strong>,</p>
        <p>Your booking with reference <strong>${ref}</strong> has been cancelled as requested.</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; color: #64748b;">Booking Reference</td>
            <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #0f172a;">${ref}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; color: #64748b;">Hotel</td>
            <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #0f172a;">${hotel}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; color: #64748b;">Cancellation Status</td>
            <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #dc2626;">${status}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #64748b;">Cancellation Timestamp</td>
            <td style="padding: 10px 0; text-align: right; font-weight: 500; color: #0f172a;">${timestamp}</td>
          </tr>
        </table>

        <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
          The room inventory for your stay has been released. If you did not authorize this cancellation, please contact our support team immediately.
        </p>
      </div>
    `;

    const text = `
Booking Cancellation Notice
Dear ${guestName},

Your booking has been cancelled:
Booking Reference: ${ref}
Hotel: ${hotel}
Status: ${status}
Cancellation Timestamp: ${timestamp}

If you did not request this, please contact support immediately.
    `.trim();

    return this.sendEmail({
      to: email,
      subject,
      html,
      text,
    });
  }
}

export const notificationClient = new NotificationClient();
export default notificationClient;
