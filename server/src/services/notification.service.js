import { notificationClient } from '../integrations/notification/notification.client.js';

/**
 * Notification Business Service
 * Orchestrates customer notifications and OTP verifications with the external microservice.
 * Adheres to principle: Notification failures must never revert committed database bookings.
 */
export class NotificationService {
  /**
   * Dispatches an email OTP request
   * @param {object} params
   * @param {string} params.email
   * @param {'BOOKING'|'CANCELLATION'} params.purpose
   * @param {string} [params.reference]
   * @returns {Promise<object>}
   */
  async requestOtp({ email, purpose, reference }) {
    return notificationClient.requestEmailOtp({ email, purpose, reference });
  }

  /**
   * Verifies an email OTP
   * @param {object} params
   * @param {string} params.email
   * @param {string} params.otp
   * @param {'BOOKING'|'CANCELLATION'} params.purpose
   * @param {string} [params.reference]
   * @returns {Promise<object>}
   */
  async verifyOtp({ email, otp, purpose, reference }) {
    return notificationClient.verifyEmailOtp({ email, otp, purpose, reference });
  }

  /**
   * Resends an OTP
   * @param {object} params
   * @param {string} params.email
   * @param {'BOOKING'|'CANCELLATION'} params.purpose
   * @returns {Promise<object>}
   */
  async resendOtp({ email, purpose }) {
    return notificationClient.resendOtp({ email, purpose });
  }

  /**
   * Sends booking confirmation (safe wrapper, does not throw if external service is down)
   * @param {object} params
   * @param {string} params.email
   * @param {string} params.guestName
   * @param {object} params.bookingDetails
   */
  async sendBookingConfirmationSafe({ email, guestName, bookingDetails }) {
    try {
      await notificationClient.sendBookingConfirmation({ email, guestName, bookingDetails });
    } catch (err) {
      console.error('[NotificationService] Booking confirmation email dispatch failed:', err.message);
      // Non-blocking: outbox worker handles background retry
    }
  }

  /**
   * Sends booking cancellation notice (safe wrapper)
   * @param {object} params
   * @param {string} params.email
   * @param {string} params.guestName
   * @param {object} params.bookingDetails
   */
  async sendBookingCancellationSafe({ email, guestName, bookingDetails }) {
    try {
      await notificationClient.sendBookingCancellation({ email, guestName, bookingDetails });
    } catch (err) {
      console.error('[NotificationService] Booking cancellation email dispatch failed:', err.message);
      // Non-blocking
    }
  }
}

export const notificationService = new NotificationService();
export default notificationService;
