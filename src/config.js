// file: src/config.js
// Chuc nang: Quan ly cau hinh ung dung WTCC (load/save/validate).
//            Doc tu config.json, validate & normalize, ghi atomic.

import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import iconv from 'iconv-lite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const CONFIG_PATH = resolve(PROJECT_ROOT, 'config.json');

// Gia tri mac dinh cho toan bo cau hinh
export const DEFAULTS = {
  host: '0.0.0.0',
  port: 7171,
  authEnabled: false,
  password: '',
  sessionSecret: 'REPLACE_WITH_RANDOM_SECRET',
  // Thoi gian song cua cookie phien dang nhap (gio). > 0 = cookie het han sau
  // so gio nay (server tu enforce + dat maxAge cho trinh duyet). 0 = session
  // cookie (mat khi dong trinh duyet). Toi da 8760 (1 nam).
  sessionMaxAgeHours: 720,
  shell: 'PowerShell',
  shells: ['cmd', 'PowerShell', 'pwsh', 'wsl', 'gitbash'],
  theme: 'dark',
  defaultPath: '',
  sessionPrefix: 'wtcc',
  serverScrollbackBytes: 1048576,
  termFontFamily: 'monospace',
  termFontSize: 14,
  termFontSizeMobile: 12,
  termEncoding: 'utf-8',
  multiDeviceMode: 'takeover',
  logging: {
    mode: 'off',
    retentionDays: 7
  },
  language: 'en',
  loginRateLimit: {
    enabled: true,
    maxAttempts: 5,
    windowMs: 60000
  },
  tls: {
    enabled: true,
    keyPath: 'data/tls/key.pem',
    certPath: 'data/tls/cert.pem'
  }
};

let current = null;

/**
 * Chuan hoa va validate cau hinh, dam bao moi field hop le.
 * Tra ve object config da normalize.
 */
