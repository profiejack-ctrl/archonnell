import type { ApiClient, ApiRequestOptions } from '../../types/api';
import { read } from '../../utils/storage';
import { API_BASE } from '../../config/api';

const base = API_BASE;

async function request<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const token =
    options.token ||
    read<string>('session:token', '') ||
    (typeof window !== 'undefined' ? window.localStorage.getItem('archon_token') || '' : '');

  if (!token) {
    throw new Error(
      'Your login session is missing. Please sign out and sign in again, then complete OTP verification.'
    );
  }

  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('Authorization', `Bearer ${token}`);

  const { token: _token, ...fetchOptions } = options;

  const response = await fetch(`${base}${path}`, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    let message = 'Request failed';

    try {
      const body = (await response.json()) as {
        message?: string;
        error?: { message?: string };
      };

      message = body.message || body.error?.message || message;
    } catch {
      // Keep the fallback message when the response is not JSON.
    }

    if (response.status === 401) {
      message =
        'Your session is invalid or expired. Please sign out and sign in again, then complete OTP verification.';
      if (!options.token && read<string>('session:token', '') === token && typeof window !== 'undefined') {
        try {
          window.localStorage.removeItem('session:token');
          window.localStorage.removeItem('session:user');
          window.localStorage.removeItem('archon_token');
          window.location.assign('/');
        } catch {
          // Storage or navigation is unavailable
        }
      }
    }

    throw Object.assign(new Error(message), { status: response.status });
  }

  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T);
}

export const apiClient: ApiClient = {
  get: (path, options) =>
    request(path, { ...options, method: 'GET' }),

  post: (path, body, options) =>
    request(path, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    }),

  put: (path, body, options) =>
    request(path, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  patch: (path, body, options) =>
    request(path, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  delete: (path, options) =>
    request(path, { ...options, method: 'DELETE' }),
};
