// file: src/auth.js
// Chuc nang: Xac thuc Fastify — login/logout (mat khau hash scrypt),
// chong brute-force (rate-limit cau hinh duoc), CSRF double-submit token,
// middleware requireAuth/requireCsrf va ham isAuthed.

import { randomBytes } from 'node:crypto';
import { verifyPassword } from './password.js';

const COOKIE_NAME = 'tcc_session';
// Gia tri co so cua cookie phien. Cookie moi nhung them moc het han dang
// 'authed:<expiresAtMs>'; gia tri tho 'authed' van duoc chap nhan (tuong thich
// nguoc voi cookie cu va che do session cookie khong han).
const COOKIE_VALUE = 'authed';
const CSRF_COOKIE = 'tcc_csrf';
const CSRF_HEADER = 'x-csrf-token';

/**
 * Dung gia tri + option cho cookie phien dang nhap theo config.
 * - sessionMaxAgeHours > 0: nhung moc het han vao gia tri (server tu enforce)
 *   va dat maxAge cho trinh duyet.
 * - sessionMaxAgeHours = 0 (hoac khong hop le): session cookie khong han.
 * @param {object} config
 * @returns {{ value: string, options: object }}
 */
function buildSessionCookie(config) {
  const options = { path: '/', signed: true, httpOnly: true, sameSite: 'strict' };
  const hours = Number(config.sessionMaxAgeHours);
  if (Number.isFinite(hours) && hours > 0) {
    const seconds = Math.round(hours * 3600);
    options.maxAge = seconds; // trinh duyet tu xoa khi het han
    const expiresAt = Date.now() + seconds * 1000;
    return { value: `${COOKIE_VALUE}:${expiresAt}`, options };
  }
  return { value: COOKIE_VALUE, options };
}

// === Rate-limit dang nhap (in-memory theo IP) ===
// Map<ip, { count: number, resetAt: number }>
const loginAttempts = new Map();

/**
 * Kiem tra + tang bo dem rate-limit cho mot IP.
 * @param {string} ip
 * @param {object} cfg - config.loginRateLimit
 * @returns {boolean} true neu cho phep, false neu vuot gioi han
 */
function checkRateLimit(ip, cfg) {
  if (!cfg || !cfg.enabled) return true;

  const now = Date.now();
  const entry = loginAttempts.get(ip);

  // Het cua so → reset
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + cfg.windowMs });
    return true;
  }

  if (entry.count >= cfg.maxAttempts) return false;

  entry.count += 1;
  return true;
}

/** Xoa bo dem rate-limit cho IP (goi sau khi dang nhap thanh cong). */
function resetRateLimit(ip) {
  loginAttempts.delete(ip);
}

/**
 * Kiem tra request co authed khong (cookie hop le).
 * @param {object} request - Fastify request
 * @param {object} config
 * @returns {boolean}
 */
export function isAuthed(request, config) {
  if (!config.authEnabled) return true;

  const cookieVal = request.cookies?.[COOKIE_NAME];
  if (!cookieVal) return false;

  const unsigned = request.unsignCookie(cookieVal);
  if (!unsigned.valid || typeof unsigned.value !== 'string') return false;

  // Gia tri tho 'authed' (session cookie khong han / tuong thich cookie cu)
  if (unsigned.value === COOKIE_VALUE) return true;

  // Gia tri co nhung moc het han: 'authed:<expiresAtMs>'
  const sep = unsigned.value.indexOf(':');
  if (sep === -1 || unsigned.value.slice(0, sep) !== COOKIE_VALUE) return false;
  const expiresAt = Number(unsigned.value.slice(sep + 1));
  if (!Number.isFinite(expiresAt)) return false;
  return Date.now() < expiresAt;
}

/**
 * Tra ve preHandler bao ve route theo auth.
 * @param {object} config
 * @returns {function} preHandler
 */
export function requireAuth(config) {
  return async function authPreHandler(request, reply) {
    if (!config.authEnabled) return;
    if (!isAuthed(request, config)) {
      reply.code(401).send({ error: 'unauthorized' });
    }
  };
}

/**
 * Tra ve preHandler kiem tra CSRF token (double-submit cookie).
 * So sanh header x-csrf-token voi cookie tcc_csrf.
 * @returns {function} preHandler
 */
export function requireCsrf() {
  return async function csrfPreHandler(request, reply) {
    const cookieToken = request.cookies?.[CSRF_COOKIE];
    const headerToken = request.headers[CSRF_HEADER];

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      reply.code(403).send({ error: 'invalid csrf token' });
    }
  };
}

/**
 * Dang ky hook gan CSRF token (cookie doc duoc boi JS) cho MOI request.
 * Phai goi o top-level app (sau khi dang ky @fastify/cookie) de cookie duoc
 * set ngay khi tai trang tinh, khong bi gioi han boi encapsulation cua plugin.
 * @param {object} app - Fastify instance top-level
 */
export function registerCsrfCookie(app) {
  app.addHook('onRequest', async (request, reply) => {
    if (!request.cookies?.[CSRF_COOKIE]) {
      const token = randomBytes(24).toString('hex');
      reply.setCookie(CSRF_COOKIE, token, {
        path: '/',
        httpOnly: false, // client JS phai doc duoc de gui lai qua header
        sameSite: 'strict'
      });
    }
  });
}

/**
 * Fastify plugin: dang ky route login/logout.
 * @param {object} fastify
 * @param {object} opts - phai co opts.config
 */
async function authPlugin(fastify, opts) {
  const config = opts.config;

  // POST /api/login
  fastify.post('/api/login', async (request, reply) => {
    if (!config.authEnabled) {
      return { ok: true };
    }

    // Chong brute-force theo IP
    const ip = request.ip;
    if (!checkRateLimit(ip, config.loginRateLimit)) {
      reply.code(429).send({ error: 'too many attempts, try again later' });
      return;
    }

    const { password } = request.body || {};

    if (!verifyPassword(password, config.password)) {
      reply.code(401).send({ error: 'invalid password' });
      return;
    }

    // Dang nhap thanh cong → reset rate-limit + set cookie phien (kem moc het han)
    resetRateLimit(ip);
    const { value, options } = buildSessionCookie(config);
    reply.setCookie(COOKIE_NAME, value, options);

    return { ok: true };
  });

  // POST /api/logout
  fastify.post('/api/logout', async (request, reply) => {
    reply.clearCookie(COOKIE_NAME, { path: '/' });
    return { ok: true };
  });
}

export default authPlugin;
