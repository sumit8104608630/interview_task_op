import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { app } from '../../src/app.js';
import { authRepository } from '../../src/modules/auth/auth.repository.js';
import { otpClient } from '../../src/integrations/otp/otpClient.js';
import { otpSendRateLimiter, otpVerifyRateLimiter } from '../../src/middleware/rateLimiter.middleware.js';
import { env } from '../../src/config/env.js';

describe('Customer Authentication API End-to-End Integration Tests', () => {
  let server;
  let baseUrl;

  before(async () => {
    // Isolate database calls using repository in-memory test store
    authRepository.setForceInMemory(true);

    // Mock OTP client
    otpClient.setMockHandler({
      sendOtp: async () => ({ success: true, message: 'OTP dispatched.' }),
      verifyOtp: async ({ otp }) => {
        if (otp === '123456') return { valid: true };
        return { valid: false, error: 'Invalid verification code.' };
      },
    });

    // Start HTTP server on ephemeral OS port
    await new Promise((resolve) => {
      server = http.createServer(app).listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    authRepository.setForceInMemory(false);
    otpClient.clearMockHandler();
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    otpSendRateLimiter.reset();
    otpVerifyRateLimiter.reset();
  });

  it('1. POST /api/auth/send-otp succeeds with generic message', async () => {
    const res = await fetch(`${baseUrl}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'guest.one@example.com',
        fullName: 'First Guest',
      }),
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.flow, 'REGISTRATION');
    assert.match(json.message, /one-time verification code/i);

    // Verify CSRF cookie is attached
    const setCookieHeader = res.headers.get('set-cookie');
    assert.ok(setCookieHeader);
    assert.match(setCookieHeader, /csrf_token=/);
  });

  it('2. POST /api/auth/send-otp rejects invalid email format', async () => {
    const res = await fetch(`${baseUrl}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bad-email' }),
    });

    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'VALIDATION_ERROR');
  });

  it('3. POST /api/auth/verify-otp creates customer and sets HttpOnly cookie', async () => {
    const res = await fetch(`${baseUrl}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'neha.kapoor@example.com',
        fullName: 'Neha Kapoor',
        otp: '123456',
      }),
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.customer.email, 'neha.kapoor@example.com');
    assert.equal(json.data.customer.fullName, 'Neha Kapoor');
    assert.ok(json.data.csrfToken);

    // Verify auth_token HttpOnly cookie is attached
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie);
    assert.match(setCookie, new RegExp(`${env.cookies.authCookieName}=`));
    assert.match(setCookie, /httponly/i);
  });

  it('4. GET /api/auth/me returns 401 when no cookie is provided', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`);
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'UNAUTHORIZED');
  });

  it('5. Full Authentication Flow: verify -> get /me -> logout -> get /me rejected', async () => {
    // A. Verify OTP
    const verifyRes = await fetch(`${baseUrl}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'flow.test@example.com',
        fullName: 'Flow Test',
        otp: '123456',
      }),
    });

    assert.equal(verifyRes.status, 200);
    const verifyJson = await verifyRes.json();
    const csrfToken = verifyJson.data.csrfToken;

    // Extract all cookies from response
    const rawCookies = verifyRes.headers.getSetCookie
      ? verifyRes.headers.getSetCookie()
      : [verifyRes.headers.get('set-cookie')];

    const cookieHeader = rawCookies.map((c) => c.split(';')[0]).join('; ');

    // B. Fetch /me using the authenticated cookie
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: cookieHeader },
    });

    assert.equal(meRes.status, 200);
    const meJson = await meRes.json();
    assert.equal(meJson.data.customer.email, 'flow.test@example.com');

    // C. Logout with CSRF token header
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: cookieHeader,
        'x-csrf-token': csrfToken,
      },
    });

    assert.equal(logoutRes.status, 200);
    const logoutJson = await logoutRes.json();
    assert.equal(logoutJson.success, true);

    // D. Subsequent /me request using the logged-out cookie must be rejected (401)
    const meAfterLogout = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: cookieHeader },
    });

    assert.equal(meAfterLogout.status, 401);
  });

  it('6. CSRF Protection: rejects state-changing cookie request when x-csrf-token header is missing', async () => {
    // Authenticate
    const verifyRes = await fetch(`${baseUrl}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'csrf.user@example.com',
        fullName: 'Csrf User',
        otp: '123456',
      }),
    });

    const rawCookies = verifyRes.headers.getSetCookie
      ? verifyRes.headers.getSetCookie()
      : [verifyRes.headers.get('set-cookie')];
    const cookieHeader = rawCookies.map((c) => c.split(';')[0]).join('; ');

    // Attempt logout with auth cookie BUT WITHOUT x-csrf-token header
    const rejectedLogout = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: cookieHeader,
        // x-csrf-token intentionally missing
      },
    });

    assert.equal(rejectedLogout.status, 403);
    const json = await rejectedLogout.json();
    assert.equal(json.error.code, 'CSRF_VALIDATION_FAILED');
  });

  it('7. OTP Rate Limiting: returns 429 after 5 requests within the window', async () => {
    const testEmail = 'rate.limit.victim@example.com';

    // 5 allowed requests
    for (let i = 0; i < 5; i += 1) {
      const res = await fetch(`${baseUrl}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, fullName: 'Rate User' }),
      });
      assert.equal(res.status, 200);
    }

    // 6th request must trigger 429 Rate Limit Exceeded
    const rateLimitedRes = await fetch(`${baseUrl}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, fullName: 'Rate User' }),
    });

    assert.equal(rateLimitedRes.status, 429);
    const json = await rateLimitedRes.json();
    assert.equal(json.error.code, 'RATE_LIMIT_EXCEEDED');
    assert.ok(rateLimitedRes.headers.get('retry-after'));
  });

  it('8. CORS: rejects unauthorized Origin header', async () => {
    const res = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'http://malicious-attacker-site.com' },
    });

    // Express CORS error handler responds with 500 / error message when origin callback returns error
    assert.ok(res.status >= 400);
  });
});
