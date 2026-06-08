// file: src/routes/logs.js
// Chuc nang: REST API xem/quan ly log terminal da ghi ra file.
// Routes:
//   GET    /api/logs          -> liet ke cac file log (name, size, mtime)
//   GET    /api/logs/:name    -> doc noi dung log mot phien (read-only)
//   DELETE /api/logs/:name    -> xoa file log mot phien
//
// Khong co route sua log (chi cho phep xem/xoa). Moi route yeu cau auth;
// route doi trang thai (DELETE) them CSRF. Ten phien validate chong path
// traversal qua tien ich trong session-logger (dung validateName cua tmux).

import { listLogs, readLog, deleteLog } from '../session-logger.js';
import { validateName } from '../session-manager.js';
import { requireAuth, requireCsrf } from '../auth.js';

/**
 * Fastify plugin route quan ly log.
 * @param {object} fastify
 * @param {object} opts - opts.config
 */
async function logsPlugin(fastify, opts) {
  const config = opts.config;
  const authHook = requireAuth(config);
  const csrfHook = requireCsrf();

  // GET /api/logs — danh sach file log (da sap xep moi nhat truoc)
  fastify.get('/api/logs', { preHandler: authHook }, async () => {
    return { logs: listLogs() };
  });

  // GET /api/logs/:name — doc noi dung log mot phien (read-only)
  fastify.get('/api/logs/:name', { preHandler: authHook }, async (request, reply) => {
    const { name } = request.params;
    if (!validateName(name)) {
      reply.code(400).send({ error: `Invalid session name: ${name}` });
      return;
    }
    const content = readLog(name);
    if (content === null) {
      reply.code(404).send({ error: `Log not found: ${name}` });
      return;
    }
    return { name, content };
  });

  // DELETE /api/logs/:name — xoa file log mot phien
  fastify.delete('/api/logs/:name', { preHandler: [authHook, csrfHook] }, async (request, reply) => {
    const { name } = request.params;
    if (!validateName(name)) {
      reply.code(400).send({ error: `Invalid session name: ${name}` });
      return;
    }
    const ok = deleteLog(name);
    if (!ok) {
      reply.code(404).send({ error: `Log not found: ${name}` });
      return;
    }
    return { ok: true };
  });
}

export default logsPlugin;
