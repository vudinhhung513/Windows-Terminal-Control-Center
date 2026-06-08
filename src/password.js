// file: src/password.js
// Chuc nang: Bam (hash) va xac thuc mat khau bang scrypt cua node:crypto.
// Khong them dependency ngoai. Dinh dang luu: "scrypt$<saltHex>$<hashHex>".

import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

// Tien to nhan dien mat khau da hash (phan biet voi plaintext khi migrate)
const PREFIX = 'scrypt';
const KEYLEN = 64; // do dai hash (byte)

/**
 * Bam mat khau plaintext thanh chuoi luu tru.
 * @param {string} plain - mat khau goc
 * @returns {string} "scrypt$<saltHex>$<hashHex>"
 */
export function hashPassword(plain) {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, KEYLEN);
  return `${PREFIX}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

/**
 * Kiem tra mot chuoi co phai dang da hash hay khong.
 * @param {string} value
 * @returns {boolean}
 */
export function isHashed(value) {
  return typeof value === 'string' && value.startsWith(`${PREFIX}$`);
}

/**
 * Xac thuc mat khau nhap vao so voi gia tri da luu.
 * Ho tro ca gia tri da hash lan plaintext (de tuong thich config cu).
 * @param {string} plain - mat khau nguoi dung nhap
 * @param {string} stored - gia tri trong config (hash hoac plaintext)
 * @returns {boolean}
 */
export function verifyPassword(plain, stored) {
  if (typeof plain !== 'string' || typeof stored !== 'string') return false;

  // Truong hop plaintext cu (chua migrate) → so sanh truc tiep
  if (!isHashed(stored)) {
    return plain === stored;
  }

  // Dang da hash: tach salt + hash roi so sanh an toan theo thoi gian
  const parts = stored.split('$');
  if (parts.length !== 3) return false;

  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  const actual = scryptSync(plain, salt, expected.length);

  // timingSafeEqual yeu cau cung do dai
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