function normalize(cfg) {
  const c = { ...DEFAULTS, ...cfg };

  // Validate port: phai la so nguyen trong khoang hop le
  if (!Number.isInteger(c.port) || c.port < 1 || c.port > 65535) {
    c.port = DEFAULTS.port;
  }

  // Validate termFontSize
  if (!Number.isInteger(c.termFontSize) || c.termFontSize < 6 || c.termFontSize > 72) {
    c.termFontSize = DEFAULTS.termFontSize;
  }

  // Validate sessionMaxAgeHours: so nguyen >= 0 (0 = session cookie), toi da 8760
  if (!Number.isInteger(c.sessionMaxAgeHours) || c.sessionMaxAgeHours < 0 || c.sessionMaxAgeHours > 8760) {
    c.sessionMaxAgeHours = DEFAULTS.sessionMaxAgeHours;
  }

  // Validate termFontSizeMobile
  if (!Number.isInteger(c.termFontSizeMobile) || c.termFontSizeMobile < 6 || c.termFontSizeMobile > 72) {
    c.termFontSizeMobile = DEFAULTS.termFontSizeMobile;
  }

  // Validate serverScrollbackBytes: phai la so nguyen >= 65536
  if (!Number.isInteger(c.serverScrollbackBytes) || c.serverScrollbackBytes < 65536) {
    c.serverScrollbackBytes = DEFAULTS.serverScrollbackBytes;
  }

  // Validate termEncoding: kiem tra iconv ho tro
  if (typeof c.termEncoding !== 'string' || !iconv.encodingExists(c.termEncoding)) {
    c.termEncoding = DEFAULTS.termEncoding;
  }

  // Validate multiDeviceMode: chi cho phep 'takeover' hoac 'lock'
  if (c.multiDeviceMode !== 'takeover' && c.multiDeviceMode !== 'lock') {
    c.multiDeviceMode = DEFAULTS.multiDeviceMode;
  }

  // Validate logging: merge voi defaults, kiem tra mode va retentionDays
  if (typeof c.logging !== 'object' || c.logging === null) {
    c.logging = { ...DEFAULTS.logging };
  } else {
    c.logging = { ...DEFAULTS.logging, ...c.logging };
  }
  if (!['off', 'input', 'full'].includes(c.logging.mode)) {
    c.logging.mode = DEFAULTS.logging.mode;
  }
  if (!Number.isInteger(c.logging.retentionDays) || c.logging.retentionDays < 1) {
    c.logging.retentionDays = DEFAULTS.logging.retentionDays;
  }

  // Validate language: chi cho phep 'en' hoac 'vi'
  if (c.language !== 'en' && c.language !== 'vi') {
    c.language = DEFAULTS.language;
  }

  // Validate theme: chi cho phep 'dark', 'light', 'auto'
  if (!['dark', 'light', 'auto'].includes(c.theme)) {
    c.theme = DEFAULTS.theme;
  }

  // Validate defaultPath: phai la chuoi
  if (typeof c.defaultPath !== 'string') {
    c.defaultPath = DEFAULTS.defaultPath;
  }

  // Validate shells: phai la mang chuoi khong rong
  if (!Array.isArray(c.shells)) {
    c.shells = [...DEFAULTS.shells];
  } else {
    // Loc bo cac phan tu rong va khong phai chuoi
    c.shells = c.shells.filter(s => typeof s === 'string' && s.length > 0);
    if (c.shells.length === 0) {
      c.shells = [...DEFAULTS.shells];
    }
  }

  // Validate shell: phai thuoc danh sach shells
  if (typeof c.shell !== 'string' || !c.shells.includes(c.shell)) {
    c.shell = c.shells[0];
  }

  // Validate sessionPrefix: phai la chuoi khong rong
  if (typeof c.sessionPrefix !== 'string' || c.sessionPrefix.length === 0) {
    c.sessionPrefix = DEFAULTS.sessionPrefix;
  }

  // Validate loginRateLimit: merge voi defaults, kiem tra cac gia tri
  if (typeof c.loginRateLimit !== 'object' || c.loginRateLimit === null) {
    c.loginRateLimit = { ...DEFAULTS.loginRateLimit };
  } else {
    c.loginRateLimit = { ...DEFAULTS.loginRateLimit, ...c.loginRateLimit };
  }
  if (typeof c.loginRateLimit.enabled !== 'boolean') {
    c.loginRateLimit.enabled = DEFAULTS.loginRateLimit.enabled;
  }
  if (!Number.isInteger(c.loginRateLimit.maxAttempts) || c.loginRateLimit.maxAttempts < 1) {
    c.loginRateLimit.maxAttempts = DEFAULTS.loginRateLimit.maxAttempts;
  }
  if (!Number.isInteger(c.loginRateLimit.windowMs) || c.loginRateLimit.windowMs < 1000) {
    c.loginRateLimit.windowMs = DEFAULTS.loginRateLimit.windowMs;
  }

  // Validate tls: merge voi defaults, kiem tra enabled/keyPath/certPath
  if (typeof c.tls !== 'object' || c.tls === null) {
    c.tls = { ...DEFAULTS.tls };
  } else {
    c.tls = { ...DEFAULTS.tls, ...c.tls };
  }
  if (typeof c.tls.enabled !== 'boolean') {
    c.tls.enabled = DEFAULTS.tls.enabled;
  }
  if (typeof c.tls.keyPath !== 'string' || c.tls.keyPath.length === 0) {
    c.tls.keyPath = DEFAULTS.tls.keyPath;
  }
  if (typeof c.tls.certPath !== 'string' || c.tls.certPath.length === 0) {
    c.tls.certPath = DEFAULTS.tls.certPath;
  }

  // Validate termFontFamily: phai la chuoi khong rong
  if (typeof c.termFontFamily !== 'string' || c.termFontFamily.length === 0) {
    c.termFontFamily = DEFAULTS.termFontFamily;
  }

  // Xoa tmuxPrefix neu ton tai tu config cu (khong dung tren Windows)
  delete c.tmuxPrefix;

  return c;
}

/**
 * Doc file config.json, tra ve object hoac {} neu loi.
 */
function readRaw() {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

/**
 * Load config lan dau, normalize va cache.
 * Lan goi tiep theo tra ve cache.
 */
export function loadConfig() {
  if (current) return current;
  current = normalize(readRaw());
  return current;
}

/**
 * Lay config hien tai (load neu chua co).
 */
export function getConfig() {
  return current || loadConfig();
}

/**
 * Ghi config xuong file theo cach atomic (write tmp -> rename).
 */
function writeConfigFile(cfg) {
  const tmp = `${CONFIG_PATH}.tmp`;
  writeFileSync(tmp, JSON.stringify(cfg, null, 2) + '\n', 'utf-8');
  renameSync(tmp, CONFIG_PATH);
}

/**
 * Merge patch vao config hien tai, normalize, ghi file va cap nhat cache.
 */
export function saveConfig(patch) {
  const merged = normalize({ ...getConfig(), ...patch });
  writeConfigFile(merged);
  // Cap nhat cache in-place
  Object.keys(merged).forEach(k => { current[k] = merged[k]; });
  return current;
}
