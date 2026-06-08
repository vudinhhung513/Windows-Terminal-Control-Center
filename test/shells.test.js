// file: test/shells.test.js
// Chuc nang: Test resolveShell va detectAvailableShells tu module shells.js.
// Khong spawn shell that, chi kiem tra gia tri tra ve.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resolveShell, detectAvailableShells } from '../src/shells.js';

// === Test resolveShell ===
describe('resolveShell', () => {
  it('cmd → file cmd.exe, args rong', () => {
    const result = resolveShell('cmd');
    assert.equal(result.file, 'cmd.exe');
    assert.deepEqual(result.args, []);
  });

  it('PowerShell → file powershell.exe, args chua -NoLogo', () => {
    const result = resolveShell('PowerShell');
    assert.equal(result.file, 'powershell.exe');
    assert.ok(result.args.includes('-NoLogo'));
  });

  it('pwsh → file pwsh.exe', () => {
    const result = resolveShell('pwsh');
    assert.equal(result.file, 'pwsh.exe');
  });

  it('wsl → file wsl.exe', () => {
    const result = resolveShell('wsl');
    assert.equal(result.file, 'wsl.exe');
  });

  it('gitbash → args deepEqual [--login, -i] va file ket thuc bash.exe', () => {
    const result = resolveShell('gitbash');
    assert.deepEqual(result.args, ['--login', '-i']);
    assert.ok(typeof result.file === 'string');
    assert.ok(result.file.endsWith('bash.exe'));
  });

  it('key la throw khi shell khong hop le', () => {
    assert.throws(
      () => resolveShell('rm'),
      /Shell not allowed/
    );
  });
});

// === Test detectAvailableShells ===
describe('detectAvailableShells', () => {
  it('tra ve mang', () => {
    const result = detectAvailableShells();
    assert.ok(Array.isArray(result));
  });

  it('luon chua cmd', () => {
    const result = detectAvailableShells();
    assert.ok(result.includes('cmd'));
  });

  it('luon chua PowerShell', () => {
    const result = detectAvailableShells();
    assert.ok(result.includes('PowerShell'));
  });
});
