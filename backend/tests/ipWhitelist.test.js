/**
 * Unit tests for middleware/adminIpWhitelist.js
 *
 * Added by audit — this middleware guards every /api/admin and /api/admin-auth
 * route but had no direct coverage. Pure unit test: no DB / replset needed, so
 * it runs fast and in isolation (does NOT require ./setup).
 *
 * NOTE: production code is NOT modified. This file only adds coverage.
 */
process.env.NODE_ENV = 'test';

const adminIpWhitelist = require('../middleware/adminIpWhitelist');

// Minimal req/res/next mocks
function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}
function run(envVal, req) {
  const prev = process.env.ADMIN_ALLOWED_IPS;
  if (envVal === undefined) delete process.env.ADMIN_ALLOWED_IPS;
  else process.env.ADMIN_ALLOWED_IPS = envVal;

  const res = mockRes();
  let nextCalled = false;
  adminIpWhitelist(req, res, () => { nextCalled = true; });

  if (prev === undefined) delete process.env.ADMIN_ALLOWED_IPS;
  else process.env.ADMIN_ALLOWED_IPS = prev;
  return { res, nextCalled };
}

describe('adminIpWhitelist middleware', () => {
  it('allows all when ADMIN_ALLOWED_IPS is unset (dev mode)', () => {
    const { nextCalled, res } = run(undefined, { ip: '8.8.8.8' });
    expect(nextCalled).toBe(true);
    expect(res.statusCode).toBeNull();
  });

  it('allows all when ADMIN_ALLOWED_IPS is empty string', () => {
    const { nextCalled } = run('', { ip: '8.8.8.8' });
    expect(nextCalled).toBe(true);
  });

  it('allows all when 0.0.0.0/0 is present', () => {
    const { nextCalled } = run('0.0.0.0/0', { ip: '203.0.113.99' });
    expect(nextCalled).toBe(true);
  });

  it('allows a whitelisted IP', () => {
    const { nextCalled, res } = run('203.0.113.10,198.51.100.5', { ip: '203.0.113.10' });
    expect(nextCalled).toBe(true);
    expect(res.statusCode).toBeNull();
  });

  it('blocks a non-whitelisted IP with 403', () => {
    const { nextCalled, res } = run('203.0.113.10', { ip: '10.0.0.1' });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('strips IPv4-mapped IPv6 prefix before matching', () => {
    const { nextCalled } = run('127.0.0.1', { ip: '::ffff:127.0.0.1' });
    expect(nextCalled).toBe(true);
  });

  it('falls back to socket.remoteAddress when req.ip is absent', () => {
    const { nextCalled } = run('203.0.113.10', { socket: { remoteAddress: '203.0.113.10' } });
    expect(nextCalled).toBe(true);
  });

  it('tolerates whitespace in the env list', () => {
    const { nextCalled } = run(' 203.0.113.10 , 198.51.100.5 ', { ip: '198.51.100.5' });
    expect(nextCalled).toBe(true);
  });
});
