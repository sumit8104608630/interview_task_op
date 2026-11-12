import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { app } from '../../src/app.js';

describe('Health Check API Integration Test', () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      // Listen on port 0 to bind to an available ephemeral OS port
      server = http.createServer(app).listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  });

  it('GET /api/health returns 200 and healthy status payload', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.status, 'healthy');
    assert.equal(json.service, 'hotel-booking-portal-api');
    assert.ok(json.timestamp);
    assert.ok(typeof json.uptimeSeconds === 'number');
    assert.ok(json.database);
  });

  it('GET /api/v1/hotels returns 200 and hotel list', async () => {
    const res = await fetch(`${baseUrl}/api/v1/hotels`);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.data.length >= 5);
  });

  it('GET /api/v1/unknown-endpoint returns 404 standardized error', async () => {
    const res = await fetch(`${baseUrl}/api/v1/unknown-endpoint`);
    assert.equal(res.status, 404);

    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error.code, 'NOT_FOUND');
  });
});
