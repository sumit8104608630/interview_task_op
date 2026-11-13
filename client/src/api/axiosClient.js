import axios from 'axios';

// In-memory CSRF token store (never stored in localStorage)
let inMemoryCsrfToken = null;

export const setCsrfToken = (token) => {
  inMemoryCsrfToken = token;
};

export const getCsrfToken = () => inMemoryCsrfToken;

// Determine base API URL
const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

/**
 * Centralized Axios instance configured for cookie-backed authentication,
 * CSRF token attachment, and unified error handling.
 */
export const apiClient = axios.create({
  baseURL,
  withCredentials: true, // Always send HttpOnly auth_token cookies
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 15000,
});

// Request interceptor: Attach CSRF token on state-changing requests if present
apiClient.interceptors.request.use(
  (config) => {
    if (inMemoryCsrfToken) {
      config.headers['x-csrf-token'] = inMemoryCsrfToken;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Extract CSRF token and normalize API responses
apiClient.interceptors.response.use(
  (response) => {
    // Capture CSRF token if returned in response body or headers
    if (response.data && response.data.data && response.data.data.csrfToken) {
      setCsrfToken(response.data.data.csrfToken);
    } else if (response.data && response.data.csrfToken) {
      setCsrfToken(response.data.csrfToken);
    } else if (response.headers && response.headers['x-csrf-token']) {
      setCsrfToken(response.headers['x-csrf-token']);
    }

    return response.data;
  },
  (error) => {
    // Normalize backend API error structure
    const responseData = error.response?.data;
    const status = error.response?.status;

    const normalizedError = {
      status: status || 500,
      code: responseData?.code || responseData?.error?.code || 'UNKNOWN_ERROR',
      message:
        responseData?.message ||
        responseData?.error?.message ||
        error.message ||
        'An unexpected error occurred. Please try again.',
      details: responseData?.error?.details || null,
      requestId: responseData?.requestId || null,
      raw: error,
    };

    return Promise.reject(normalizedError);
  }
);

export default apiClient;
