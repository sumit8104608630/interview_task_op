import apiClient from './axiosClient';

/**
 * Booking Creation & Management API Service
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
};

export default bookingApi;
