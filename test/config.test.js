// file: test/config.test.js
// Chuc nang: Test gia tri mac dinh (DEFAULTS) cua module config.js.
// Khong ghi file config — chi kiem tra DEFAULTS object.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULTS } from '../src/config.js';

describe('config DEFAULTS', () => {
  it('shells la mang khong rong', () => {
    assert.ok(Array.isArray(DEFAULTS.shells));
    assert.ok(DEFAULTS.shells.length > 0);
  });

  it('shell la string thuoc shells', () => {
    assert.equal(typeof DEFAULTS.shell, 'string');
    assert.ok(DEFAULTS.shells.includes(DEFAULTS.shell));
  });

  it('shell mac dinh la PowerShell', () => {
    assert.equal(DEFAULTS.shell, 'PowerShell');
  });

  it('theme mac dinh la dark', () => {
    assert.equal(DEFAULTS.theme, 'dark');
  });

  it('language mac dinh la en', () => {
    assert.equal(DEFAULTS.language, 'en');
  });

  it('defaultPath mac dinh la chuoi rong', () => {
    assert.equal(DEFAULTS.defaultPath, '');
  });

  it('sessionPrefix mac dinh la wtcc', () => {
    assert.equal(DEFAULTS.sessionPrefix, 'wtcc');
  });

  it('serverScrollbackBytes la so nguyen >= 65536', () => {
    assert.ok(Number.isInteger(DEFAULTS.serverScrollbackBytes));
    assert.ok(DEFAULTS.serverScrollbackBytes >= 65536);
  });

  it('termFontSizeMobile trong 8..40 (la 12)', () => {
    assert.equal(DEFAULTS.termFontSizeMobile, 12);
    assert.ok(DEFAULTS.termFontSizeMobile >= 8);
    assert.ok(DEFAULTS.termFontSizeMobile <= 40);
  });

  it('multiDeviceMode mac dinh la takeover', () => {
    assert.equal(DEFAULTS.multiDeviceMode, 'takeover');
  });

  it('logging.mode mac dinh la off', () => {
    assert.equal(DEFAULTS.logging.mode, 'off');
  });

  it('logging.retentionDays la so nguyen >= 1', () => {
    assert.ok(Number.isInteger(DEFAULTS.logging.retentionDays));
    assert.ok(DEFAULTS.logging.retentionDays >= 1);
  });

  it('tls.enabled mac dinh la true', () => {
    assert.equal(DEFAULTS.tls.enabled, true);
  });

  it('tls.keyPath la string', () => {
    assert.equal(typeof DEFAULTS.tls.keyPath, 'string');
  });

  it('tls.certPath la string', () => {
    assert.equal(typeof DEFAULTS.tls.certPath, 'string');
  });
});
