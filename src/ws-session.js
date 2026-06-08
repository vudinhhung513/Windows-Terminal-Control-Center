// file: src/ws-session.js
// Chuc nang: Fastify WebSocket plugin cho phep client ket noi vao phien terminal
// qua route GET /ws/session/:name. Ho tro multi-device (takeover/lock),
// relay du lieu tu ConPTY (session-manager) toi browser va nguoc lai.

import * as sm from './session-manager.js';
import { isAuthed } from './auth.js';
import { ensureLogging } from './session-logger.js';

// === Registry multi-device: map sessionName -> socket dang giu ===
const activeClients = new Map();

// Ma dong WebSocket tuy chinh
const CLOSE_TAKEN_OVER = 4001;
const CLOSE_LOCKED = 4002;

/**
 * Plugin Fastify dang ky route WebSocket /ws/session/:name.
 * @param {import('fastify').FastifyInstance} fastify
 * @param {object} opts - opts.config la config object
 */
async function wsSessionPlugin(fastify, opts) {
  const config = opts.config;

  fastify.get('/ws/session/:name', { websocket: true }, async (socket, req) => {
    const { name } = req.params;

    // Kiem tra xac thuc
    if (config.authEnabled && !isAuthed(req, config)) {
      socket.close(1008, 'unauthorized');
      return;
    }

    // Validate ten session
    if (!sm.validateName(name)) {
      socket.close(1008, 'invalid session name');
      return;
    }

    // Kiem tra session ton tai
    const exists = await sm.hasSession(name);
    if (!exists) {
      socket.close(1011, 'session not found');
      return;
    }

    // Xu ly multi-device: takeover hoac lock
    const mode = config.multiDeviceMode || 'takeover';
    const prev = activeClients.get(name);
    if (prev && prev.readyState === 1) {
      if (mode === 'lock') {
        socket.close(CLOSE_LOCKED, 'locked');
        return;
      }
      // Takeover — dong client cu
      try { prev.close(CLOSE_TAKEN_OVER, 'taken over'); } catch { /* bo qua */ }
    }

    // Dang ky client moi vao registry
    activeClients.set(name, socket);

    // Dam bao logging dang chay cho session nay
    ensureLogging(name).catch(() => {});

    // Attach vao session de nhan output tu ConPTY
    const sub = sm.attach(name, (data) => {
      if (socket.readyState === 1) socket.send(data);
    });
    if (sub === null) {
      socket.close(1011, 'attach failed');
      return;
    }

    // Gui scrollback hien tai cho client moi ket noi
    if (sub.scrollback && socket.readyState === 1) {
      socket.send(sub.scrollback);
    }

    // Lang nghe pty exit de dong socket
    sm.setOnExit(name, () => {
      if (socket.readyState === 1) socket.close(1000, 'pty exited');
    });

    // Xu ly message tu client (input, resize)
    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'input' && typeof msg.data === 'string') {
          sm.write(name, msg.data);
        } else if (msg.type === 'resize' && msg.cols && msg.rows) {
          sm.resize(name, Number(msg.cols), Number(msg.rows));
        }
      } catch { /* JSON khong hop le — bo qua */ }
    });

    // Khi socket dong: detach subscriber, xoa khoi registry
    socket.on('close', () => {
      sub.detach();
      if (activeClients.get(name) === socket) {
        activeClients.delete(name);
      }
    });
  });
}

export default wsSessionPlugin;
