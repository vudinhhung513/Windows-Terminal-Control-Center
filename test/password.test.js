// file: test/password.test.js
// Chuc nang: Test hash, isHashed, verifyPassword tu module password.js.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { hashPassword, isHashed, verifyPassword } from '../src/password.js';

describe('hashPassword', () => {
  it('tra ve chuoi bat dau bang scrypt$', () => {
    const hashed = hashPassword('mypassword');
    assert.ok(hashed.startsWith('scrypt$'));
  });

  it('hash khac nhau moi lan goi (salt ngau nhien)', () => {
    const h1 = hashPassword('same');
    const h2 = hashPassword('same');
    assert.notEqual(h1, h2);
  });
});

describe('isHashed', () => {
  it('nhan dien chuoi da hash', () => {
    const hashed = hashPassword('test');
    assert.equal(isHashed(hashed), true);
  });

  it('tu choi plaintext thuong', () => {
    assert.equal(isHashed('plaintext'), false);
  });

  it('tu choi chuoi rong', () => {
    assert.equal(isHashed(''), false);
  });

  it('tu choi non-string', () => {
    assert.equal(isHashed(123), false);
    assert.equal(isHashed(null), false);
  });
});

describe('verifyPassword', () => {
  it('xac thuc dung voi hash', () => {
    const hashed = hashPassword('pw');
    assert.equal(verifyPassword('pw', hashed), true);
  });

  it('tu choi mat khau sai voi hash', () => {
    const hashed = hashPassword('correct');
    assert.equal(verifyPassword('wrong', hashed), false);
  });

  it('ho tro plaintext cu (chua migrate)', () => {
    assert.equal(verifyPassword('abc', 'abc'), true);
  });

  it('tu choi plaintext cu sai', () => {
    assert.equal(verifyPassword('abc', 'xyz'), false);
  });

  it('tra ve false khi plain khong phai string', () => {
    const hashed = hashPassword('test');
    assert.equal(verifyPassword(123, hashed), false);
    assert.equal(verifyPassword(null, hashed), false);
  });
});
