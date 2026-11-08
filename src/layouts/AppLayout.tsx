import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { AnnouncementViewerProvider } from './AnnouncementViewer';
import { useAuth } from '../hooks/AuthContext';
import { useSessionTimer } from '../hooks/useSessionTimer';
import { useTheme } from '../hooks/useTheme';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { setUnauthorizedHandler } from '../services/http';
import { authService } from '../services/authService';
import { ArchonAlert } from '../utils/alerts';
import { pageTitle } from '../routes';

const KEY_COLLAPSED = 'archon_sidebar_collapsed';
const KEY_ACTIVE_PAGE = 'archon_active_page';

/** The authenticated HRMS shell: header, sidebar, content area, session timer. */
export default function AppLayout() {
    const { session } = useAuth();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { dark, toggle } = useTheme();
    const isMobile = useMediaQuery('(max-width: 768px)');
    const [mobileOpen, setMobileOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(() => {
        try { return !window.matchMedia('(max-width: 768px)').matches && localStorage.getItem(KEY_COLLAPSED) === 'true'; } catch { return false; }
    });

    // Only navigate: the login page forgets the local session once the server
    // confirms it is gone. (Clearing here would let the auth guard redirect to
    // a bare /login first and lose the ?msg= notice.)
    const onExpired = useCallback(() => {
        navigate('/login?msg=timeout', { replace: true });
    }, [navigate]);

    const timer = useSessionTimer(session?.timeout ?? 0, session?.remaining ?? 0, onExpired);

    // Any API call answering 401 means the PHP session is gone.
    useEffect(() => {
        setUnauthorizedHandler(timer.expire);
        return () => setUnauthorizedHandler(null);
    }, [timer.expire]);

    // Remember the page and title it, as showPage() did.
    useEffect(() => {
        const page = pathname.replace(/^\//, '');
        try { localStorage.setItem(KEY_ACTIVE_PAGE, page); } catch { /* ignore */ }
        document.title = `${pageTitle(pathname)} - Archon Nell Incorporated`;
    }, [pathname]);

    // Back to desktop width -> drop any open-drawer state.
    useEffect(() => { if (!isMobile) setMobileOpen(false); }, [isMobile]);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);

    const toggleCollapsed = () => {
        setCollapsed(c => {
            const next = !c;
            try { localStorage.setItem(KEY_COLLAPSED, String(next)); } catch { /* ignore */ }
            return next;
        });
    };

    const toggleMobile = () => {
        setCollapsed(false); // full-width drawer on mobile, never a rail
        setMobileOpen(o => !o);
    };

    const logout = async () => {
        const ok = await ArchonAlert.confirm({ title: 'Log Out', text: 'Do you want to log out?', icon: 'question', confirmText: 'Log Out' });
        if (!ok) return;
        try { sessionStorage.clear(); localStorage.removeItem(KEY_ACTIVE_PAGE); } catch { /* ignore */ }
        try { await authService.logout(); } catch { /* the session is ended either way */ }
        navigate('/login?msg=loggedout', { replace: true });
    };

    if (!session) return null;

    return (
        <AnnouncementViewerProvider>
            <div className="app-layout">
                <Header timer={timer.display} dark={dark} onToggleTheme={toggle} mobileOpen={mobileOpen}
                    onToggleMobile={toggleMobile} homePath={`/${session.landing_page}`} />
                <div className="layout-body">
                    <Sidebar collapsed={collapsed && !isMobile} onToggleCollapsed={toggleCollapsed} mobileOpen={mobileOpen}
                        onNavigate={() => { if (isMobile) setMobileOpen(false); }} onLogout={() => void logout()} />
                    <div className={`sidebar-scrim${mobileOpen ? ' is-visible' : ''}`} id="sidebarScrim" aria-hidden="true" onClick={() => setMobileOpen(false)}></div>
                    <main className="main-content">
                        <div className="content-area" id="contentArea">
                            <Outlet />
                        </div>
                    </main>
                </div>
            </div>
        </AnnouncementViewerProvider>
    );
}
