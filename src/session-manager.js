// file: src/session-manager.js
// Chuc nang: Quan ly phien ConPTY in-process (thay the tmux.js cua ban Linux).
// Moi phien giu ring-buffer scrollback trong RAM, nhieu WS client cung subscribe
// vao 1 phien dang song. Khi client attach, server replay scrollback.

import * as pty from 'node-pty';
import { statSync } from 'node:fs';
import { resolveShell, expandHome } from './shells.js';
import { loadConfig } from './config.js';

// ===== Registry: luu tru tat ca session dang song =====
const sessions = new Map();

// ===== Hang so: kich thuoc toi da ring buffer =====
function getMaxRingBytes() {
  try {
    const config = loadConfig();
    const val = config.serverScrollbackBytes;
    if (Number.isInteger(val) && val > 0) return val;
  } catch {
    // Config chua san sang — dung fallback
  }
  return 1048576; // 1 MiB mac dinh
}

// ===== Helper: day data vao ring buffer, giu kich thuoc trong gioi han =====
function pushToRing(session, data) {
  session.ring.push(data);
  session.ringBytes += Buffer.byteLength(data, 'utf8');

  // Cat bot tu dau neu vuot gioi han
  while (session.ringBytes > session.maxRingBytes && session.ring.length > 1) {
    const old = session.ring.shift();
    session.ringBytes -= Buffer.byteLength(old, 'utf8');
  }
}

// ===== Validate ten session =====
/**
 * Kiem tra ten session hop le: 1-64 ky tu, chi A-Z a-z 0-9 _ -
 * @param {string} name
 * @returns {boolean}
 */
export function validateName(name) {
  if (typeof name !== 'string') return false;
  if (name.length < 1 || name.length > 64) return false;
  return /^[A-Za-z0-9_-]+$/.test(name);
}

// Re-export expandHome tu shells.js
export { expandHome } from './shells.js';

// ===== Liet ke cac session hien co =====
/**
 * Tra ve mang thong tin session [{name, created, windows, attached}].
 * windows luon = 1 (khong co khai niem window nhu tmux).
 * @returns {Promise<Array>}
 */
export async function listSessions() {
  const result = [];
  for (const [name, session] of sessions) {
    result.push({
      name,
      created: session.created,
      windows: 1,
      attached: session.subscribers.size > 0,
    });
  }
  return result;
}

// ===== Tao session moi =====
/**
 * Tao phien ConPTY moi, luu vao registry.
 * @param {string|undefined} name - ten session (tu sinh neu rong)
 * @param {object|undefined} config - config object
 * @param {string|undefined} shell - key shell muon dung
 * @returns {Promise<string>} ten session da tao
 */
export async function createSession(name, config, shell) {
  // Load config neu khong truyen vao
  if (!config) config = loadConfig();

  // Tu sinh ten neu khong truyen
  if (!name) {
    const prefix = config.sessionPrefix || 'wtcc';
    name = `${prefix}-${Date.now().toString(36)}`;
  }

  // Validate ten
  if (!validateName(name)) {
    throw new Error(`Invalid session name: ${name}`);
  }

  // Xac dinh shell su dung
  let chosenShell;
  if (shell !== undefined && shell !== null && shell !== '') {
    // Kiem tra shell co trong danh sach cho phep (config.shells)
    const allowedShells = Array.isArray(config.shells) ? config.shells : [];
    if (!allowedShells.includes(shell)) {
      throw new Error(`Shell not allowed: ${shell}`);
    }
    chosenShell = shell;
  } else {
    chosenShell = config.shell;
  }

  // Kiem tra trung ten
  if (sessions.has(name)) {
    throw new Error('duplicate session');
  }

  // Resolve working directory
  let cwd;
  if (typeof config.defaultPath === 'string' && config.defaultPath.trim() !== '') {
    const dir = expandHome(config.defaultPath.trim());
    try {
      if (statSync(dir).isDirectory()) cwd = dir;
    } catch {
      // Path khong ton tai hoac khong truy cap duoc — bo qua, de cwd undefined
    }
  }

  // Resolve shell executable + args
  const { file, args } = resolveShell(chosenShell);

  // Xac dinh encoding (luu de tuong lai, ConPTY tra UTF-8 truc tiep)
  const encoding = config.termEncoding || 'utf-8';

  // Lay maxRingBytes
  const maxRingBytes = getMaxRingBytes();

  // Spawn pty process
  const term = pty.spawn(file, args, {
    name: 'xterm-color',
    cols: 80,
    rows: 24,
    cwd,
    env: process.env,
  });

  // Tao record session
  const session = {
    pty: term,
    ring: [],
    ringBytes: 0,
    maxRingBytes,
    subscribers: new Set(),
    encoding,
    created: Math.floor(Date.now() / 1000),
    shell: chosenShell,
    cols: 80,
    rows: 24,
    exited: false,
    onExitCb: null,
  };

  // Lang nghe du lieu tu pty -> day vao ring va phat cho subscribers
  term.onData((d) => {
    pushToRing(session, d);
    for (const cb of session.subscribers) {
      try { cb(d); } catch { /* subscriber loi — bo qua */ }
    }
  });

  // Lang nghe pty thoat
  term.onExit(() => {
    session.exited = true;
    if (session.onExitCb) {
      try { session.onExitCb(); } catch { /* bo qua */ }
    }
  });

  // Luu vao registry
  sessions.set(name, session);

  return name;
}

