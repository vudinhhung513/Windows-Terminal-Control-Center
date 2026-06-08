// file: test/session-manager.test.js
// Chuc nang: Test cac ham pure cua session-manager (validateName, expandHome,
// listSessions, hasSession). Khong spawn shell that.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { homedir } from 'node:os';

import { validateName, expandHome, listSessions, hasSession } from '../src/session-manager.js';

// === Test validateName ===
describe('validateName', () => {
  // Truong hop hop le
  it('chap nhan ten chi chu thuong', () => {
    assert.equal(validateName('abc'), true);
  });

  it('chap nhan ten co underscore va dash', () => {
    assert.equal(validateName('a_b-1'), true);
  });

  it('chap nhan ten chi so', () => {
    assert.equal(validateName('123'), true);
  });

  it('chap nhan ten 1 ky tu', () => {
    assert.equal(validateName('x'), true);
  });

  it('chap nhan ten 64 ky tu (do dai toi da)', () => {
    assert.equal(validateName('a'.repeat(64)), true);
  });

  // Truong hop tu choi
  it('tu choi ten co dau cach', () => {
    assert.equal(validateName('a b'), false);
  });

  it('tu choi ten co dau cham', () => {
    assert.equal(validateName('a.b'), false);
  });

  it('tu choi chuoi rong', () => {
    assert.equal(validateName(''), false);
  });

  it('tu choi ten 65 ky tu (vuot do dai)', () => {
    assert.equal(validateName('a'.repeat(65)), false);
  });

  it('tu choi ten co dau cham phay', () => {
    assert.equal(validateName('a;b'), false);
  });

  it('tu choi null', () => {
    assert.equal(validateName(null), false);
  });

  it('tu choi undefined', () => {
    assert.equal(validateName(undefined), false);
  });

  it('tu choi so (khong phai string)', () => {
    assert.equal(validateName(123), false);
  });
});

// === Test expandHome ===
describe('expandHome', () => {
  const home = homedir();

  it('mo rong ~ thanh homedir', () => {
    assert.equal(expandHome('~'), home);
  });

  it('mo rong ~/projects thanh homedir + /projects', () => {
    assert.equal(expandHome('~/projects'), home + '/projects');
  });

  it('mo rong ~\\proj thanh homedir + \\proj', () => {
    assert.equal(expandHome('~\\proj'), home + '\\proj');
  });

  it('giu nguyen duong dan tuyet doi', () => {
    assert.equal(expandHome('/abs'), '/abs');
  });

  it('giu nguyen chuoi rong', () => {
    assert.equal(expandHome(''), '');
  });

  it('giu nguyen null', () => {
    assert.equal(expandHome(null), null);
  });
});

// === Test listSessions ===
describe('listSessions', () => {
  it('tra ve mang (rong ban dau)', async () => {
    const result = await listSessions();
    assert.ok(Array.isArray(result));
  });
});

// === Test hasSession ===
describe('hasSession', () => {
  it('tra ve false cho session khong ton tai', async () => {
    const result = await hasSession('valid');
    assert.equal(result, false);
  });

  it('throw khi ten session khong hop le', async () => {
    await assert.rejects(
      () => hasSession('bad name'),
      /Invalid session name/
    );
  });
});
