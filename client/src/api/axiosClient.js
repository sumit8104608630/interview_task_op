import axios from 'axios';

// In-memory CSRF token store (never stored in localStorage)
let inMemoryCsrfToken = null;

export const setCsrfToken = (token) => {
  inMemoryCsrfToken = token;
};

export const getCsrfToken = () => inMemoryCsrfToken;

// Determine base API URL (prefers relative '/api' to leverage Vite's reverse proxy seamlessly)
const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

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

    // Auto-redirect to login when customer session has expired or is unauthorized
    if (status === 401 && typeof window !== 'undefined') {
      const requestUrl = error.config?.url || '';
      const isAuthAttempt =
        requestUrl.includes('/auth/login') ||
        requestUrl.includes('/auth/verify-otp') ||
        requestUrl.includes('/auth/send-otp') ||
        requestUrl.includes('/auth/reset-password');

      if (!isAuthAttempt) {
        const isMeCheck = requestUrl.includes('/auth/me');
        const wasLoggedIn =
          typeof sessionStorage !== 'undefined' &&
          sessionStorage.getItem('was_authenticated') === 'true';

        const isExplicitSessionExpiry = [
          'SESSION_EXPIRED',
          'SESSION_REVOKED_OR_EXPIRED',
          'INVALID_TOKEN',
          'SESSION_REVOKED',
          'TOKEN_SUBJECT_MISMATCH',
        ].includes(normalizedError.code);

        // If not a silent initial guest /auth/me check, or if user was authenticated, redirect to login
        if (!isMeCheck || wasLoggedIn || isExplicitSessionExpiry) {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('was_authenticated');
          }

          const currentPath = window.location.pathname;
          const isAlreadyOnAuthPage =
            currentPath.startsWith('/login') ||
            currentPath.startsWith('/register') ||
            currentPath.startsWith('/forgot-password') ||
            currentPath.startsWith('/reset-password');

          if (!isAlreadyOnAuthPage) {
            const redirectTarget = encodeURIComponent(
              window.location.pathname + window.location.search
            );
            window.location.href = `/login?redirect=${redirectTarget}&expired=true`;
          }
        }
      }
    }

    return Promise.reject(normalizedError);
  }
);

export default apiClient;