// ===== Xoa (kill) session =====
/**
 * Kill pty va xoa session khoi registry. Idempotent — khong throw neu khong ton tai.
 * @param {string} name
 */
export async function killSession(name) {
  if (!validateName(name)) {
    throw new Error(`Invalid session name: ${name}`);
  }

  const s = sessions.get(name);
  if (s) {
    try { s.pty.kill(); } catch { /* co the da exit */ }
    sessions.delete(name);
  }
}

// ===== Doi ten session =====
/**
 * Doi ten session trong registry.
 * @param {string} oldName
 * @param {string} newName
 */
export async function renameSession(oldName, newName) {
  if (!validateName(oldName)) {
    throw new Error(`Invalid session name: ${oldName}`);
  }
  if (!validateName(newName)) {
    throw new Error(`Invalid session name: ${newName}`);
  }

  const s = sessions.get(oldName);
  if (s) {
    sessions.set(newName, s);
    sessions.delete(oldName);
  }
}

// ===== Kiem tra session ton tai =====
/**
 * @param {string} name
 * @returns {Promise<boolean>}
 */
export async function hasSession(name) {
  if (!validateName(name)) {
    throw new Error(`Invalid session name: ${name}`);
  }
  return sessions.has(name);
}

// ===== Kiem tra co client nao dang attach =====
/**
 * @param {string} name
 * @returns {Promise<boolean>}
 */
export async function isAttached(name) {
  if (!validateName(name)) {
    throw new Error(`Invalid session name: ${name}`);
  }
  const s = sessions.get(name);
  return !!s && s.subscribers.size > 0;
}

// ===== Attach client vao session (KHONG async) =====
/**
 * Dang ky callback nhan du lieu tu session. Tra scrollback hien tai va ham detach.
 * @param {string} name
 * @param {function} onData - callback(data:string) khi co output moi
 * @returns {{scrollback: string, detach: function}|null} null neu session khong ton tai
 */
export function attach(name, onData) {
  const s = sessions.get(name);
  if (!s) return null;

  // Them subscriber
  s.subscribers.add(onData);

  return {
    scrollback: s.ring.join(''),
    detach() {
      s.subscribers.delete(onData);
    },
  };
}

// ===== Ghi du lieu vao pty (stdin) =====
/**
 * @param {string} name
 * @param {string} data
 */
export function write(name, data) {
  const s = sessions.get(name);
  if (s && !s.exited) {
    try { s.pty.write(data); } catch { /* pty da dong */ }
  }
}

// ===== Resize pty =====
/**
 * @param {string} name
 * @param {number} cols
 * @param {number} rows
 */
export function resize(name, cols, rows) {
  const s = sessions.get(name);
  if (s) {
    try { s.pty.resize(Number(cols), Number(rows)); } catch { /* bo qua */ }
    s.cols = Number(cols);
    s.rows = Number(rows);
  }
}

// ===== Lay toan bo scrollback =====
/**
 * @param {string} name
 * @returns {string}
 */
export function getScrollback(name) {
  const s = sessions.get(name);
  return s ? s.ring.join('') : '';
}

// ===== Dat callback khi session exit =====
/**
 * @param {string} name
 * @param {function} cb
 */
export function setOnExit(name, cb) {
  const s = sessions.get(name);
  if (s) s.onExitCb = cb;
}
