// file: src/tls.js
// Chuc nang: Quan ly chung chi TLS tu ky (self-signed) cho HTTPS.
//            Dung package 'selfsigned' thay vi openssl CLI.

import { networkInterfaces } from 'node:os';
import { existsSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve, dirname, isAbsolute } from 'node:path';
import selfsigned from 'selfsigned';

/**
 * Lay danh sach IPv4 khong internal cua may.
 * Tra ve mang cac dia chi IP string.
 */
export function getLocalIPv4s() {
  const nets = networkInterfaces();
  const results = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Chi lay IPv4, bo localhost/internal
      if (net.family === 'IPv4' && !net.internal) {
        results.push(net.address);
      }
    }
  }
  return results;
}

/**
 * Tao chuoi SAN (Subject Alternative Name) tuong thich openssl.
 * Luon co localhost + 127.0.0.1, cong IPv4 may + extraNames.
 * Phan loai IP vs DNS dua tren regex.
 * Tra ve chuoi dang 'DNS:localhost,IP:127.0.0.1,IP:192.168.1.50,...'
 */
export function buildSanString(extraNames = []) {
  const ipRegex = /^\d+\.\d+\.\d+\.\d+$/;
  const entries = new Set();

  // Luon them localhost va 127.0.0.1
  entries.add('DNS:localhost');
  entries.add('IP:127.0.0.1');

  // Them cac IPv4 cua may
  for (const ip of getLocalIPv4s()) {
    entries.add(`IP:${ip}`);
  }

  // Them extraNames, phan loai IP hoac DNS
  for (const name of extraNames) {
    if (typeof name === 'string' && name.length > 0) {
      if (ipRegex.test(name)) {
        entries.add(`IP:${name}`);
      } else {
        entries.add(`DNS:${name}`);
      }
    }
  }

  return [...entries].join(',');
}

/**
 * Sinh cert tu ky bang selfsigned va ghi ra file.
 * Parse sanString thanh mang altNames cho selfsigned.
 * @param {string} keyPath - Duong dan file private key
 * @param {string} certPath - Duong dan file certificate
 * @param {string} sanString - Chuoi SAN dang 'DNS:x,IP:y,...'
 */
export function generateCert(keyPath, certPath, sanString) {
  // Tao thu muc cha neu chua ton tai
  mkdirSync(dirname(keyPath), { recursive: true });
  mkdirSync(dirname(certPath), { recursive: true });

  // Parse sanString thanh mang altNames cho selfsigned
  const altNames = sanString.split(',').map(entry => {
    const [type, value] = entry.split(':');
    if (type === 'IP') {
      return { type: 7, ip: value };
    }
    // DNS
    return { type: 2, value };
  });

  // Chon CN: host dau tien khac localhost, hoac 'localhost'
  let cn = 'localhost';
  for (const alt of altNames) {
    if (alt.type === 2 && alt.value !== 'localhost') {
      cn = alt.value;
      break;
    }
    if (alt.type === 7 && alt.ip !== '127.0.0.1') {
      cn = alt.ip;
      break;
    }
  }

  // Sinh cert voi selfsigned
  const pems = selfsigned.generate(
    [{ name: 'commonName', value: cn }],
    {
      days: 825,
      keySize: 2048,
      algorithm: 'sha256',
      extensions: [
        {
          name: 'subjectAltName',
          altNames
        }
      ]
    }
  );

  // Ghi file key va cert
  writeFileSync(keyPath, pems.private, 'utf-8');
  writeFileSync(certPath, pems.cert, 'utf-8');

  // Thu chmod 0o600 (Windows co the khong ho tro, nuot loi)
  try { chmodSync(keyPath, 0o600); } catch { /* bo qua tren Windows */ }
  try { chmodSync(certPath, 0o600); } catch { /* bo qua tren Windows */ }
}

/**
 * Dam bao cert/key ton tai. Neu chua co thi tu sinh.
 * @param {object} tls - Config tls {enabled, keyPath, certPath, extraNames}
 * @param {string} projectRoot - Duong dan goc du an
 * @returns {{keyPath, certPath, generated, san?}}
 */
export function ensureCert(tls, projectRoot) {
  // Resolve duong dan tuyet doi
  const keyPath = isAbsolute(tls.keyPath)
    ? tls.keyPath
    : resolve(projectRoot, tls.keyPath);
  const certPath = isAbsolute(tls.certPath)
    ? tls.certPath
    : resolve(projectRoot, tls.certPath);

  // Neu ca hai file da ton tai thi khong can sinh lai
  if (existsSync(keyPath) && existsSync(certPath)) {
    return { keyPath, certPath, generated: false };
  }

  // Sinh cert moi
  const san = buildSanString(tls.extraNames || []);
  generateCert(keyPath, certPath, san);

  return { keyPath, certPath, generated: true, san };
}
