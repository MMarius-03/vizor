import { createServer } from 'node:http';
import { randomInt } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { applyEvent, initialState } from './protocol.js';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.RIFT_PORT || 4174);
const rooms = new Map();
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/portal.js', ['portal.js', 'text/javascript; charset=utf-8']],
  ['/protocol.js', ['protocol.js', 'text/javascript; charset=utf-8']],
]);

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

function code() {
  let result;
  do {
    result = Array.from({ length: 5 }, () => alphabet[randomInt(alphabet.length)]).join('');
  } while (rooms.has(result));
  return result;
}

async function bodyOf(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 4096) throw new Error('Cerere prea mare.');
  }
  return JSON.parse(body || '{}');
}

function publish(room) {
  const message = `event: state\ndata: ${JSON.stringify(room.state)}\n\n`;
  for (const client of room.clients) client.write(message);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const path = url.pathname;

  if (path === '/api/health') return json(response, 200, { ok: true });

  if (path === '/api/room' && request.method === 'POST') {
    const id = code();
    const room = { state: initialState(), clients: new Set(), updated: Date.now() };
    rooms.set(id, room);
    return json(response, 201, { code: id, state: room.state });
  }

  const match = /^\/api\/room\/([A-Z2-9]{5})(?:\/(event|stream))?$/.exec(path);
  if (match) {
    const room = rooms.get(match[1]);
    if (!room) return json(response, 404, { error: 'Camera nu mai există. Creează una nouă pe laptop.' });
    room.updated = Date.now();
    if (!match[2] && request.method === 'GET') return json(response, 200, { code: match[1], state: room.state });
    if (match[2] === 'stream' && request.method === 'GET') {
      response.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      response.write(`event: state\ndata: ${JSON.stringify(room.state)}\n\n`);
      room.clients.add(response);
      const heartbeat = setInterval(() => response.write(': ping\n\n'), 20000);
      request.on('close', () => { clearInterval(heartbeat); room.clients.delete(response); });
      return;
    }
    if (match[2] === 'event' && request.method === 'POST') {
      try {
        const event = await bodyOf(request);
        const result = applyEvent(room.state, event);
        if (!result.accepted) return json(response, 409, { error: result.reason, state: room.state });
        room.state = result.state;
        publish(room);
        return json(response, 200, { state: room.state });
      } catch {
        return json(response, 400, { error: 'Cerere invalidă.' });
      }
    }
  }

  const file = files.get(path);
  if (request.method !== 'GET' || !file) return json(response, 404, { error: 'Not found' });
  try {
    const contents = await readFile(join(root, file[0]));
    response.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-cache' });
    response.end(contents);
  } catch {
    json(response, 500, { error: 'Fișier indisponibil.' });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`RIFT local: http://127.0.0.1:${port}/`);
});

setInterval(() => {
  const now = Date.now();
  for (const [id, room] of rooms) if (!room.clients.size && now - room.updated > 4 * 60 * 60 * 1000) rooms.delete(id);
}, 60 * 60 * 1000).unref();
