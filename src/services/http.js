import axios from 'axios';

const TOKEN_KEY = 'workforce_auth_token';

// The entrance device is not a user account. After it enters the kiosk PIN the server
// hands it a signed device token (kept in localStorage so a reboot stays unlocked until
// it expires); it is sent as X-Kiosk-Token on every kiosk call except the two public ones.
export const KIOSK_TOKEN_KEY = 'kiosk_device_token';
export const KIOSK_LOCKED_EVENT = 'kiosk-device-locked';
export const SESSION_ENDED_EVENT = 'workforce:session-ended';
const KIOSK_OPEN_PATHS = ['/kiosk/config', '/kiosk/verify-pin'];

const store = () => {
  try { return window.sessionStorage; } catch { return null; }
};

const read = (key) => {
  try { return store()?.getItem(key) ?? null; } catch { return null; }
};

const write = (key, value) => {
  try { store()?.setItem(key, value); } catch { /* ignore */ }
};

const remove = (key) => {
  try { store()?.removeItem(key); } catch { /* ignore */ }
};

const WFM_API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1/wfm';
const AUTH_API = import.meta.env.VITE_AUTH_URL || 'http://localhost:4000/api/v1/auth';

const http = axios.create({
  baseURL: WFM_API,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  timeout: 45000,
});

const baseAdapter = axios.getAdapter(axios.defaults.adapter);

const COLD_START_BUDGET_MS = 20000;
const RETRY_DELAY_MS = 1500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const neverReachedServer = (error) => !error.response && !axios.isCancel(error);

const send = (config) => {
  const deadline = Date.now() + COLD_START_BUDGET_MS;
  const attempt = () =>
    baseAdapter(config).catch((error) => {
      if (config.signal || !neverReachedServer(error) || Date.now() + RETRY_DELAY_MS >= deadline) {
        return Promise.reject(error);
      }
      return sleep(RETRY_DELAY_MS).then(attempt);
    });
  return attempt();
};

const inFlightWrites = new Map();

http.defaults.adapter = (config) => {
  const method = String(config.method || 'get').toLowerCase();
  const hasOpaqueBody = config.data != null && typeof config.data !== 'string';
  if (method === 'get' || method === 'head' || config.signal || hasOpaqueBody) {
    return send(config);
  }

  const key = `${method} ${config.baseURL || ''}${config.url} ${config.data ?? ''}`;
  const pending = inFlightWrites.get(key);
  if (pending) return pending;

  const request = send(config).finally(() => inFlightWrites.delete(key));
  inFlightWrites.set(key, request);
  return request;
};

const readKioskToken = () => {
  try {
    const raw = window.localStorage.getItem(KIOSK_TOKEN_KEY);
    if (!raw) return null;
    const { token, expiresAt } = JSON.parse(raw);
    return token && Number(expiresAt) * 1000 > Date.now() ? token : null;
  } catch { return null; }
};

http.interceptors.request.use((config) => {
  // Sync with universal cross-subdomain token
  const token = read(TOKEN_KEY) || (typeof window !== 'undefined' ? window.localStorage.getItem('archon_token') : null);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const url = config.url || '';
  if (url.startsWith('/auth/')) {
    config.baseURL = AUTH_API;
    config.url = url.replace(/^\/auth/, '');
  } else if (url === '/auth') {
    config.baseURL = AUTH_API;
    config.url = '';
  }

  if (url.startsWith('/kiosk/') && !KIOSK_OPEN_PATHS.some((p) => url.startsWith(p))) {
    const kioskToken = readKioskToken();
    if (kioskToken) {
      config.headers['X-Kiosk-Token'] = kioskToken;
    }
  }
  return config;
});

http.interceptors.response.use(
  (response) => {
    const body = response.data;

    // Cache SSO token for cross-subdomain navigation
    if (body?.data?.token) {
      try { window.localStorage.setItem('archon_token', body.data.token); } catch {}
    } else if (body?.token) {
      try { window.localStorage.setItem('archon_token', body.token); } catch {}
    }

    // Unwrap standardized central gateway envelope { success: true, data }
    if (body && typeof body === 'object' && body.success !== undefined && body.data !== undefined) {
      if (typeof body.data === 'object' && !Array.isArray(body.data) && body.data !== null) {
        return { ...body, ...body.data };
      }
      return { ...body, data: body.data };
    }
    return body;
  },
  (error) => {
    if (error.response?.status === 401) {
      if (error.response?.data?.code === 'kiosk_locked') {
        try { window.localStorage.removeItem(KIOSK_TOKEN_KEY); } catch { /* ignore */ }
        window.dispatchEvent(new Event(KIOSK_LOCKED_EVENT));
      } else {
        const hadToken = !!read(TOKEN_KEY);
        remove(TOKEN_KEY);
        try { window.localStorage.removeItem('archon_token'); } catch {}
        if (hadToken) window.dispatchEvent(new Event(SESSION_ENDED_EVENT));
      }
    }
    return Promise.reject(error);
  }
);

export function getToken() {
  return read(TOKEN_KEY) || (typeof window !== 'undefined' ? window.localStorage.getItem('archon_token') : null);
}

export function setToken(token) {
  write(TOKEN_KEY, token);
  try { window.localStorage.setItem('archon_token', token); } catch {}
}

export function clearToken() {
  remove(TOKEN_KEY);
  try { window.localStorage.removeItem('archon_token'); } catch {}
}

export default http;
