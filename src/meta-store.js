// file: src/meta-store.js
// Chuc nang: Luu metadata cho tung phien tmux (ghi chu, thu tu sap xep, lan
// truy cap cuoi). Backend hien tai dung JSON file ghi atomic.
//
// Thiet ke: toan bo truy cap di qua interface ham duoi day. Neu sau nay can
// mo rong (SQLite, DB), chi thay phan doc/ghi ben trong ma khong doi API.
//
// Cau truc du lieu luu tren dia:
//   { "<sessionName>": { note: string, order: number, lastAccess: number } }

import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// Cache in-memory; dong bo voi file moi lan ghi.
let store = null;

/** Thu muc data (cho phep override qua env WTCC_DATA_DIR — huu ich cho test/deploy). */
function dataDir() {
  return process.env.WTCC_DATA_DIR
    ? resolve(process.env.WTCC_DATA_DIR)
    : resolve(PROJECT_ROOT, 'data');
}

/** Duong dan file metadata. */
function metaPath() {
  return resolve(dataDir(), 'sessions-meta.json');
}

/** Dam bao thu muc data/ ton tai. */
function ensureDir() {
  const dir = dataDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/** Doc file metadata tu dia (rong neu chua co/loi). */
function load() {
  if (store) return store;
  try {
    store = JSON.parse(readFileSync(metaPath(), 'utf-8'));
  } catch {
    store = {};
  }
  return store;
}

/** Ghi atomic store xuong dia (file tam + rename). */
function persist() {
  ensureDir();
  const tmpPath = `${metaPath()}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(store, null, 2) + '\n', 'utf-8');
  renameSync(tmpPath, metaPath());
}

/** Tao record mac dinh cho mot phien moi. */
function defaultRecord(orderHint) {
  return { note: '', order: orderHint, lastAccess: 0 };
}

/**
 * Lay metadata cua mot phien (tao record mac dinh neu chua co).
 * @param {string} name
 * @returns {{note:string, order:number, lastAccess:number}}
 */
export function getMeta(name) {
  const s = load();
  if (!s[name]) {
    // order mac dinh = so phien hien co (xep cuoi danh sach)
    s[name] = defaultRecord(Object.keys(s).length);
  }
  return s[name];
}

/**
 * Tra ve toan bo metadata (object keyed theo ten phien).
 * @returns {object}
 */
export function getAllMeta() {
  return load();
}

/**
 * Cap nhat ghi chu cho phien.
 * @param {string} name
 * @param {string} note
 */
export function setNote(name, note) {
  const rec = getMeta(name);
  rec.note = String(note || '');
  persist();
  return rec;
}

/**
 * Cap nhat thoi gian truy cap cuoi = now (ms epoch).
 * @param {string} name
 */
export function touch(name) {
  const rec = getMeta(name);
  rec.lastAccess = Date.now();
  persist();
  return rec;
}

/**
 * Ghi de thu tu sap xep theo mang ten phien (index = order).
 * Cac ten khong nam trong mang giu order cu.
 * @param {string[]} orderedNames
 */
export function setOrder(orderedNames) {
  const s = load();
  orderedNames.forEach((name, idx) => {
    if (!s[name]) s[name] = defaultRecord(idx);
    s[name].order = idx;
  });
  persist();
}

/**
 * Doi key metadata khi phien doi ten (giu nguyen note/order/lastAccess).
 * @param {string} oldName
 * @param {string} newName
 */
export function rename(oldName, newName) {
  const s = load();
  if (s[oldName]) {
    s[newName] = s[oldName];
    delete s[oldName];
    persist();
  }
}

/**
 * Xoa metadata cua phien (khi phien bi kill).
 * @param {string} name
 */
export function remove(name) {
  const s = load();
  if (s[name]) {
    delete s[name];
    persist();
  }
}
