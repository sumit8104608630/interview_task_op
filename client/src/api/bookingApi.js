import apiClient from './axiosClient';

/**
 * Booking Creation, Lookup & Cancellation API Service
 */
export const bookingApi = {
  /**
   * Create an atomic booking reservation for registered customer or guest
   * @param {object} payload
   * @param {string} payload.roomTypeId
   * @param {string} payload.checkIn
   * @param {string} payload.checkOut
   * @param {number} [payload.rooms=1]
   * @param {object} payload.guest
   * @param {string} payload.guest.name
   * @param {string} payload.guest.email
   * @param {string} [payload.guest.phone]
   * @param {string} [payload.otp]
   * @param {string} [idempotencyKey] - Unique UUID to prevent duplicate submissions
   * @returns {Promise<{ success: boolean, data: object, message: string }>}
   */
  async createBooking(payload, idempotencyKey = null) {
    const headers = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    return apiClient.post('/bookings', payload, { headers });
  },

  /**
   * Look up an existing booking by reference and guest email
   * @param {object} payload
   * @param {string} payload.bookingReference
   * @param {string} payload.email
   * @returns {Promise<{ success: boolean, data: object }>}
   */
  async lookupBooking(payload) {
    return apiClient.post('/bookings/lookup', payload);
  },

  /**
   * Retrieve booking history for authenticated customer
   * @param {object} [params]
   * @param {number} [params.page=1]
   * @param {number} [params.limit=10]
   * @param {string} [params.status]
   * @returns {Promise<{ success: boolean, data: Array<object>, meta: object }>}
   */
  async getMyBookings(params = {}) {
    return apiClient.get('/bookings/my-bookings', { params });
  },

  /**
   * Request an email OTP for booking cancellation
   * @param {object} payload
   * @param {string} payload.bookingReference
   * @param {string} payload.email
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async sendCancellationOtp(payload) {
    return apiClient.post('/bookings/cancellation/send-otp', payload);
  },

  /**
   * Verify cancellation OTP and receive single-use, short-lived cancellationProof
   * @param {object} payload
   * @param {string} payload.bookingReference
   * @param {string} payload.email
   * @param {string} payload.otp
   * @returns {Promise<{ success: boolean, data: { cancellationProof: string, expiresAt: string, bookingReference: string }, message: string }>}
   */
  async verifyCancellationOtp(payload) {
    return apiClient.post('/bookings/cancellation/verify-otp', payload);
  },

  /**
   * Confirm booking cancellation using single-use cancellation proof
   * @param {object} payload
   * @param {string} payload.bookingReference
   * @param {string} payload.email
   * @param {string} payload.cancellationProof
   * @param {string} [payload.reason]
   * @returns {Promise<{ success: boolean, data: object, message: string }>}
   */
  async cancelBooking(payload) {
    return apiClient.post('/bookings/cancellation/cancel', payload);
  },
};

export default bookingApi;
