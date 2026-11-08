import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authService } from '../services/authService';
import { setCsrfToken } from '../services/http';
import type { Session } from '../types';

interface AuthValue {
    session: Session | null;
    loading: boolean;
    /** The server ended the session for inactivity (open the login page with the timeout notice). */
    expired: boolean;
    /** Re-read the session from the server (after login, or to refresh the CSRF token). */
    refresh: () => Promise<Session | null>;
    /** Forget the session locally (the server session is already gone or being ended). */
    clear: () => void;
    can: (permission: string) => boolean;
    hasRole: (role: string) => boolean;
    hasAnyRole: (roles: string[]) => boolean;
    setUnreadCount: (n: number) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [expired, setExpired] = useState(false);

    const refresh = useCallback(async () => {
        try {
            // Ask first (always 200), so an anonymous visit never logs a 401.
            const st = await authService.state();
            setCsrfToken(st.csrf_token);
            setExpired(!!st.expired);
            if (!st.authenticated) {
                setSession(null);
                return null;
            }
            const me = await authService.me();
            setCsrfToken(me.csrf_token);
            setSession(me);
            return me;
        } catch {
            setSession(null);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void refresh(); }, [refresh]);

    const clear = useCallback(() => setSession(null), []);
    const setUnreadCount = useCallback((n: number) => {
        setSession(s => (s ? { ...s, unread_count: n } : s));
    }, []);

    const value = useMemo<AuthValue>(() => {
        const roleIs = (role: string) => !!session && session.user.role_name.toLowerCase() === role.toLowerCase();
        return {
            session,
            loading,
            expired,
            refresh,
            clear,
            setUnreadCount,
            // UI visibility only - the API enforces the same permission server-side.
            can: (permission: string) => !!session && session.permissions.includes(permission),
            hasRole: roleIs,
            hasAnyRole: (roles: string[]) => roles.some(roleIs),
        };
    }, [session, loading, expired, refresh, clear, setUnreadCount]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
    return ctx;
}

/** Permission slugs (must match the `permissions` table / config/auth.php). */
export const PERM = {
    DASHBOARD: 'dashboard',
    APPLICANTS: 'applicant_management',
    RECRUITMENT: 'recruitment_management',
    ONBOARDING: 'onboarding_management',
    CORE_HCM: 'core_hcm',
    ESS: 'ess',
    EMPLOYEE_RECORDS: 'employee_records',
    USER_MANAGEMENT: 'user_management',
    ROLE_MANAGEMENT: 'role_management',
    PERMISSION_MANAGEMENT: 'permission_management',
    AUDIT_LOGS: 'audit_logs',
    ANNOUNCEMENTS: 'announcement_management',
    TIME_ATTENDANCE: 'time_attendance',
    SHIFT_SCHEDULE: 'shift_schedule',
    LEAVE: 'leave_management',
    REPORTS: 'reports',
} as const;
