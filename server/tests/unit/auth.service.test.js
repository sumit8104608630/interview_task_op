import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { authService } from '../../src/modules/auth/auth.service.js';
import { authRepository } from '../../src/modules/auth/auth.repository.js';
import { otpClient } from '../../src/integrations/otp/otpClient.js';
import { sendOtpSchema, verifyOtpSchema } from '../../src/modules/auth/auth.validation.js';

describe('Customer Authentication Service & Domain Rules (auth.service.js)', () => {
  beforeEach(() => {
    // Isolate unit tests using repository in-memory store
    authRepository.setForceInMemory(true);

    // Mock OTP client for deterministic outcomes
    otpClient.setMockHandler({
      sendOtp: async ({ email, purpose, fullName }) => {
        return { success: true, message: `OTP sent to ${email} for ${purpose}` };
      },
      verifyOtp: async ({ email, otp, purpose }) => {
        if (otp === '654321') {
          return { valid: false, error: 'The verification code has expired.' };
        }
        if (otp === '123456') {
          return { valid: true };
        }
        return { valid: false, error: 'Invalid verification code.' };
      },
    });
  });

  afterEach(() => {
    authRepository.setForceInMemory(false);
    otpClient.clearMockHandler();
  });

  it('1. should validate correct email and fullName in sendOtpSchema', async () => {
    const valid = await sendOtpSchema.parseAsync({
      email: '  test.user@Example.Com  ',
      fullName: 'Rahul Sharma',
    });
    assert.equal(valid.email, 'test.user@example.com');
    assert.equal(valid.fullName, 'Rahul Sharma');
  });

  it('2. should reject invalid email format in sendOtpSchema', async () => {
    await assert.rejects(
      async () => {
        await sendOtpSchema.parseAsync({ email: 'not-an-email' });
      },
      (err) => {
        assert.match(err.message, /valid email/i);
        return true;
      }
    );
  });

  it('3. should reject fullName shorter than 2 characters in sendOtpSchema', async () => {
    await assert.rejects(
      async () => {
        await sendOtpSchema.parseAsync({
          email: 'valid@example.com',
          fullName: 'A',
        });
      },
      (err) => {
        assert.match(err.message, /at least 2 characters/i);
        return true;
      }
    );
  });

  it('4. should process valid registration OTP request and return generic message', async () => {
    const response = await authService.sendOtp({
      email: 'new.guest@example.com',
      fullName: 'Vikram Singh',
    });

    assert.equal(response.success, true);
    assert.equal(response.flow, 'REGISTRATION');
    assert.match(response.message, /one-time verification code/i);

    // Unverified customer account must NOT be created on mere OTP request
    const customer = await authRepository.findCustomerByEmail('new.guest@example.com');
    assert.equal(customer, null);
  });

  it('5. should identify existing customer and route to LOGIN flow on sendOtp', async () => {
    // Seed an existing customer
    await authRepository.createCustomer({
      email: 'existing.member@example.com',
      fullName: 'Priya Patel',
    });

    const response = await authService.sendOtp({
      email: 'existing.member@example.com',
    });

    assert.equal(response.success, true);
    assert.equal(response.flow, 'LOGIN');
  });

  it('6. should reject login and disallow OTP for disabled customers', async () => {
    const disabledUser = await authRepository.createCustomer({
      email: 'blocked@example.com',
      fullName: 'Blocked User',
    });
    // Set status to DISABLED in repository
    await authRepository.updateCustomerStatus(disabledUser.id, 'DISABLED');

    const sendRes = await authService.sendOtp({ email: 'blocked@example.com' });
    assert.equal(sendRes.success, true); // Generic message to prevent disclosure

    // Direct verification attempt must be rejected with 403
    await assert.rejects(
      async () => {
        await authService.verifyOtpAndAuthenticate({
          email: 'blocked@example.com',
          otp: '123456',
        });
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /disabled|suspended/i);
        return true;
      }
    );
  });

  it('7. should register new customer only after successful OTP verification', async () => {
    const authResult = await authService.verifyOtpAndAuthenticate({
      email: 'Aman.Verma@example.com',
      fullName: 'Aman Verma',
      otp: '123456',
      userAgent: 'Mozilla/5.0 Test Suite',
    });

    assert.ok(authResult.customer);
    assert.equal(authResult.customer.email, 'aman.verma@example.com');
    assert.equal(authResult.customer.fullName, 'Aman Verma');
    assert.equal(authResult.customer.status, 'ACTIVE');
    assert.ok(authResult.token);

    // Customer record must now exist in repository
    const stored = await authRepository.findCustomerByEmail('aman.verma@example.com');
    assert.ok(stored);
    assert.ok(stored.email_verified_at);
  });

  it('8. should reject invalid OTP with 400 status', async () => {
    await assert.rejects(
      async () => {
        await authService.verifyOtpAndAuthenticate({
          email: 'user@example.com',
          fullName: 'Test User',
          otp: '999999',
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /invalid verification code/i);
        return true;
      }
    );
  });

  it('9. should reject expired OTP with 400 status', async () => {
    await assert.rejects(
      async () => {
        await authService.verifyOtpAndAuthenticate({
          email: 'user@example.com',
          fullName: 'Test User',
          otp: '654321', // Configured as expired in mock
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /expired/i);
        return true;
      }
    );
  });

  it('10. should prevent duplicate customer creation during repeated registration', async () => {
    // First registration
    await authService.verifyOtpAndAuthenticate({
      email: 'duplicate.test@example.com',
      fullName: 'Initial Name',
      otp: '123456',
    });

    // Second registration attempt on same email
    const secondResult = await authService.verifyOtpAndAuthenticate({
      email: 'DUPLICATE.TEST@example.com',
      fullName: 'Attempted Different Name',
      otp: '123456',
    });

    assert.equal(secondResult.customer.email, 'duplicate.test@example.com');
    // Name should not be corrupted by subsequent login
    assert.equal(secondResult.customer.fullName, 'Initial Name');
  });

  it('11. should retrieve current authenticated customer from active session', async () => {
    const { customer, token } = await authService.verifyOtpAndAuthenticate({
      email: 'session.user@example.com',
      fullName: 'Session User',
      otp: '123456',
    });

    // Extract session ID from signed token
    const decoded = jwt.decode(token);
    assert.ok(decoded.jti);

    const profile = await authService.getCurrentCustomer(decoded.jti);
    assert.equal(profile.id, customer.id);
    assert.equal(profile.email, 'session.user@example.com');
  });

  it('12. should reject /me request when session is revoked (logout)', async () => {
    const { token } = await authService.verifyOtpAndAuthenticate({
      email: 'logout.user@example.com',
      fullName: 'Logout User',
      otp: '123456',
    });

    const decoded = jwt.decode(token);
    const sessionId = decoded.jti;

    // Logout / revoke session
    const logoutRes = await authService.logout(sessionId);
    assert.equal(logoutRes.success, true);

    // Reuse of logged-out session must be rejected
    await assert.rejects(
      async () => {
        await authService.getCurrentCustomer(sessionId);
      },
      (err) => {
        assert.equal(err.statusCode, 401);
        assert.match(err.message, /revoked/i);
        return true;
      }
    );
  });

  it('13. should reject /me request when session has expired', async () => {
    const { token } = await authService.verifyOtpAndAuthenticate({
      email: 'expired.session@example.com',
      fullName: 'Expired Session User',
      otp: '123456',
    });

    const decoded = jwt.decode(token);
    // Artificially expire the session in store
    await authRepository.expireSessionForTesting(decoded.jti);

    await assert.rejects(
      async () => {
        await authService.getCurrentCustomer(decoded.jti);
      },
      (err) => {
        assert.equal(err.statusCode, 401);
        assert.match(err.message, /expired/i);
        return true;
      }
    );
  });
});
