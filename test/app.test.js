// file: test/app.test.js
// Chuc nang: Test tich hop REST API cua app.js qua Fastify inject.
// Dung WTCC_DATA_DIR tam de tranh ghi file vao data/ that.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Set WTCC_DATA_DIR truoc khi import app (phong truong hop route ghi file)
const tmp = mkdtempSync(join(tmpdir(), 'wtcc-app-'));
process.env.WTCC_DATA_DIR = tmp;

import { buildApp, computeWarnings } from '../src/app.js';

// Cau hinh co ban cho test (khong auth, khong TLS)
const BASE_CONFIG = {
  host: '127.0.0.1',
  port: 7171,
  authEnabled: false,
  password: '',
  sessionSecret: 'test-secret',
  shell: 'PowerShell',
  shells: ['cmd', 'PowerShell', 'pwsh'],
  theme: 'dark',
  sessionPrefix: 'wtcc',
  serverScrollbackBytes: 1048576,
  termFontFamily: 'monospace',
  termFontSize: 14,
  termFontSizeMobile: 12,
  termEncoding: 'utf-8',
  multiDeviceMode: 'takeover',
  defaultPath: '',
  language: 'en',
  logging: { mode: 'off', retentionDays: 7 },
  loginRateLimit: { enabled: true, maxAttempts: 5, windowMs: 60000 },
  tls: { enabled: false, keyPath: '', certPath: '' }
};

/**
 * Tao app Fastify voi config tuy chinh (merge voi BASE_CONFIG).
 */
async function makeApp(overrides = {}) {
  return buildApp(
    { ...BASE_CONFIG, ...overrides },
    { version: '9.9.9', fastifyOptions: { logger: false } }
  );
}

/**
 * Lay CSRF token va cookie string tu response set-cookie.
 */
async function getCsrf(app) {
  // Goi bat ky endpoint nao de nhan CSRF cookie
  const res = await app.inject({ method: 'GET', url: '/api/config' });
  const setCookies = res.headers['set-cookie'];
  // set-cookie co the la string hoac mang
  const cookies = Array.isArray(setCookies) ? setCookies : [setCookies || ''];
  let token = '';
  let cookieStr = '';
  for (const c of cookies) {
    const match = c.match(/tcc_csrf=([^;]+)/);
    if (match) {
      token = match[1];
      cookieStr = `tcc_csrf=${token}`;
      break;
    }
  }
  return { token, cookieStr };
}

// === Test GET /api/config ===
describe('GET /api/config', () => {
  it('tra ve 200 voi version, theme, shells, warnings', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/api/config' });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.version, '9.9.9');
    assert.equal(body.theme, 'dark');
    assert.ok(Array.isArray(body.shells));
    assert.ok(Array.isArray(body.warnings));
    await app.close();
  });

  it('warnings chua defaultSecret khi sessionSecret la gia tri mac dinh', async () => {
    const app = await makeApp({ sessionSecret: 'REPLACE_WITH_RANDOM_SECRET' });
    const res = await app.inject({ method: 'GET', url: '/api/config' });
    const body = JSON.parse(res.body);
    assert.ok(body.warnings.includes('defaultSecret'));
    await app.close();
  });

  it('warnings chua exposedNoAuth khi host 0.0.0.0 va auth false', async () => {
    const app = await makeApp({ host: '0.0.0.0', authEnabled: false });
    const res = await app.inject({ method: 'GET', url: '/api/config' });
    const body = JSON.parse(res.body);
    assert.ok(body.warnings.includes('exposedNoAuth'));
    await app.close();
  });

  it('loggingMode theo logging.mode', async () => {
    const app = await makeApp({ logging: { mode: 'full', retentionDays: 7 } });
    const res = await app.inject({ method: 'GET', url: '/api/config' });
    const body = JSON.parse(res.body);
    assert.equal(body.loggingMode, 'full');
    await app.close();
  });
});

