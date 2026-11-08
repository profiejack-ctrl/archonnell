import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Hourglass, Menu, Moon, Sun } from 'lucide-react';
import Icon from '../components/Icon';
import NotificationBell from './NotificationBell';
import { useAuth } from '../hooks/AuthContext';
import { headerDateTime, initials } from '../utils/format';
import logoUrl from '../../../img/LOGO.png';

interface HeaderProps {
    timer: string;
    dark: boolean;
    onToggleTheme: () => void;
    mobileOpen: boolean;
    onToggleMobile: () => void;
    homePath: string;
}

export default function Header({ timer, dark, onToggleTheme, mobileOpen, onToggleMobile, homePath }: HeaderProps) {
    const { session } = useAuth();
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const t = window.setInterval(() => setNow(new Date()), 1000);
        return () => window.clearInterval(t);
    }, []);

    if (!session) return null;
    const u = session.user;

    return (
        <header className="header">
            <div className="logo-section">
                <button type="button" className="mobile-menu-toggle" id="mobileMenuToggle" aria-label="Toggle sidebar menu"
                    aria-expanded={mobileOpen} aria-controls="sidebar" onClick={e => { e.stopPropagation(); onToggleMobile(); }}>
                    <Menu />
                </button>
                <Link to={homePath} className="logo-link">
                    <img src={logoUrl} alt="Archon Nell Incorporated" className="logo-image" />
                </Link>
            </div>
            <div className="header-right">
                <div className="header-info-item">
                    <Icon as={Calendar} />
                    <span id="currentDateTime">{headerDateTime(now)}</span>
                </div>
                <div className="header-info-item">
                    <Icon as={Hourglass} />
                    <span id="timerDisplay">{timer}</span>
                </div>
                <div className="header-actions">
                    <button className="header-icon-btn" id="themeToggle" title="Toggle Theme" onClick={onToggleTheme}>
                        <Icon as={dark ? Sun : Moon} />
                    </button>
                    <NotificationBell />
                </div>
                <div className="header-user-profile" title={u.email}>
                    <div className="user-avatar-sm">{initials(u.first_name, u.last_name)}</div>
                    <span className="user-profile-label">
                        {u.full_name} &middot; {u.role_name}
                    </span>
                </div>
            </div>
        </header>
    );
}
