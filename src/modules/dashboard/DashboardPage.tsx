import { useEffect } from 'react';
import { ArrowRight, Calendar, Megaphone, User, UserPlus, UserSearch, Users } from 'lucide-react';
import Icon from '../../components/Icon';
import { Badge, Card, Page, PageHeader, PageState, StatCard, StatsGrid } from '../../components/ui';
import { AnimatedProgress, BarColumns, Donut, Legend } from '../../components/charts';
import { usePageData } from '../../hooks/usePageData';
import { dashboardService } from '../../services/dashboardService';
import { announcementService } from '../../services/announcementService';
import { backendUrl } from '../../services/http';
import { useAnnouncementViewer } from '../../layouts/AnnouncementViewer';
import { ANNOUNCEMENTS_REFRESH_EVENT } from '../../layouts/NotificationBell';
import { ArchonAlert } from '../../utils/alerts';
import { announceExcerpt, num, phpMj, phpMjY, phpMjYatgiA, parseDbDate } from '../../utils/format';

const RECENT_BADGE: Record<string, string> = {
    New: 'badge-info', Reviewing: 'badge-warning', Interview: 'badge-warning', Offer: 'badge-info', Hired: 'badge-success', Rejected: 'badge-danger',
};

export default function DashboardPage() {
    const { data, loading, error, retry, setData } = usePageData(dashboardService.page);
    const openAnnouncement = useAnnouncementViewer();

    // The bell's 60 s refresh also keeps this list current (a newly published announcement appears).
    useEffect(() => {
        const onRefresh = () => {
            announcementService.dashboard(true)
                .then(res => setData(d => (d ? { ...d, announcements: res.data || [] } : d)))
                .catch(err => console.warn('dashboard_announcements:', err instanceof Error ? err.message : err));
        };
        window.addEventListener(ANNOUNCEMENTS_REFRESH_EVENT, onRefresh);
        return () => window.removeEventListener(ANNOUNCEMENTS_REFRESH_EVENT, onRefresh);
    }, [setData]);

    const exportInfo = () => void ArchonAlert.info('Export is ready to be connected to a CSV/PDF report endpoint.');

    return (
        <Page id="dashboard">
            <PageHeader title="Dashboard Overview" />
            <PageState loading={loading} error={error} onRetry={retry} />
            {data && (
                <>
                    <div className="card hover-card announce-panel" id="dashboardAnnouncePanel" hidden={!data.announcements.length}>
                        <div className="card-header">
                            <div>
                                <h3 className="card-title"><Icon as={Megaphone} /> Announcements</h3>
                                <p className="card-subtitle">Latest updates from Human Resources &amp; Administration</p>
                            </div>
                            <Badge variant="badge-info">{data.announcements.length} active</Badge>
                        </div>
                        <div className="card-body">
                            <div className="announce-list" id="dashboardAnnounceList">
                                {data.announcements.map(a => {
                                    const excerpt = announceExcerpt(a);
                                    return (
                                        <button type="button" className="announce-card employee-announcement-item" data-ann-id={a.id} key={a.id} onClick={() => openAnnouncement(a.id)}>
                                            <span className={`announce-card-cover${a.cover_image ? '' : ' is-placeholder'}`}>
                                                {a.cover_image ? <img src={backendUrl(a.cover_image)} alt="" /> : <Icon as={Megaphone} />}
                                            </span>
                                            <span className="announce-card-body">
                                                <span className="announce-card-title">{a.title}</span>
                                                {excerpt !== '' && <span className="announce-card-excerpt">{excerpt}</span>}
                                                <span className="announce-card-meta">
                                                    <span><Icon as={Calendar} /> {phpMjYatgiA(a.published_at)}</span>
                                                    <span className="announce-card-meta-sep">&middot;</span>
                                                    <span><Icon as={User} /> Posted by {a.created_by_name || 'Human Resources & Administration'}</span>
                                                </span>
                                                <span className="announce-card-more">Read announcement <Icon as={ArrowRight} /></span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Analytics & operational widgets are for HR roles only; Employees see announcements only. */}
                    {data.show_analytics && data.stats && (
                        <>
                            <StatsGrid>
                                <StatCard icon={UserSearch} gradient={['#2563eb', '#1e40af']} value={num(data.stats.applicants)} label="Total Applicants" trend={data.stats.applicants_trend} />
                                <StatCard icon={UserPlus} gradient={['#f59e0b', '#d97706']} value={num(data.stats.onboarding)} label="Onboarding Now" trend={data.stats.onboarding_trend} />
                                <StatCard icon={Users} gradient={['#8b5cf6', '#7c3aed']} value={num(data.stats.employees)} label="Total Employees" trend={data.stats.employees_trend} />
                            </StatsGrid>
                            <div className="analytics-grid">
                                <Card className="analytics-card" title="Recruitment Trend" subtitle="Monthly applicants and hires"
                                    actions={<button className="btn btn-sm btn-outline" onClick={exportInfo}>Export</button>}>
                                    <BarColumns id="recruitmentChart" max={data.recruitment_trend?.max ?? 1}
                                        items={(data.recruitment_trend?.items ?? []).map(t => ({ label: t.label, value: t.count }))} />
                                </Card>
                                <Card className="analytics-card" title="Department Distribution" subtitle="Employee distribution per department">
                                    {!data.dept_distribution?.items.length ? (
                                        <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No employees yet - hire an applicant to see department distribution.</p>
                                        </div>
                                    ) : (
                                        <>
                                            <Donut id="donutChart" segments={data.dept_distribution.items} value={data.dept_distribution.total} label="Total" withSegment />
                                            <Legend items={data.dept_distribution.items} />
                                        </>
                                    )}
                                </Card>
                            </div>
                            <div className="cards-grid">
                                <div className="card hover-card">
                                    <div className="card-header">
                                        <h3 className="card-title">Recent Applicants</h3>
                                        <button className="btn btn-sm btn-outline">View All</button>
                                    </div>
                                    <div className="card-body">
                                        <div className="recent-list">
                                            {!data.recent_applicants?.length ? (
                                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '0.5rem 0' }}>No applicants yet.</p>
                                            ) : data.recent_applicants.map((ra, i) => (
                                                <div className="recent-item hover-item" key={i}>
                                                    <div className="item-avatar" style={{ background: '#dbeafe' }}>
                                                        <Icon as={User} style={{ color: '#2563eb' }} />
                                                    </div>
                                                    <div className="item-content">
                                                        <div className="item-title">{ra.full_name}</div>
                                                        <div className="item-subtitle">{ra.position}</div>
                                                        <div className="item-meta"><Icon as={Calendar} /> {phpMjY(ra.applied_at)}</div>
                                                    </div>
                                                    <Badge variant={RECENT_BADGE[ra.status] ?? 'badge-info'}>{ra.status}</Badge>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="card hover-card">
                                    <div className="card-header">
                                        <h3 className="card-title">Onboarding Progress</h3>
                                        <button className="btn btn-sm btn-outline">View All</button>
                                    </div>
                                    <div className="card-body">
                                        <div className="onboarding-list">
                                            {!data.onboarding_progress?.length ? (
                                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '0.5rem 0' }}>No employees are currently onboarding.</p>
                                            ) : data.onboarding_progress.map((o, i) => {
                                                const pct = Math.max(0, Math.min(100, Number(o.progress) || 0));
                                                const d = parseDbDate(o.dh);
                                                const meta = d ? `${d.getTime() > Date.now() ? 'Starts ' : 'Hired '}${phpMj(o.dh)}` : '';
                                                return (
                                                    <div className="onboarding-item hover-item" key={o.id}>
                                                        <div className="onboarding-info">
                                                            <div className="onboarding-name">{o.fname}</div>
                                                            <div className="onboarding-role">{o.pos}</div>
                                                            {meta !== '' && <div className="onboarding-meta"><Icon as={Calendar} /> {meta}</div>}
                                                        </div>
                                                        <AnimatedProgress index={i} pct={pct} />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}
        </Page>
    );
}
