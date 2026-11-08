import { useCallback, useEffect, useState } from 'react';

const KEY = 'archon_dark_mode';

function stored(): boolean {
    try { return localStorage.getItem(KEY) === 'true'; } catch { return false; }
}

/**
 * Light / dark theme ("body.dark", remembered in localStorage) - applied while
 * the HRMS shell is mounted, exactly like app.js did on the dashboard pages
 * (the login and access-denied pages never used the dark theme).
 */
export function useTheme() {
    const [dark, setDark] = useState(stored);

    useEffect(() => {
        document.body.classList.toggle('dark', dark);
        try { localStorage.setItem(KEY, dark ? 'true' : 'false'); } catch { /* ignore */ }
    }, [dark]);

    useEffect(() => () => { document.body.classList.remove('dark'); }, []);

    const toggle = useCallback(() => setDark(d => !d), []);
    return { dark, toggle };
}
