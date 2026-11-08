/**
 * Low-level HTTP client for Archon Nell Core HRMS.
 *
 * - Decoupled from legacy PHP scripts and rewires directly to the Central Backend Gateway.
 * - All queries and mutations route through Central API Gateway (/api/v1/hrms/bridge).
 * - Carries Universal JWT Bearer token from localStorage for seamless cross-subdomain SSO.
 * - Supports CSRF token compatibility and inactivity timeout tracking.
 */

/** Centralized Backend API Gateway URL for HRMS */
export const API_BASE: string = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:4000/api/v1/hrms';
export const AUTH_BASE: string = (import.meta.env.VITE_AUTH_URL as string | undefined) || 'http://localhost:4000/api/v1/auth';
export const GATEWAY_BASE: string = (import.meta.env.VITE_GATEWAY_URL as string | undefined) || 'http://localhost:4000';

/** URL of a backend file or stored upload (e.g. "uploads/announcements/x.jpg"). */
export function backendUrl(path: string): string {
    if (/^(https?:|data:|blob:)/i.test(path)) return path;
    return `${GATEWAY_BASE}/${path.replace(/^\/+/, '')}`;
}

let csrfToken = 'archon_central_csrf_token';
export function setCsrfToken(token: string): void { csrfToken = token || 'archon_central_csrf_token'; }
export function getCsrfToken(): string { return csrfToken; }

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void { onUnauthorized = handler; }

export class ApiError extends Error {
    status: number;
    data: Record<string, unknown>;
    constructor(message: string, status: number, data: Record<string, unknown> = {}) {
        super(message);
        this.status = status;
        this.data = data;
    }
}

export type Fields = Record<string, string | number | boolean | null | undefined | Array<string | number>>;

function toBody(fields: Fields): URLSearchParams {
    const body = new URLSearchParams();
    Object.entries(fields).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        if (Array.isArray(value)) value.forEach(v => body.append(`${key}[]`, String(v)));
        else body.append(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
    });
    return body;
}

async function parse<T>(response: Response, notify401: boolean): Promise<T> {
    if (response.status === 401 && notify401 && onUnauthorized) onUnauthorized();
    const text = await response.text();
    let data: Record<string, unknown>;
    try {
        data = JSON.parse(text);
    } catch {
        throw new ApiError(`Server returned invalid response (${response.status} ${response.statusText || 'Error'})`, response.status);
    }
    if (!response.ok || (data.success !== undefined && !data.success)) {
        throw new ApiError(String(data.message || 'Request failed'), response.status, data);
    }
    return data as T;
}

export interface GetOptions { passive?: boolean; notify401?: boolean }

/** GET request routed through Central HRMS Bridge */
export async function httpGet<T>(_file: string, action: string, params: Record<string, string | number> = {}, opts: GetOptions = {}): Promise<T> {
    const qs = new URLSearchParams({ action, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
    const token = localStorage.getItem('archon_token') || '';

    const url = `${API_BASE}/bridge?${qs.toString()}`;
    const response = await fetch(url, {
        headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(opts.passive ? { 'X-Session-Passive': '1' } : {})
        },
        credentials: 'include',
        cache: 'no-store',
    });
    return parse<T>(response, opts.notify401 ?? true);
}

/** POST request routed through Central HRMS Bridge */
export async function httpPost<T>(_file: string, action: string, fields: Fields = {}, opts: { notify401?: boolean } = {}): Promise<T> {
    const body = toBody({ action, csrf_token: csrfToken, ...fields });
    const token = localStorage.getItem('archon_token') || '';

    const url = `${API_BASE}/bridge`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRF-Token': csrfToken,
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        credentials: 'include',
        body,
    });
    return parse<T>(response, opts.notify401 ?? true);
}

/** multipart/form-data upload routed through Central Gateway */
export async function httpUpload<T>(_file: string, fields: Record<string, string | Blob>): Promise<T> {
    const fd = new FormData();
    fd.append('csrf_token', csrfToken);
    Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
    const token = localStorage.getItem('archon_token') || '';

    const url = `${API_BASE}/bridge`;
    const response = await fetch(url, {
        method: 'POST',
        body: fd,
        headers: {
            'X-CSRF-Token': csrfToken,
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        credentials: 'include',
    });
    return parse<T>(response, true);
}

/** Shortcuts for the main HRMS API */
export const api = {
    get: <T>(action: string, params: Record<string, string | number> = {}, opts: GetOptions = {}) => httpGet<T>('api.php', action, params, opts),
    post: <T>(action: string, fields: Fields = {}) => httpPost<T>('api.php', action, fields),
};
