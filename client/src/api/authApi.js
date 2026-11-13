import apiClient from './axiosClient';

/**
 * Customer Authentication API Service
 */
export const authApi = {
  /**
   * Request an email OTP for customer registration or login
   * @param {object} payload
   * @param {string} payload.email
   * @param {string} [payload.fullName]
   * @returns {Promise<{ success: boolean, data: { flow: string }, message: string }>}
   */
  async sendOtp(payload) {
    return apiClient.post('/auth/send-otp', payload);
  },

  /**
   * Verify email OTP and complete customer registration or login with optional password setup
   * @param {object} payload
   * @param {string} payload.email
   * @param {string} payload.otp
   * @param {string} [payload.fullName]
   * @param {string} [payload.password]
   * @returns {Promise<{ success: boolean, data: { customer: object, csrfToken: string }, message: string }>}
   */
  async verifyOtp(payload) {
    return apiClient.post('/auth/verify-otp', payload);
  },

  /**
   * Authenticate customer using email and password
   * @param {object} payload
   * @param {string} payload.email
   * @param {string} payload.password
   * @returns {Promise<{ success: boolean, data: { customer: object, csrfToken: string }, message: string }>}
   */
  async login(payload) {
    return apiClient.post('/auth/login', payload);
  },

  /**
   * Request a password reset OTP code
   * @param {object} payload
   * @param {string} payload.email
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async forgotPassword(payload) {
    return apiClient.post('/auth/forgot-password', payload);
  },

  /**
   * Verify OTP and set a new customer password
   * @param {object} payload
   * @param {string} payload.email
   * @param {string} payload.otp
   * @param {string} payload.newPassword
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async resetPassword(payload) {
    return apiClient.post('/auth/reset-password', payload);
  },

  /**
   * Get currently authenticated customer profile
   * @returns {Promise<{ success: boolean, data: object }>}
   */
  async getMe() {
    return apiClient.get('/auth/me');
  },

  /**
   * Revoke current authentication session and clear cookie
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async logout() {
    return apiClient.post('/auth/logout');
  },
};

export default authApi;
