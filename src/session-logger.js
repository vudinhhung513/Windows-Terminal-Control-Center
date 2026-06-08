// file: src/session-logger.js
// Chuc nang: Ghi log noi dung terminal ra file theo phien. Subscribe vao
// session-manager de nhan output realtime, strip ANSI, dung dong (xu ly
// \r/backspace), ghi vao data/logs/<name>.log.

import {
  existsSync,
  mkdirSync,
  statSync,
  readdirSync,
  unlinkSync,
  renameSync,
  appendFileSync,
  readFileSync,
} from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfig } from './config.js';
import * as sm from './session-manager.js';
import { getAllMeta } from './meta-store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// === Regex strip ANSI escape sequences ===
const ANSI_RE = /[\u001B\u009B][[\]()#;?]*(?:(?:[a-zA-Z0-9;]*)?\u0007|(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-PR-TZcf-ntqry=><~])/g;

// === Regex phat hien prompt (best-effort, match ky tu cuoi prompt + noi dung) ===
const PROMPT_RE = /[$#%>]\s+(\S.*)$/;

// === Trang thai module ===
const watchers = new Map(); // map name -> { detach, lineBuf }
let cleanupTimer = null;
let started = false;

// === Duong dan ===

/** Thu muc data (override qua env WTCC_DATA_DIR). */
function dataDir() {
  return process.env.WTCC_DATA_DIR
    ? resolve(process.env.WTCC_DATA_DIR)
    : resolve(PROJECT_ROOT, 'data');
}

/** Thu muc chua log. */
function logsDir() {
  return resolve(dataDir(), 'logs');
}

/** Dam bao thu muc logs ton tai. */
function ensureLogsDir() {
  const dir = logsDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/** Duong dan file log cua 1 session. */
function logPath(name) {
  return resolve(logsDir(), `${name}.log`);
}

// === Utilities ===

/** Timestamp ISO cho moi dong log. */
function ts() {
  return new Date().toISOString();
}

/**
 * Dung dong tu chunk du lieu (xu ly \n, \r, backspace).
 * Thuat toan: duyet tung ky tu, xay dung dong hien tai nhu mang char + col pointer.
 * @param {string} prev - phan du cua chunk truoc (chua co \n ket thuc)
 * @param {string} chunk - du lieu moi nhan duoc
 * @returns {{lines: string[], rest: string}}
 */
function assembleLines(prev, chunk) {
  const lines = [];
  let buf = Array.from(prev);
  let col = buf.length;

  for (let i = 0; i < chunk.length; i++) {
    const ch = chunk[i];
    if (ch === '\n') {
      // Ket thuc dong — push va reset
      lines.push(buf.join(''));
      buf = [];
      col = 0;
    } else if (ch === '\r') {
      // Ve dau dong (khong xoa noi dung)
      col = 0;
    } else if (ch === '\b' || ch === '\u007f') {
      // Backspace/delete — xoa ky tu truoc con tro
      if (col > 0) {
        col--;
        buf.splice(col, 1);
      }
    } else {
      // Ghi de ky tu tai vi tri col
      if (col < buf.length) {
        buf[col] = ch;
      } else {
        buf.push(ch);
      }
      col++;
    }
  }

  return { lines, rest: buf.join('') };
}

/**
 * Ghi cac dong da xu ly ra file log.
 * @param {string} name - ten session
 * @param {string[]} lines - mang dong da assemble
 * @param {string} mode - 'full' hoac 'input'
 */
function writeLines(name, lines, mode) {
  if (lines.length === 0) return;

  const out = [];
  const timestamp = ts();

  for (const line of lines) {
    if (mode === 'input') {
      // Chi log dong match prompt (best-effort loc input)
      const m = PROMPT_RE.exec(line);
      if (m) {
        out.push(`[${timestamp}] ${m[1].trim()}`);
      }
    } else {
      // Mode 'full' — ghi tat ca
      out.push(`[${timestamp}] ${line}`);
    }
  }

  if (out.length > 0) {
    appendFileSync(logPath(name), out.join('\n') + '\n', 'utf-8');
  }
}

// === API chinh ===

/**
 * Bat dau ghi log cho 1 session (subscribe output tu session-manager).
 * Neu da dang watch hoac mode=off thi khong lam gi.
 * @param {string} name
 */
export async function ensureLogging(name) {
  const mode = getConfig().logging.mode;
  if (mode === 'off') return;

  ensureLogsDir();

  if (watchers.has(name)) return;

  // Tao state cho session nay
  const state = { detach: null, lineBuf: '' };

  // Subscribe vao session de nhan output
  const sub = sm.attach(name, (data) => {
    const cur = getConfig().logging.mode;
    if (cur === 'off') return;

    // Strip ANSI, assemble dong, ghi file
    const stripped = String(data).replace(ANSI_RE, '');
    const { lines, rest } = assembleLines(state.lineBuf, stripped);
    state.lineBuf = rest;
    writeLines(name, lines, cur);
  });

  if (!sub) return;

  state.detach = sub.detach;
  watchers.set(name, state);
}

/**
 * Dung ghi log cho 1 session.
 * @param {string} name
 */
export async function stopLogging(name) {
  const st = watchers.get(name);
  if (st) {
    try { if (st.detach) st.detach(); } catch { /* bo qua */ }
    watchers.delete(name);
  }
}

/**
 * Ap dung logging cho tat ca session dang chay theo config hien tai.
 * Neu mode=off thi dung tat ca watcher.
 */
export async function applyLoggingToAll() {
  const mode = getConfig().logging.mode;
  const all = await sm.listSessions();

  if (mode === 'off') {
    for (const s of all) await stopLogging(s.name);
    return;
  }

  for (const s of all) await ensureLogging(s.name);
}

/**
 * Don dep log cu vuot thoi gian luu tru (retentionDays).
 */
export function cleanupOldLogs() {
  const config = getConfig();
  const retentionDays = config.logging && config.logging.retentionDays;
  if (!retentionDays || retentionDays <= 0) return;

  const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
  const now = Date.now();

  ensureLogsDir();
  const dir = logsDir();
  const meta = getAllMeta();

  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const file of entries) {
    // Chi xu ly file .log
    if (!file.endsWith('.log')) continue;

    const name = file.slice(0, -4); // bo .log
    if (!sm.validateName(name)) continue;

    const filePath = resolve(dir, file);

    // Xac dinh thoi diem hoat dong cuoi
    let lastActive;
    if (meta[name] && meta[name].lastAccess) {
      lastActive = meta[name].lastAccess;
    } else {
      try {
        lastActive = statSync(filePath).mtimeMs;
      } catch {
        continue;
      }
    }

    // Xoa neu qua han
    if (now - lastActive > retentionMs) {
      try { unlinkSync(filePath); } catch { /* bo qua */ }
    }
  }
}

/**
 * Khoi dong vong lap logger: ap dung logging + don dep dinh ky.
 * Tra ham huy de dung timer.
 * @returns {function} ham cleanup
 */
export function startLoggerLoop() {
  if (started) return () => {};

  started = true;

  // Ap dung logging cho tat ca session hien co
  applyLoggingToAll().catch(() => {});

  // Don dep log cu ngay va dinh ky moi 6 gio
  cleanupOldLogs();
  cleanupTimer = setInterval(cleanupOldLogs, 6 * 60 * 60 * 1000);
  if (cleanupTimer.unref) cleanupTimer.unref();

  // Tra ham dung
  return () => {
    if (cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
    started = false;
  };
}

/**
 * Liet ke cac file log hien co.
 * @returns {{name: string, size: number, mtime: number}[]}
 */
export function listLogs() {
  ensureLogsDir();
  const dir = logsDir();

  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  const result = [];
  for (const file of entries) {
    if (!file.endsWith('.log')) continue;
    const name = file.slice(0, -4);
    if (!sm.validateName(name)) continue;

    try {
      const st = statSync(resolve(dir, file));
      result.push({ name, size: st.size, mtime: st.mtimeMs });
    } catch {
      // File bi xoa giua chung — bo qua
    }
  }

  // Sap xep theo mtime giam dan
  result.sort((a, b) => b.mtime - a.mtime);
  return result;
}

/**
 * Doc noi dung file log cua 1 session.
 * @param {string} name
 * @returns {string|null}
 */
export function readLog(name) {
  if (!sm.validateName(name)) return null;

  const p = logPath(name);
  if (!existsSync(p)) return null;

  try {
    return readFileSync(p, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Xoa file log cua 1 session.
 * @param {string} name
 * @returns {boolean}
 */
export function deleteLog(name) {
  if (!sm.validateName(name)) return false;

  const p = logPath(name);
  if (!existsSync(p)) return false;

  try {
    unlinkSync(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Doi ten file log khi session duoc rename.
 * @param {string} oldName
 * @param {string} newName
 */
export async function renameLog(oldName, newName) {
  if (!sm.validateName(oldName) || !sm.validateName(newName) || oldName === newName) return;

  // Dung watcher cu
  await stopLogging(oldName);

  // Rename file log tren disk
  try {
    const oldPath = logPath(oldName);
    if (existsSync(oldPath)) {
      renameSync(oldPath, logPath(newName));
    }
  } catch { /* bo qua loi rename */ }

  // Bat lai logging cho ten moi neu mode dang bat
  if (getConfig().logging.mode !== 'off') {
    await ensureLogging(newName);
  }
}

// === Export internal cho testing ===
export const _internal = { assembleLines, ANSI_RE, PROMPT_RE, logPath };
