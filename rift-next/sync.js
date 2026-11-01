const API = 'https://rift-sync-api.grassyyew19.chatgpt.site';

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(`${API}${path}`, {
      ...options,
      signal: controller.signal,
      cache: 'no-store',
      headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || `HTTP ${response.status}`), { status: response.status, responseState: data.state });
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export function createCoreSession({ role, initialCode, onUpdate, onRestore }) {
  let code = /^[A-HJ-NP-Z2-9]{6}$/.test(initialCode || '') ? initialCode : '';
  let state = null;
  let pending = [];
  let sending = false;
  let polling = false;
  let online = false;
  let presence = { console: false, phone: false };
  let started = false;

  const notify = (error = '', errorStatus = 0) => onUpdate({ code, state, presence, online, error, errorStatus });
  const revision = (value) => Number.isSafeInteger(value?.revision) ? value.revision : -1;
  function acceptState(next, restore = false) {
    if (!next || revision(next) < revision(state)) return false;
    if (revision(next) === revision(state) && state) return false;
    state = next;
    if (restore && role === 'phone' && !pending.length && !sending) onRestore(state);
    return true;
  }

  async function flush() {
    if (!code || !pending.length || sending) return;
    sending = true;
    while (pending.length && code) {
      const next = pending[0];
      try {
        const result = await request(`/api/room/${code}/event`, {
          method: 'POST', body: JSON.stringify({ type: 'core/sync', ...next }),
        });
        acceptState(result.state);
        pending.shift();
        if (!pending.length && revision(state) > revision(result.state)) onRestore(state);
        online = true;
        notify();
      } catch (error) {
        if (error.status === 409 && error.responseState?.experience === 'core') {
          pending = [];
          acceptState(error.responseState);
          online = true;
          onRestore(state);
          notify('Starea a fost actualizată pe alt dispozitiv.');
          break;
        }
        online = false;
        notify(error.message, error.status);
        break;
      }
    }
    sending = false;
  }

  async function poll() {
    if (polling) return;
    polling = true;
    try {
      if (!code && role === 'console') {
        const room = await request('/api/room', { method: 'POST', body: JSON.stringify({ experience: 'core' }) });
        code = room.code;
        state = room.state;
        presence = room.presence;
      }
      if (!code) {
        notify('Deschide linkul primit de la laptop.');
        return;
      }
      const room = await request(`/api/room/${code}?role=${role}`);
      if (room.state?.experience !== 'core') throw new Error('Camera aparține altei experiențe RIFT.');
      acceptState(room.state, true);
      presence = room.presence;
      online = true;
      notify();
      if (pending.length) void flush();
    } catch (error) {
      online = false;
      if (role === 'console' && (error.status === 404 || error.status === 400)) {
        code = '';
        state = null;
        presence = { console: false, phone: false };
      }
      notify(error.message, error.status);
    } finally {
      polling = false;
    }
  }

  return {
    start() {
      if (started) return;
      started = true;
      notify();
      void poll();
      setInterval(() => { if (!document.hidden) void poll(); }, 1400);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) void poll(); });
    },
    publish(snapshot, action) {
      if (role !== 'phone' || !code) return;
      pending.push({ ...snapshot, action });
      void flush();
    },
    get code() { return code; },
    get state() { return state; },
  };
}
