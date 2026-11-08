import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Archive, BarChart3, Sparkles, UserX, Briefcase, Building2, CalendarCheck, CalendarClock, ClipboardPlus, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, Clock, FileBarChart, Folder, History,
    IdCard, LayoutDashboard, List, Lock, LogOut, Megaphone, Settings, ShieldCheck, User, UserCheck, UserPlus, Users, UsersRound,
    type LucideIcon,
} from 'lucide-react';
import Icon from '../components/Icon';
import ArchonLogo from '../components/ArchonLogo';
import { PERM, useAuth } from '../hooks/AuthContext';
import { canOpen } from '../routes';

interface NavLeaf { path: string; label: string; icon: LucideIcon }
interface NavGroup { key: string; label: string; icon: LucideIcon; children: NavLeaf[]; togglePath?: string }
type NavEntry = ({ kind: 'leaf' } & NavLeaf) | ({ kind: 'group' } & NavGroup);

interface SidebarProps {
    collapsed: boolean;
    onToggleCollapsed: () => void;
    mobileOpen: boolean;
    onNavigate: () => void;
    onLogout: () => void;
}

/** Sidebar navigation - same sections, labels, icons and permission gates as index.php / app_shell.php. */
export default function Sidebar({ collapsed, onToggleCollapsed, mobileOpen, onNavigate, onLogout }: SidebarProps) {
    const { can, hasAnyRole, session } = useAuth();
    const navigate = useNavigate();
    const { pathname } = useLocation();

    const main: NavEntry[] = [];
    if (can(PERM.DASHBOARD)) main.push({ kind: 'leaf', path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard });
    if (can(PERM.APPLICANTS)) main.push({ kind: 'group', key: 'applicant-dropdown', label: 'Applicant Management', icon: Users, children: [
        { path: '/applicant-validation', label: 'Applicant Validation', icon: ClipboardCheck },
        { path: '/candidate-ranking', label: 'Candidate Ranking', icon: BarChart3 },
        { path: '/talent-pool', label: 'Talent Pool', icon: Sparkles },
        { path: '/rejected-applicants', label: 'Rejected Applicants', icon: UserX },
        { path: '/archived-applicants', label: 'Archived Applicants', icon: Archive },
    ] });
    if (can(PERM.RECRUITMENT)) main.push({ kind: 'group', key: 'recruitment-dropdown', label: 'Recruitment Management', icon: Briefcase, children: [
        { path: '/job-postings', label: 'Job Posting', icon: Megaphone },
        { path: '/pre-interview', label: 'Pre-Interview', icon: CalendarClock },
        { path: '/final-interview', label: 'Final Interview', icon: UserCheck },
    ] });
    // HR Managers / Admins / Super Admins request employees for their department, Super Admins approve, Recruitment posts the approved ones.
    const vacancy = session?.vacancy;
    if (vacancy && (vacancy.manager_of || vacancy.is_admin || vacancy.can_recruit)) {
        main.push({ kind: 'leaf', path: '/vacancy-requests', label: 'Vacancy Requests', icon: ClipboardPlus });
    }
    if (can(PERM.ONBOARDING)) main.push({ kind: 'leaf', path: '/new-hire-onboarding', label: 'Onboarding', icon: UserPlus });
    if (can(PERM.CORE_HCM)) main.push({ kind: 'leaf', path: '/employee-directory', label: 'Human Capital', icon: Building2 });
    if (can(PERM.EMPLOYEE_RECORDS)) main.push({ kind: 'leaf', path: '/employee-records', label: 'Records', icon: Folder });
    // Everyone's own attendance / schedule / leave; Super Admin / Admin also see every employee's (same page).
    if (canOpen('/attendance-schedule', can)) main.push({ kind: 'leaf', path: '/attendance-schedule', label: 'Attendance & Schedule', icon: Clock });
    if (canOpen('/leave-management', can)) main.push({ kind: 'leaf', path: '/leave-management', label: 'Leave Management', icon: CalendarCheck });
    if (can(PERM.REPORTS)) main.push({ kind: 'leaf', path: '/reports', label: 'Reports', icon: FileBarChart });
    if (can(PERM.ESS)) {
        main.push({ kind: 'group', key: 'profile-dropdown', label: 'Profile', icon: User, togglePath: '/employee-self-service', children: [
            { path: '/employee-self-service', label: 'Personal & Account Information', icon: IdCard },
        ] });
        main.push({ kind: 'group', key: 'settings-dropdown', label: 'Settings', icon: Settings, togglePath: '/settings', children: [
            { path: '/settings', label: 'Account Security', icon: ShieldCheck },
        ] });
    }

    const admin: NavEntry[] = [];
    if (can(PERM.USER_MANAGEMENT)) admin.push({ kind: 'group', key: 'user-management-dropdown', label: 'User Management', icon: UsersRound, children: [
        { path: '/admin/users', label: 'User Directory', icon: List },
        { path: '/admin/create-user', label: 'Register New System User', icon: UserPlus },
    ] });
    if (can(PERM.ROLE_MANAGEMENT)) admin.push({ kind: 'leaf', path: '/admin/roles', label: 'Roles', icon: ShieldCheck });
    if (can(PERM.PERMISSION_MANAGEMENT)) admin.push({ kind: 'leaf', path: '/admin/permissions', label: 'Permissions', icon: Lock });
    if (can(PERM.AUDIT_LOGS)) admin.push({ kind: 'leaf', path: '/admin/audit-logs', label: 'Audit Logs', icon: History });
    if (can(PERM.ANNOUNCEMENTS)) admin.push({ kind: 'leaf', path: '/announcements', label: 'Announcement', icon: Megaphone });
    const showAdmin = hasAnyRole(['Super Admin']) || can(PERM.USER_MANAGEMENT) || can(PERM.ROLE_MANAGEMENT)
        || can(PERM.PERMISSION_MANAGEMENT) || can(PERM.AUDIT_LOGS) || can(PERM.ANNOUNCEMENTS);

    // Which dropdown holds the current page (it is expanded, like showPage() did).
    const groupOf = (path: string) => [...main, ...admin].find(e => e.kind === 'group' && e.children.some(c => c.path === path));
    const [expanded, setExpanded] = useState<string | null>(() => {
        const g = groupOf(pathname);
        return g && g.kind === 'group' ? g.key : null;
    });
    useEffect(() => {
        const g = groupOf(pathname);
        if (g && g.kind === 'group') setExpanded(g.key);
    }, [pathname]);

    const go = (path: string) => { navigate(path); onNavigate(); };

    const renderLeaf = (item: NavLeaf, sub: boolean) => (
        <a key={item.path} href={`#${item.path}`} className={`nav-item${sub ? ' nav-sub-item' : ''}${pathname === item.path ? ' active' : ''}`}
            onClick={e => { e.preventDefault(); go(item.path); }}>
            <item.icon className="nav-ico" />
            <span>{item.label}</span>
        </a>
    );

    const renderEntry = (entry: NavEntry) => {
        if (entry.kind === 'leaf') return renderLeaf(entry, false);
        const isOpen = expanded === entry.key;
        return (
            <div className={`nav-dropdown${isOpen ? ' expanded' : ''}`} key={entry.key}>
                <a href="#" className="nav-item nav-dropdown-toggle" data-dropdown={entry.key}
                    onClick={e => {
                        e.preventDefault();
                        setExpanded(isOpen ? null : entry.key); // accordion: opening one closes the others
                        if (entry.togglePath) go(entry.togglePath);
                    }}>
                    <entry.icon className="nav-ico" />
                    <span>{entry.label}</span>
                    <ChevronDown className="nav-dropdown-arrow" />
                </a>
                <div className="nav-dropdown-menu" id={entry.key}>
                    {entry.children.map(c => renderLeaf(c, true))}
                </div>
            </div>
        );
    };

    return (
        <aside className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' active' : ''}`} id="sidebar">
            <div className="sidebar-mini-logo" title="Archon Nell Incorporated">
                <ArchonLogo idSuffix="mini" strokeWidth={3} />
            </div>
            <button type="button" className="sidebar-collapse-btn" id="sidebarCollapseBtn" aria-label="Collapse sidebar" onClick={onToggleCollapsed}>
                <Icon as={collapsed ? ChevronRight : ChevronLeft} />
            </button>
            <nav className="sidebar-nav" id="sidebarNav">
                <div className="nav-section">{main.map(renderEntry)}</div>
                {showAdmin && (
                    <div className="nav-section">
                        <div className="nav-section-title">Administration</div>
                        {admin.map(renderEntry)}
                    </div>
                )}
            </nav>
            <div className="sidebar-footer">
                <a href="#" className="nav-item logout-item" onClick={e => { e.preventDefault(); onLogout(); }}>
                    <LogOut className="nav-ico" />
                    <span>Logout</span>
                </a>
            </div>
        </aside>
    );
}
