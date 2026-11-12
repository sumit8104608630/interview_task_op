import { authService } from './auth.service.js';
import { setAuthCookie, clearAuthCookie } from './auth.cookies.js';
import { setCsrfCookie } from '../../middleware/csrf.middleware.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { verifyCustomerToken } from '../../utils/jwt.js';
import { env } from '../../config/env.js';

/**
 * Controller handling Customer Authentication HTTP Endpoints
 * Free of database queries and business logic; maps HTTP input to service calls.
 */
export class AuthController {
  /**
   * POST /api/auth/send-otp
   * Dispatches email OTP for customer registration or login
   */
  sendOtp = asyncHandler(async (req, res) => {
    const { email, fullName } = req.body;
    const result = await authService.sendOtp({ email, fullName });

    // Attach fresh CSRF cookie for client-side state transitions
    setCsrfCookie(res);

    return sendSuccess(res, {
      statusCode: 200,
      message: result.message,
      data: {
        flow: result.flow,
      },
    });
  });

  /**
   * POST /api/auth/verify-otp
   * Verifies OTP, persists customer (if new), creates auth session, and sets HttpOnly cookie
   */
  verifyOtp = asyncHandler(async (req, res) => {
    const { email, otp, fullName } = req.body;
    const userAgent = req.headers['user-agent'] || 'Unknown';

    const { customer, token, maxAgeMs } = await authService.verifyOtpAndAuthenticate({
      email,
      otp,
      fullName,
      userAgent,
    });

    // Store JWT in HttpOnly cookie
    setAuthCookie(res, token, maxAgeMs);

    // Issue CSRF cookie for client JavaScript to read and mirror in x-csrf-token
    const csrfToken = setCsrfCookie(res);

    return sendSuccess(res, {
      statusCode: 200,
      message: 'Authentication successful.',
      data: {
        customer,
        csrfToken,
      },
    });
  });

  /**
   * GET /api/auth/me
   * Returns currently authenticated customer profile
   */
  me = asyncHandler(async (req, res) => {
    return sendSuccess(res, {
      statusCode: 200,
      data: {
        customer: req.customer,
      },
    });
  });

  /**
   * POST /api/auth/logout
   * Revokes authentication session and clears HttpOnly cookie
   */
  logout = asyncHandler(async (req, res) => {
    // Read session ID from authenticated context or inspect cookie directly if unauthenticated
    let sessionId = req.sessionId;

    if (!sessionId) {
      const token = req.cookies ? req.cookies[env.cookies.authCookieName] : null;
      if (token) {
        const decoded = verifyCustomerToken(token);
        if (decoded.valid && decoded.payload) {
          sessionId = decoded.payload.jti;
        }
      }
    }

    await authService.logout(sessionId);

    // Clear authentication cookie with matching security attributes
    clearAuthCookie(res);

    return sendSuccess(res, {
      statusCode: 200,
      message: 'Logged out successfully.',
    });
  });
}

export const authController = new AuthController();
export default authController;
