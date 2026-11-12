import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { signCustomerToken, verifyCustomerToken } from '../../src/utils/jwt.js';
import { env } from '../../src/config/env.js';

describe('Customer JWT Security Unit Tests (jwt.js)', () => {
  const sampleCustomerId = '11111111-2222-3333-4444-555555555555';
  const sampleSessionId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  it('1. should generate a valid JWT with sub and jti claims', () => {
    const token = signCustomerToken({
      customerId: sampleCustomerId,
      sessionId: sampleSessionId,
    });

    assert.ok(token);
    assert.equal(typeof token, 'string');

    const result = verifyCustomerToken(token);
    assert.equal(result.valid, true);
    assert.equal(result.payload.sub, sampleCustomerId);
    assert.equal(result.payload.jti, sampleSessionId);
    assert.equal(result.payload.iss, env.jwt.issuer);
    assert.equal(result.payload.aud, env.jwt.audience);
  });

  it('2. should reject invalid JWT strings', () => {
    const result = verifyCustomerToken('invalid.token.string');
    assert.equal(result.valid, false);
    assert.match(result.error, /jwt|malformed|invalid/i);
  });

  it('3. should reject expired JWT tokens', () => {
    const expiredToken = signCustomerToken({
      customerId: sampleCustomerId,
      sessionId: sampleSessionId,
      expiresIn: '-1s', // Expired 1 second ago
    });

    const result = verifyCustomerToken(expiredToken);
    assert.equal(result.valid, false);
    assert.match(result.error, /expired/i);
  });

  it('4. should reject token with wrong issuer', () => {
    const wrongIssuerToken = jwt.sign(
      { sub: sampleCustomerId, jti: sampleSessionId },
      env.jwt.secret,
      {
        algorithm: 'HS256',
        issuer: 'malicious-or-unknown-issuer',
        audience: env.jwt.audience,
        expiresIn: '1h',
      }
    );

    const result = verifyCustomerToken(wrongIssuerToken);
    assert.equal(result.valid, false);
    assert.match(result.error, /jwt issuer invalid/i);
  });

  it('5. should reject token with wrong audience', () => {
    const wrongAudienceToken = jwt.sign(
      { sub: sampleCustomerId, jti: sampleSessionId },
      env.jwt.secret,
      {
        algorithm: 'HS256',
        issuer: env.jwt.issuer,
        audience: 'wrong-audience',
        expiresIn: '1h',
      }
    );

    const result = verifyCustomerToken(wrongAudienceToken);
    assert.equal(result.valid, false);
    assert.match(result.error, /jwt audience invalid/i);
  });

  it('6. should reject token with wrong signing secret', () => {
    const forgedToken = jwt.sign(
      { sub: sampleCustomerId, jti: sampleSessionId },
      'wrong-secret-key-12345678901234567890',
      {
        algorithm: 'HS256',
        issuer: env.jwt.issuer,
        audience: env.jwt.audience,
        expiresIn: '1h',
      }
    );

    const result = verifyCustomerToken(forgedToken);
    assert.equal(result.valid, false);
    assert.match(result.error, /invalid signature/i);
  });
});
