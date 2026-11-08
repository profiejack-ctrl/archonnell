import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import logo from '../../../../Homepage/assets/img/LOGO.png';
import { backendUrl } from '../../services/http';

/** HRMS login - the Employee Portal reuses the system's own login page. */
export const HRMS_LOGIN_URL = backendUrl('login.php');

interface NavItem { to: string; label: string }

const PUBLIC_NAV: NavItem[] = [
    { to: '/', label: 'HOME' },
    { to: '/about', label: 'ABOUT US' },
    { to: '/projects', label: 'PROJECTS' },
    { to: '/products', label: 'PRODUCTS' },
    { to: '/partners', label: 'PARTNERS' },
    { to: '/contact', label: 'CONTACT US' },
];

// The applicant pages' header never listed Partners.
const APPLICANT_NAV: NavItem[] = PUBLIC_NAV.filter(item => item.to !== '/partners');

/**
 * Site header (includes/public_header.php and, with variant="applicant",
 * includes/header.php): logo, navigation, mobile menu and the scroll shadow.
 */
export default function SiteHeader({ variant }: { variant: 'public' | 'applicant' }) {
    const { pathname } = useLocation();
    const [open, setOpen] = useState(false);
    // null until the first scroll: the stylesheet's own shadow applies until then.
    const [scrolled, setScrolled] = useState<boolean | null>(null);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // Close the mobile menu after following a link.
    useEffect(() => { setOpen(false); }, [pathname]);

    const isApplicant = variant === 'applicant';
    const nav = isApplicant ? APPLICANT_NAV : PUBLIC_NAV;
    // Only the public pages marked the current page.
    const activeClass = (to: string) => (!isApplicant && pathname === to ? 'active' : '');
    // js/main.js: header shadow while scrolled.
    const shadow = scrolled === null ? undefined : (scrolled ? '0 3px 18px rgba(0,45,75,0.12)' : '0 1px 12px rgba(0,0,0,0.05)');

    return (
        <header className={isApplicant ? 'header applicant-header' : 'header'} style={shadow ? { boxShadow: shadow } : undefined}>
            <div className="nav-container">
                <Link to="/" className="logo">
                    <img src={logo} alt="Archon Nell Incorporated Logo" style={{ height: 60, width: 'auto' }} />
                </Link>

                <button className="mobile-toggle" id="mobileToggle" aria-label="Toggle navigation" onClick={() => setOpen(o => !o)}>
                    <span></span>
                    <span></span>
                    <span></span>
                </button>

                <nav className={open ? 'nav open' : 'nav'} id="mainNav">
                    <div className="nav-main">
                        {nav.map(item => (
                            <Link key={item.to} to={item.to} className={activeClass(item.to)} onClick={() => setOpen(false)}>{item.label}</Link>
                        ))}
                    </div>
                    <div className="nav-actions">
                        {/* Applicants checking their application; Sign in stays the HRMS login. */}
                        <Link to="/applicant-portal" className="employee-btn applicant-portal-btn" onClick={() => setOpen(false)}>Applicant Portal</Link>
                        {isApplicant ? (
                            <Link to="/employee-portal" className="employee-btn" onClick={() => setOpen(false)}>Sign in</Link>
                        ) : (
                            <a href={HRMS_LOGIN_URL} className={`employee-btn ${activeClass('/employee-portal')}`}>Sign in</a>
                        )}
                    </div>
                </nav>
            </div>
        </header>
    );
}
