import apiClient from './axiosClient';

/**
 * Razorpay Payment API Client
 */
export const paymentApi = {
  /**
   * Retrieves public Razorpay configuration (Key ID, currency)
   */
  async getConfig() {
    return apiClient.get('/payments/config');
  },

  /**
   * Creates or retrieves a Razorpay order for an existing pending reservation
   * @param {object} payload
   * @param {string} payload.bookingReference
   * @param {string} [payload.guestEmail]
   */
  async createOrder(payload) {
    return apiClient.post('/payments/create-order', payload);
  },

  /**
   * Cryptographically verifies Razorpay signature on server and confirms reservation
   * @param {object} payload
   * @param {string} payload.razorpay_order_id
   * @param {string} payload.razorpay_payment_id
   * @param {string} payload.razorpay_signature
   */
  async verifyPayment(payload) {
    return apiClient.post('/payments/verify', payload);
  },

  /**
   * Retrieves authoritative booking and payment details
   * @param {string} reference
   */
  async getBookingPaymentDetails(reference) {
    return apiClient.get(`/payments/booking/${encodeURIComponent(reference)}`);
  },
};

export default paymentApi;
