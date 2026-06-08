// file: src/routes/sessions.js
// Chuc nang: Plugin Fastify cung cap REST API quan ly phien.
// Routes: GET/POST /api/sessions, DELETE /api/sessions/:name

import { listSessions, createSession, killSession, hasSession, validateName } from '../session-manager.js';
import { requireAuth, requireCsrf } from '../auth.js';
import * as meta from '../meta-store.js';
import { ensureLogging, stopLogging } from '../session-logger.js';

async function sessionsPlugin(fastify, opts) {
  const config = opts.config;
  const authHook = requireAuth(config);
  const csrfHook = requireCsrf();

  // GET /api/sessions - Lay danh sach phien kem metadata
  fastify.get('/api/sessions', { preHandler: authHook }, async () => {
    const sessions = await listSessions();
    const enriched = sessions.map((s) => {
      const m = meta.getMeta(s.name);
      return { ...s, note: m.note, order: m.order, lastAccess: m.lastAccess };
    });
    enriched.sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name));
    return { sessions: enriched };
  });

  // POST /api/sessions - Tao phien moi
  fastify.post('/api/sessions', { preHandler: [authHook, csrfHook] }, async (request, reply) => {
    const { name, shell } = request.body || {};
    // Kiem tra ten phien hop le
    if (name !== undefined && name !== null && name !== '') {
      if (!validateName(name)) { reply.code(400).send({ error: `Invalid session name: ${name}` }); return; }
      const exists = await hasSession(name);
      if (exists) { reply.code(409).send({ error: `Session already exists: ${name}` }); return; }
    }
    // Kiem tra shell co trong danh sach cho phep
    if (shell !== undefined && shell !== null && shell !== '') {
      if (!config.shells.includes(shell)) { reply.code(400).send({ error: `Shell not allowed: ${shell}` }); return; }
    }
    try {
      const createdName = await createSession(name || undefined, config, shell || undefined);
      ensureLogging(createdName).catch(() => {});
      reply.code(201).send({ name: createdName });
    } catch (err) {
      if (err.message?.includes('duplicate session')) { reply.code(409).send({ error: err.message }); return; }
      reply.code(500).send({ error: err.message });
    }
  });

  // DELETE /api/sessions/:name - Xoa phien theo ten
  fastify.delete('/api/sessions/:name', { preHandler: [authHook, csrfHook] }, async (request, reply) => {
    const { name } = request.params;
    if (!validateName(name)) { reply.code(400).send({ error: `Invalid session name: ${name}` }); return; }
    const exists = await hasSession(name);
    if (!exists) { reply.code(404).send({ error: `Session not found: ${name}` }); return; }
    try {
      await killSession(name);
      meta.remove(name);
      stopLogging(name).catch(() => {});
      return { ok: true };
    } catch (err) {
      reply.code(500).send({ error: err.message });
    }
  });
}

export default sessionsPlugin;
