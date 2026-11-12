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

  it('14. should register new customer with password and allow password login', async () => {
    // Register with password
    const regResult = await authService.verifyOtpAndAuthenticate({
      email: 'pass.user@example.com',
      fullName: 'Pass User',
      password: 'StrongPassword123',
      otp: '123456',
    });
    assert.ok(regResult.customer);

    // Verify stored customer has a password_hash
    const stored = await authRepository.findCustomerByEmail('pass.user@example.com');
    assert.ok(stored.password_hash);
    assert.notEqual(stored.password_hash, 'StrongPassword123'); // Must be hashed

    // Login with password
    const loginResult = await authService.loginWithPassword({
      email: 'pass.user@example.com',
      password: 'StrongPassword123',
    });
    assert.ok(loginResult.token);
    assert.equal(loginResult.customer.email, 'pass.user@example.com');
  });

  it('15. should reject password login with incorrect password', async () => {
    await authService.verifyOtpAndAuthenticate({
      email: 'wrongpass.user@example.com',
      fullName: 'Wrong Pass User',
      password: 'StrongPassword123',
      otp: '123456',
    });

    await assert.rejects(
      async () => {
        await authService.loginWithPassword({
          email: 'wrongpass.user@example.com',
          password: 'IncorrectPassword999',
        });
      },
      (err) => {
        assert.equal(err.statusCode, 401);
        assert.equal(err.code, 'INVALID_CREDENTIALS');
        return true;
      }
    );
  });

  it('16. should reject password login for non-existent customer with 401', async () => {
    await assert.rejects(
      async () => {
        await authService.loginWithPassword({
          email: 'nonexistent@example.com',
          password: 'SomePassword123',
        });
      },
      (err) => {
        assert.equal(err.statusCode, 401);
        assert.equal(err.code, 'INVALID_CREDENTIALS');
        return true;
      }
    );
  });

  it('17. should reject password login for account with no password set', async () => {
    // Pure passwordless registration
    await authService.verifyOtpAndAuthenticate({
      email: 'nopass@example.com',
      fullName: 'No Pass User',
      otp: '123456',
    });

    await assert.rejects(
      async () => {
        await authService.loginWithPassword({
          email: 'nopass@example.com',
          password: 'AnyPassword123',
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'PASSWORD_NOT_SET');
        return true;
      }
    );
  });

  it('18. should handle forgot-password and reset-password with session invalidation', async () => {
    // 1. Create customer with initial password
    const reg = await authService.verifyOtpAndAuthenticate({
      email: 'reset.me@example.com',
      fullName: 'Reset Candidate',
      password: 'InitialPassword123',
      otp: '123456',
    });

    const oldSessionToken = reg.token;
    const oldSessionId = jwt.decode(oldSessionToken).jti;

    // Active session works initially
    const profileBefore = await authService.getCurrentCustomer(oldSessionId);
    assert.equal(profileBefore.email, 'reset.me@example.com');

    // 2. Request forgot password
    const forgotRes = await authService.forgotPassword({ email: 'reset.me@example.com' });
    assert.equal(forgotRes.success, true);
    assert.match(forgotRes.message, /password reset code has been dispatched/i);

    // 3. Reset password using valid OTP
    const resetRes = await authService.resetPassword({
      email: 'reset.me@example.com',
      otp: '123456',
      newPassword: 'BrandNewPassword999',
    });
    assert.equal(resetRes.success, true);
    assert.match(resetRes.message, /reset successfully/i);

    // 4. Old session must now be revoked
    await assert.rejects(
      async () => {
        await authService.getCurrentCustomer(oldSessionId);
      },
      (err) => {
        assert.equal(err.statusCode, 401);
        assert.match(err.message, /revoked/i);
        return true;
      }
    );

    // 5. Old password login must fail
    await assert.rejects(
      async () => {
        await authService.loginWithPassword({
          email: 'reset.me@example.com',
          password: 'InitialPassword123',
        });
      },
      (err) => {
        assert.equal(err.statusCode, 401);
        return true;
      }
    );

    // 6. New password login must succeed
    const newLogin = await authService.loginWithPassword({
      email: 'reset.me@example.com',
      password: 'BrandNewPassword999',
    });
    assert.ok(newLogin.token);
    assert.equal(newLogin.customer.email, 'reset.me@example.com');
  });

  it('19. should reject password reset with invalid OTP', async () => {
    await authRepository.createCustomer({
      email: 'badotp.reset@example.com',
      fullName: 'Bad OTP Reset',
    });

    await assert.rejects(
      async () => {
        await authService.resetPassword({
          email: 'badotp.reset@example.com',
          otp: '000000',
          newPassword: 'ValidPassword123',
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /invalid verification code/i);
        return true;
      }
    );
  });
});
