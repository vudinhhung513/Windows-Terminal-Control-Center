// file: src/app.js
// Chuc nang: Dung va cau hinh Fastify app (dang ky parser/cookie/CSRF/plugin/route)
// nhung KHONG goi listen. Tach rieng de test tich hop dung app.inject() (Fastify)
// ma khong can mo cong that. server.js import buildApp roi listen.

import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import fastifyCookie from '@fastify/cookie';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import authPlugin, { isAuthed, registerCsrfCookie } from './auth.js';
import sessionsPlugin from './routes/sessions.js';
import metaPlugin from './routes/meta.js';
import settingsPlugin from './routes/settings.js';
import logsPlugin from './routes/logs.js';
import wsSessionPlugin from './ws-session.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// Gia tri secret mac dinh (dung de canh bao cau hinh kem an toan)
const DEFAULT_SESSION_SECRET = 'REPLACE_WITH_RANDOM_SECRET';

/**
 * Tinh cac canh bao cau hinh kem an toan (tra ve mang ma canh bao).
 * Client se map ma sang text i18n.
 * @param {object} config
 * @returns {string[]}
 */
export function computeWarnings(config) {
  const warnings = [];
  // sessionSecret con la gia tri mac dinh → cookie phien de bi gia mao
  if (config.sessionSecret === DEFAULT_SESSION_SECRET) {
    warnings.push('defaultSecret');
  }
  // Expose ra ngoai localhost ma khong bat auth → ai cung dung duoc
  if (config.host !== '127.0.0.1' && config.host !== 'localhost' && !config.authEnabled) {
    warnings.push('exposedNoAuth');
  }
  return warnings;
}

/**
 * Dung Fastify app day du (chua listen).
 * @param {object} config - config object (tu loadConfig hoac inject khi test)
 * @param {object} [options]
 * @param {string} [options.version] - phien ban app (hien thi tren UI)
 * @param {object} [options.fastifyOptions] - tuy chon truyen cho Fastify()
 * @returns {Promise<import('fastify').FastifyInstance>}
 */
export async function buildApp(config, options = {}) {
  const version = options.version || '0.0.0';
  const app = Fastify(options.fastifyOptions || { logger: true });

  // Override parser JSON: coi body rong la {} thay vi tra loi 400
  // (cac request POST/PUT khong body nhu /touch, /logout van gui header JSON).
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    if (body === '' || body == null) {
      done(null, {});
      return;
    }
    try {
      done(null, JSON.parse(body));
    } catch (err) {
      err.statusCode = 400;
      done(err, undefined);
    }
  });

  // Dang ky WebSocket TRUOC route WS
  await app.register(fastifyWebsocket);

  // Dang ky cookie o top-level de moi plugin dung chung decorator
  await app.register(fastifyCookie, { secret: config.sessionSecret });

  // Gan CSRF token cho moi request (top-level de ap dung ca file tinh)
  registerCsrfCookie(app);

  // Dang ky auth plugin (login/logout, rate-limit)
  await app.register(authPlugin, { config });

  // Phuc vu file tinh (public/)
  await app.register(fastifyStatic, {
    root: resolve(PROJECT_ROOT, 'public'),
    prefix: '/'
  });

  // GET /api/config — tra thong tin auth + font + version + ngon ngu + theme
  // + danh sach shell + canh bao cau hinh cho client.
  app.get('/api/config', async (request) => {
    return {
      authEnabled: config.authEnabled,
      authed: isAuthed(request, config),
      version,
      termFontFamily: config.termFontFamily,
      termFontSize: config.termFontSize,
      termFontSizeMobile: config.termFontSizeMobile,
      multiDeviceMode: config.multiDeviceMode,
      language: config.language,
      theme: config.theme,
      shells: config.shells,
      // Che do log hien tai (client dung de an/hien nut Logs tren dashboard)
      loggingMode: config.logging?.mode || 'off',
      warnings: computeWarnings(config)
    };
  });

  // Dang ky cac route REST + WebSocket
  await app.register(sessionsPlugin, { config });
  await app.register(metaPlugin, { config });
  await app.register(settingsPlugin, { config });
  await app.register(logsPlugin, { config });
  await app.register(wsSessionPlugin, { config });

  return app;
}

export default buildApp;
