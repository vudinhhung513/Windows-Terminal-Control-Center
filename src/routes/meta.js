// file: src/routes/meta.js
// Chuc nang: REST API quan ly metadata phien (ghi chu, thu tu, lan truy cap cuoi)
// va doi ten phien. Routes: POST :name/touch, PUT :name/note, PUT :name/rename, PUT order.

import { renameSession, hasSession, validateName } from '../session-manager.js';
import * as meta from '../meta-store.js';
import { renameLog } from '../session-logger.js';
import { requireAuth, requireCsrf } from '../auth.js';

async function metaPlugin(fastify, opts) {
  const config = opts.config;
  const authHook = requireAuth(config);
  const csrfHook = requireCsrf();

  // POST /api/sessions/:name/touch - Cap nhat thoi gian truy cap cuoi
  fastify.post('/api/sessions/:name/touch', { preHandler: [authHook, csrfHook] }, async (request, reply) => {
    const { name } = request.params;
    if (!validateName(name)) { reply.code(400).send({ error: `Invalid session name: ${name}` }); return; }
    const rec = meta.touch(name);
    return { ok: true, lastAccess: rec.lastAccess };
  });

  // PUT /api/sessions/:name/note - Cap nhat ghi chu cho phien
  fastify.put('/api/sessions/:name/note', { preHandler: [authHook, csrfHook] }, async (request, reply) => {
    const { name } = request.params;
    if (!validateName(name)) { reply.code(400).send({ error: `Invalid session name: ${name}` }); return; }
    const note = String((request.body || {}).note || '');
    if (note.length > 500) { reply.code(400).send({ error: 'note too long (max 500)' }); return; }
    const rec = meta.setNote(name, note);
    return { ok: true, note: rec.note };
  });

  // PUT /api/sessions/:name/rename - Doi ten phien
  fastify.put('/api/sessions/:name/rename', { preHandler: [authHook, csrfHook] }, async (request, reply) => {
    const { name } = request.params;
    const newName = (request.body || {}).newName;
    // Kiem tra ten cu va ten moi hop le
    if (!validateName(name)) { reply.code(400).send({ error: `Invalid session name: ${name}` }); return; }
    if (!validateName(newName)) { reply.code(400).send({ error: `Invalid new name: ${newName}` }); return; }
    // Khong can doi ten neu trung
    if (name === newName) { return { ok: true, name }; }
    // Kiem tra ten moi da ton tai chua
    if (await hasSession(newName)) { reply.code(409).send({ error: `Session already exists: ${newName}` }); return; }
    // Kiem tra phien cu co ton tai khong
    if (!(await hasSession(name))) { reply.code(404).send({ error: `Session not found: ${name}` }); return; }
    try {
      await renameSession(name, newName);
      meta.rename(name, newName);
      try { await renameLog(name, newName); } catch { /* bo qua loi rename log */ }
      return { ok: true, name: newName };
    } catch (err) {
      reply.code(500).send({ error: err.message });
    }
  });

  // PUT /api/sessions/order - Cap nhat thu tu hien thi cac phien
  fastify.put('/api/sessions/order', { preHandler: [authHook, csrfHook] }, async (request, reply) => {
    const order = (request.body || {}).order;
    if (!Array.isArray(order) || !order.every((n) => validateName(n))) {
      reply.code(400).send({ error: 'order must be an array of valid names' }); return;
    }
    meta.setOrder(order);
    return { ok: true };
  });
}

export default metaPlugin;
