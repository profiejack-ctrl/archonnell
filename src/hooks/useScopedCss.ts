import { useEffect } from 'react';

/**
 * Attach a stylesheet only while the calling page is mounted. The login /
 * access-denied pages load css/login.css, which redefines shared class names
 * (.form-group, .checkbox-label); in the multi-page app it never reached the
 * HRMS pages, so in the SPA it must not stay in the document either.
 */
export function useScopedCss(id: string, cssText: string): void {
    useEffect(() => {
        const style = document.createElement('style');
        style.setAttribute('data-scoped-css', id);
        style.textContent = cssText;
        document.head.appendChild(style);
        return () => { style.remove(); };
    }, [id, cssText]);
}
