// file: src/server.js
// Chuc nang: Khoi dong Fastify server cho WTCC.
//            Load config, chuan bi TLS, listen va log thong tin.

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { loadConfig, saveConfig } from './config.js';
import { buildApp } from './app.js';
import { ensureCert } from './tls.js';
import { startLoggerLoop } from './session-logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// Doc version tu package.json
let APP_VERSION = '0.0.0';
try {
  APP_VERSION = JSON.parse(
    readFileSync(resolve(PROJECT_ROOT, 'package.json'), 'utf-8')
  ).version;
} catch { /* giu mac dinh neu khong doc duoc */ }

// Load cau hinh
const config = loadConfig();

// Khoi tao fastify options
const fastifyOptions = { logger: true };
let isHttps = false;

// Chuan bi TLS neu enabled
if (config.tls.enabled) {
  try {
    const { keyPath, certPath, generated, san } = ensureCert(config.tls, PROJECT_ROOT);

    // Neu vua tu sinh cert moi thi log va luu lai path
    if (generated) {
      console.log(`Da tu sinh cert HTTPS self-signed: ${certPath}`);
      console.log(`SAN: ${san}`);
      saveConfig({ tls: { ...config.tls, keyPath, certPath } });
    }

    // Gan cert/key cho fastify https
    fastifyOptions.https = {
      key: readFileSync(keyPath),
      cert: readFileSync(certPath)
    };
    isHttps = true;
  } catch (err) {
    console.error(`Loi chuan bi cert/key TLS: ${err.message}`);
    console.error('Kiem tra quyen ghi thu muc data/tls/.');
    process.exit(1);
  }
}

// Build va khoi dong app
const app = await buildApp(config, { version: APP_VERSION, fastifyOptions });

try {
  await app.listen({ host: config.host, port: config.port });

  const addr = `${isHttps ? 'https' : 'http'}://${config.host}:${config.port}`;
  app.log.info(`Windows Terminal Control Center dang chay tai ${addr}`);

  // Bat dau vong lap ghi log session
  startLoggerLoop();

  // Canh bao bao mat
  if (!config.authEnabled) {
    app.log.warn('Auth DISABLED - ai truy cap duoc IP/port deu dung duoc');
  }
  if (config.host === '0.0.0.0') {
    app.log.warn('Server expose ra LAN (host=0.0.0.0). Dam bao mang an toan.');
  }
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
