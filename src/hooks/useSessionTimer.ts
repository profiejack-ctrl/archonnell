/**
 * Session inactivity countdown (port of the legacy js/session-timer.js).
 *
 * The timer shows the REAL time left before the PHP session expires. Both
 * numbers come from the server (SESSION_TIMEOUT = 300 s and the seconds left
 * now), so client and server always agree:
 *
 *  - counts down every second from a wall-clock deadline (05:00 ... 00:00),
 *  - real activity (mouse, keyboard, scroll, touch) resets it to full and
 *    tells the server (session_touch), throttled to one request per 15 s
 *    with a trailing send,
 *  - "Session Expiring Soon" SweetAlert2 warning at 60 s left,
 *  - at 00:00 it asks the server (passive check). The server ends the expired
 *    session; the UI clears its state and returns to the login page, which
 *    shows the "Session Expired" notice. If the server says the session is
 *    still alive (activity in another tab) it adopts that time instead,
 *  - all tabs share one session: localStorage keeps their timers in step.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { authService } from '../services/authService';
import { ArchonAlert } from '../utils/alerts';

const TOUCH_MIN_MS = 15000;
const WARN_AT = 60;
const CHECK_MIN_MS = 10000;
const KEY_DEADLINE = 'archon_session_deadline';
const KEY_EXPIRED = 'archon_session_expired';
const KEY_END = 'archon_session_end';

function store(key: string, value: string | number): void {
    try { localStorage.setItem(key, String(value)); } catch { /* storage unavailable */ }
}

export function formatTimer(total: number): string {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

export interface SessionTimer {
    display: string;
    /** End the session in the UI (used by the global 401 handler too). */
    expire: () => void;
}

export function useSessionTimer(timeout: number, initialRemaining: number, onExpired: () => void): SessionTimer {
    const [display, setDisplay] = useState(formatTimer(Math.max(0, initialRemaining)));
    const onExpiredRef = useRef(onExpired);
    onExpiredRef.current = onExpired;
    const expireRef = useRef<() => void>(() => undefined);

    useEffect(() => {
        if (!timeout) return undefined;
        let deadline = Date.now() + Math.max(0, initialRemaining) * 1000;
        let expired = false;
        let warned = false;
        let warnOpen = false;
        let lastReset = 0;
        let lastTouchAt = 0;
        let lastCheckAt = 0;
        let touchTimer: number | null = null;
        let dirty = false;
        let checking = false;

        const remainingSeconds = () => Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        const render = () => setDisplay(formatTimer(remainingSeconds()));
        const publish = () => store(KEY_DEADLINE, deadline);

        const closeWarning = () => {
            warned = false;
            if (warnOpen && ArchonAlert.isVisible()) ArchonAlert.close();
            warnOpen = false;
        };
        const showWarning = () => {
            if (warned || expired || ArchonAlert.isVisible()) return;
            warned = true;
            warnOpen = true;
            void ArchonAlert.warning('Your session will expire soon due to inactivity.', {
                title: 'Session Expiring Soon',
                confirmText: 'Stay Logged In',
            }).then(res => {
                warnOpen = false;
                if (res && res.isConfirmed) reset(true);
            });
        };

        const expire = () => {
            if (expired) return;
            expired = true;
            window.clearInterval(ticker);
            if (touchTimer !== null) window.clearTimeout(touchTimer);
            setDisplay('00:00');
            try { localStorage.removeItem(KEY_DEADLINE); } catch { /* ignore */ }
            store(KEY_EXPIRED, Date.now()); // tells the other tabs
            closeWarning();
            // The session is already invalid server-side; the login page shows the SweetAlert2 notice.
            onExpiredRef.current();
        };
        expireRef.current = expire;

        // Server is authoritative, but never shorten the display while a newer
        // local activity ping is still waiting to be sent.
        const syncFromServer = (rem: number) => {
            const serverDeadline = Date.now() + rem * 1000;
            const pending = dirty || touchTimer !== null;
            if (serverDeadline > deadline + 2000 || (!pending && Math.abs(serverDeadline - deadline) > 3000)) {
                deadline = serverDeadline;
                publish();
                if (remainingSeconds() > WARN_AT) closeWarning();
                render();
            }
        };

        const checkServer = () => {
            if (expired || checking) return;
            checking = true;
            lastCheckAt = Date.now();
            authService.sessionStatus()
                .then(d => { if (d.remaining > 0) syncFromServer(d.remaining); else expire(); })
                .catch((err: { status?: number }) => {
                    if (err && err.status === 401) { expire(); return; }
                    // Cannot confirm the session: fail closed once our own countdown has run out.
                    if (remainingSeconds() <= 0) expire();
                })
                .finally(() => { checking = false; });
        };

        const scheduleTouch = () => {
            dirty = true;
            if (touchTimer !== null) return;
            const wait = Math.max(0, TOUCH_MIN_MS - (Date.now() - lastTouchAt));
            touchTimer = window.setTimeout(sendTouch, wait);
        };
        const sendTouch = () => {
            touchTimer = null;
            if (!dirty || expired) return;
            dirty = false;
            lastTouchAt = Date.now();
            authService.sessionTouch()
                .then(d => syncFromServer(d.remaining))
                .catch((err: { status?: number }) => {
                    if (err && err.status === 401) { expire(); return; }
                    dirty = true; // retry on the next window
                    scheduleTouch();
                });
        };

        const reset = (force: boolean) => {
            if (expired) return;
            const now = Date.now();
            if (!force && now - lastReset < 1000) return; // cheap throttle for event floods
            lastReset = now;
            deadline = now + timeout * 1000;
            publish();
            closeWarning();
            scheduleTouch();
            render();
        };

        const activity = () => reset(false);
        const events = ['mousemove', 'mousedown', 'click', 'keydown', 'scroll', 'wheel', 'touchstart'] as const;
        events.forEach(ev => window.addEventListener(ev, activity, { passive: true, capture: true }));

        const tick = () => {
            if (expired) return;
            const rem = remainingSeconds();
            render();
            if (rem <= 0) { checkServer(); return; }
            if (rem <= WARN_AT) showWarning();
        };

        const onStorage = (e: StorageEvent) => {
            if (expired) return;
            if (e.key === KEY_DEADLINE && e.newValue) {
                const d = Number(e.newValue);
                if (d > deadline) { // another tab had activity: same session, same timer
                    deadline = d;
                    if (remainingSeconds() > WARN_AT) closeWarning();
                    render();
                }
            } else if (e.key === KEY_EXPIRED) {
                expire();
            } else if (e.key === KEY_END) {
                checkServer(); // the login page opened elsewhere: is our session still valid?
            }
        };
        const onVisibility = () => {
            if (document.visibilityState === 'visible' && Date.now() - lastCheckAt > CHECK_MIN_MS) checkServer();
        };
        // Back/forward cache: never show a stale authenticated page after logout/expiry.
        const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) window.location.reload(); };

        window.addEventListener('storage', onStorage);
        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('pageshow', onPageShow);

        publish();
        render();
        const ticker = window.setInterval(tick, 1000);
        if (remainingSeconds() <= 0) checkServer();

        return () => {
            expired = true; // stop any in-flight callbacks from acting after unmount
            window.clearInterval(ticker);
            if (touchTimer !== null) window.clearTimeout(touchTimer);
            events.forEach(ev => window.removeEventListener(ev, activity, { capture: true }));
            window.removeEventListener('storage', onStorage);
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('pageshow', onPageShow);
        };
        // Start once per authenticated session; later values come from the server.
    }, [timeout]);

    const expire = useCallback(() => expireRef.current(), []);
    return { display, expire };
}
