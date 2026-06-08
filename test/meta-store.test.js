// file: test/meta-store.test.js
// Chuc nang: Test cac ham CRUD cua meta-store.js.
// Dung WTCC_DATA_DIR tro sang thu muc tam de khong dong vao data/ that.

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Tao thu muc tam TRUOC khi import module (de module doc env luc init)
const tmp = mkdtempSync(join(tmpdir(), 'wtcc-meta-'));
process.env.WTCC_DATA_DIR = tmp;

const meta = await import('../src/meta-store.js');

// Don dep thu muc tam sau khi tat ca test chay xong
after(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe('meta-store', () => {
  it('getMeta tao record mac dinh (note rong, order so, lastAccess 0)', () => {
    const rec = meta.getMeta('session1');
    assert.equal(rec.note, '');
    assert.equal(typeof rec.order, 'number');
    assert.equal(rec.lastAccess, 0);
  });

  it('setNote luu note', () => {
    meta.setNote('session1', 'ghi chu test');
    const rec = meta.getMeta('session1');
    assert.equal(rec.note, 'ghi chu test');
  });

  it('touch cap nhat lastAccess > 0', () => {
    meta.touch('session1');
    const rec = meta.getMeta('session1');
    assert.ok(rec.lastAccess > 0);
  });

  it('setOrder gan order theo index', () => {
    meta.setOrder(['session2', 'session1', 'session3']);
    assert.equal(meta.getMeta('session2').order, 0);
    assert.equal(meta.getMeta('session1').order, 1);
    assert.equal(meta.getMeta('session3').order, 2);
  });

  it('rename di chuyen record', () => {
    meta.setNote('oldname', 'will move');
    meta.rename('oldname', 'newname');
    const rec = meta.getMeta('newname');
    assert.equal(rec.note, 'will move');
    // oldname khong con ton tai voi note cu
    const old = meta.getMeta('oldname');
    assert.equal(old.note, ''); // record moi mac dinh
  });

  it('remove xoa record', () => {
    meta.setNote('todelete', 'bye');
    meta.remove('todelete');
    // getMeta se tao record moi mac dinh
    const rec = meta.getMeta('todelete');
    assert.equal(rec.note, '');
    assert.equal(rec.lastAccess, 0);
  });
});