// === Test computeWarnings ===
describe('computeWarnings', () => {
  it('tra ve mang rong khi config an toan', () => {
    const warnings = computeWarnings({
      host: '127.0.0.1',
      sessionSecret: 'x',
      authEnabled: false
    });
    assert.deepEqual(warnings, []);
  });
});

// === Test GET /api/logs ===
describe('GET /api/logs', () => {
  it('tra ve 200 voi logs la Array', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/api/logs' });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(Array.isArray(body.logs));
    await app.close();
  });

  it('tra ve 400 khi ten session co dau cach', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/api/logs/has%20space' });
    assert.equal(res.statusCode, 400);
    await app.close();
  });

  it('tra ve 404 khi log khong ton tai', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/api/logs/khongton' });
    assert.equal(res.statusCode, 404);
    await app.close();
  });
});

// === Test DELETE /api/logs/:name khong CSRF ===
describe('DELETE /api/logs/:name', () => {
  it('tra ve 403 khi khong co CSRF token', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'DELETE', url: '/api/logs/alpha' });
    assert.equal(res.statusCode, 403);
    await app.close();
  });
});

// === Test GET /api/settings ===
describe('GET /api/settings', () => {
  it('tra ve 200 voi theme, shells, sessionPrefix', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/api/settings' });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.theme, 'dark');
    assert.ok(Array.isArray(body.shells));
    assert.equal(body.sessionPrefix, 'wtcc');
    await app.close();
  });
});

// === Test PUT /api/settings ===
describe('PUT /api/settings', () => {
  it('tra ve 403 khi khong co CSRF token', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ theme: 'light' })
    });
    assert.equal(res.statusCode, 403);
    await app.close();
  });

  it('tra ve 400 khi theme khong hop le', async () => {
    const app = await makeApp();
    const { token, cookieStr } = await getCsrf(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': token,
        cookie: cookieStr
      },
      body: JSON.stringify({ theme: 'badvalue' })
    });
    assert.equal(res.statusCode, 400);
    await app.close();
  });

  it('tra ve 400 khi sessionMaxAgeHours khong hop le', async () => {
    const app = await makeApp();
    const { token, cookieStr } = await getCsrf(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': token,
        cookie: cookieStr
      },
      body: JSON.stringify({ sessionMaxAgeHours: -5 })
    });
    assert.equal(res.statusCode, 400);
    await app.close();
  });

  it('tra ve 400 khi termFontSize vuot gioi han', async () => {
    const app = await makeApp();
    const { token, cookieStr } = await getCsrf(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': token,
        cookie: cookieStr
      },
      body: JSON.stringify({ termFontSize: 999 })
    });
    assert.equal(res.statusCode, 400);
    await app.close();
  });

  it('tra ve 400 khi multiDeviceMode khong hop le', async () => {
    const app = await makeApp();
    const { token, cookieStr } = await getCsrf(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': token,
        cookie: cookieStr
      },
      body: JSON.stringify({ multiDeviceMode: 'badmode' })
    });
    assert.equal(res.statusCode, 400);
    await app.close();
  });

  it('tra ve 400 khi language khong hop le', async () => {
    const app = await makeApp();
    const { token, cookieStr } = await getCsrf(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': token,
        cookie: cookieStr
      },
      body: JSON.stringify({ language: 'xx' })
    });
    assert.equal(res.statusCode, 400);
    await app.close();
  });

  it('tra ve 400 khi defaultPath la relative', async () => {
    const app = await makeApp();
    const { token, cookieStr } = await getCsrf(app);
    const res = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': token,
        cookie: cookieStr
      },
      body: JSON.stringify({ defaultPath: 'relative/dir' })
    });
    assert.equal(res.statusCode, 400);
    await app.close();
  });
});

// === Test GET /api/sessions ===
describe('GET /api/sessions', () => {
  it('tra ve 200 voi sessions la Array (rong)', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/api/sessions' });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(Array.isArray(body.sessions));
    await app.close();
  });
});
