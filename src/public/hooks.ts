import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ArchonAlert } from '../utils/alerts';

const SITE = 'Archon Nell Incorporated';
const DEFAULT_META = 'Archon Nell Incorporated - Engineering, construction, chemical and industrial solutions.';

/** <title> "Page | Archon Nell Incorporated" and the meta description, as the PHP header printed them. */
export function usePageMeta(title: string, description: string = DEFAULT_META): void {
    useEffect(() => {
        document.title = title ? `${title} | ${SITE}` : SITE;
        let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
        if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'description';
            document.head.appendChild(meta);
        }
        meta.content = description;
    }, [title, description]);
}

/**
 * Scroll reveal: every ".reveal" element gets ".visible" once it scrolls into
 * view (js/main.js). Elements rendered later (e.g. recommendation cards) are
 * picked up too.
 */
export function useReveal(threshold = 0.12): void {
    const location = useLocation();
    useEffect(() => {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold });
        const observed = new WeakSet<Element>();
        const scan = () => {
            document.querySelectorAll('.reveal:not(.visible)').forEach(el => {
                if (!observed.has(el)) {
                    observed.add(el);
                    observer.observe(el);
                }
            });
        };
        scan();
        const mutations = new MutationObserver(scan);
        mutations.observe(document.body, { childList: true, subtree: true });
        return () => { mutations.disconnect(); observer.disconnect(); };
    }, [location.pathname, threshold]);
}

/** Each page starts at the top, like a normal page load. */
export function useScrollTopOnNavigate(): void {
    const { pathname } = useLocation();
    useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
}

/** The site's toast: the standard SweetAlert2 system alert (js/main.js showToast). */
export function showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info'): void {
    void ArchonAlert[type](message, type === 'error' ? undefined : { timer: 3500 });
}

export function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
