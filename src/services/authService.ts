import { api, httpGet, httpPost } from './http';
import type { Session } from '../types';

export interface AuthState {
    authenticated: boolean;
    /** The inactivity timeout ended the session on this request. */
    expired?: boolean;
    stage: 'credentials' | 'verify';
    masked_email: string;
    notice: string | null;
    csrf_token: string;
    session_timeout: number;
    code_ttl_min: number;
    otp_remaining?: number;
    otp_expires_in?: number;
}

export interface LoginResult {
    stage: 'verify' | 'done' | 'credentials';
    masked_email?: string;
    message?: string;
    sent?: boolean;
    redirect?: string | null;
    csrf_token?: string;
    token?: string;
    user?: any;
    otp_remaining?: number;
    otp_expires_in?: number;
}

/** Authentication (Central Auth Gateway) + the logged-in session (Central HRMS). */
export const authService = {
    state: () => httpGet<AuthState & { success: boolean }>('auth-api.php', 'state', {}, { notify401: false }),
    login: async (identifier: string, password: string) => {
        const res = await httpPost<LoginResult>('auth-api.php', 'login', { identifier, password }, { notify401: false });
        if (res.token) {
            localStorage.setItem('archon_token', res.token);
        }
        return res;
    },
    verify: async (code: string) => {
        const res = await httpPost<LoginResult>('auth-api.php', 'verify', { code }, { notify401: false });
        if (res.token) {
            localStorage.setItem('archon_token', res.token);
        }
        return res;
    },
    resend: () => httpPost<LoginResult>('auth-api.php', 'resend', {}, { notify401: false }),
    cancel: () => httpPost<LoginResult>('auth-api.php', 'cancel', {}, { notify401: false }),
    logout: async () => {
        localStorage.removeItem('archon_token');
        return httpPost<{ success: boolean }>('auth-api.php', 'logout', {}, { notify401: false });
    },

    /** Current user, permissions, CSRF token and session-timer values. */
    me: () => api.get<Session & { success: boolean }>('me', {}, { notify401: false }),

    /** Passive session check - never extends the session. */
    sessionStatus: () => httpGet<{ remaining: number; timeout: number }>('api.php', 'session_status', {}, { passive: true, notify401: false }),
    /** Real user activity ping - extends the session. */
    sessionTouch: () => httpPost<{ remaining: number; timeout: number }>('api.php', 'session_touch', {}, { notify401: false }),
};
