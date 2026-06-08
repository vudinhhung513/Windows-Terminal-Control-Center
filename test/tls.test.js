// file: test/tls.test.js
// Chuc nang: Test cac ham tls.js (getLocalIPv4s, buildSanString, ensureCert).
// ensureCert sinh cert that (dung selfsigned, chay duoc tren Linux).

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { getLocalIPv4s, buildSanString, ensureCert } from '../src/tls.js';

describe('getLocalIPv4s', () => {
  it('tra ve mang', () => {
    const result = getLocalIPv4s();
    assert.ok(Array.isArray(result));
  });

  it('moi phan tu la string', () => {
    const result = getLocalIPv4s();
    for (const ip of result) {
      assert.equal(typeof ip, 'string');
    }
  });
});

describe('buildSanString', () => {
  it('luon chua DNS:localhost', () => {
    const san = buildSanString([]);
    assert.ok(san.includes('DNS:localhost'));
  });

  it('luon chua IP:127.0.0.1', () => {
    const san = buildSanString([]);
    assert.ok(san.includes('IP:127.0.0.1'));
  });

  it('them DNS cho domain name', () => {
    const san = buildSanString(['example.com', '10.0.0.5']);
    assert.ok(san.includes('DNS:example.com'));
  });

  it('them IP cho dia chi IP', () => {
    const san = buildSanString(['example.com', '10.0.0.5']);
    assert.ok(san.includes('IP:10.0.0.5'));
  });
});

describe('ensureCert', () => {
  let tmp;

  // Tao thu muc tam cho moi lan chay test group nay
  tmp = mkdtempSync(join(tmpdir(), 'wtcc-tls-'));

  after(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('sinh cert lan dau (generated === true)', () => {
    const result = ensureCert(
      { enabled: true, keyPath: join(tmp, 'key.pem'), certPath: join(tmp, 'cert.pem') },
      tmp
    );
    assert.equal(result.generated, true);
    assert.ok(existsSync(join(tmp, 'key.pem')));
    assert.ok(existsSync(join(tmp, 'cert.pem')));
  });

  it('khong sinh lai khi cert da ton tai (generated === false)', () => {
    const result = ensureCert(
      { enabled: true, keyPath: join(tmp, 'key.pem'), certPath: join(tmp, 'cert.pem') },
      tmp
    );
    assert.equal(result.generated, false);
  });
});
