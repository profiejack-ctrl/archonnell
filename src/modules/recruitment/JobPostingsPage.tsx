import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PERM, useAuth } from '../../hooks/AuthContext';
import {
    Archive, ArchiveRestore, Briefcase, ClipboardCheck, Eye, FilePen, FilePlus2, Globe, Info, Lock, Megaphone, Pencil, Plus, Send, Sparkles, Trash2, Users,
} from 'lucide-react';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import JobPostingView from '../../components/JobPostingView';
import { Badge, EmptyRow, InfoItem, Page, PageHeader, PageState, SearchBox, StatCard, StatsGrid } from '../../components/ui';
import { usePageData } from '../../hooks/usePageData';
import { jobPostingService } from '../../services/jobPostingService';
import { ArchonAlert, confirmDialog } from '../../utils/alerts';
import { applicantNo, datePart, phpMjY, phpMjYgiA } from '../../utils/format';
import { ClearFilters, DateRangeFilter, FilterCount, FilterSelect, SortTh, distinct, inDateRange, is, matchesText, useFilters, useTableView } from '../../components/TableControls';
import JobPostingFormModal, { missingForPublish, toForm } from './JobPostingForm';
import type { JobPosting, JobPostingApplicant, JobPostingStatus, VacancyRequest } from '../../types';
import type { JobPostingPublic } from '../../types/portal';

const STATUS_BADGE: Record<JobPostingStatus, string> = {
    Draft: 'badge-info', Published: 'badge-success', Closed: 'badge-warning', Archived: 'badge-secondary',
};

const STAGE_BADGE: Record<string, string> = {
    Validation: 'badge-info', 'Pre-Interview': 'badge-warning', 'Final Interview': 'badge-warning', Hired: 'badge-success', Rejected: 'badge-danger',
};

/** Actions each status allows (nothing else is shown). */
const ACTIONS: Record<JobPostingStatus, ('view' | 'edit' | 'preview' | 'publish' | 'delete' | 'close' | 'archive' | 'restore')[]> = {
    Draft: ['edit', 'preview', 'publish', 'delete'],
    Published: ['view', 'edit', 'preview', 'close', 'archive'],
    Closed: ['view', 'archive'],
    Archived: ['view', 'restore'],
};

/** "Published" plus why applicants cannot apply yet / any more. */
function StatusCell({ p }: { p: JobPosting }) {
    return (
        <>
            <Badge variant={STATUS_BADGE[p.status]}>{p.status}</Badge>
            {p.status === 'Published' && !p.accepting && p.opening_date && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Opens {phpMjY(p.opening_date)}</div>
            )}
        </>
    );
}

/** Recruitment Management > Job Posting - the start of the recruitment flow. */
export default function JobPostingsPage() {
    const { data, loading, error, retry, reload } = usePageData(jobPostingService.page);
    const { can } = useAuth();
    const navigate = useNavigate();
    const filters = useFilters({ search: '', status: '', department: '', position: '', type: '', from: '', to: '' });
    const f = filters.values;
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<JobPosting | null>(null);
    const [preview, setPreview] = useState<{ job: JobPostingPublic; posting: JobPosting | null } | null>(null);
    const [details, setDetails] = useState<{ posting: JobPosting; applicants: JobPostingApplicant[] | null; request?: VacancyRequest | null } | null>(null);
    const [busy, setBusy] = useState(false);
    // A new posting is always made from an approved vacancy request.
    const [fromRequest, setFromRequest] = useState<VacancyRequest | null>(null);
    const approved = useMemo(() => data?.approved_requests ?? [], [data]);
    const requestsRef = useRef<HTMLDivElement>(null);
    const [params, setParams] = useSearchParams();

    const postings = useMemo(() => data?.postings ?? [], [data]);
    const view = useTableView(postings, p => is(f.status, p.status) && is(f.department, p.department) && is(f.position, p.position) && is(f.type, p.employment_type)
        && inDateRange(p.deadline, f.from, f.to) && matchesText(f.search, p.posting_no, p.title, p.position, p.department, p.employment_type, p.status, p.vacancy_request_no), {
        no: p => p.posting_no, title: p => p.title, department: p => p.department, type: p => p.employment_type, vacancies: p => p.vacancies,
        applicants: p => p.applicant_count, deadline: p => p.deadline, status: p => p.status,
    });
    const rows = view.rows;
    const postingApplicants = useTableView(details?.applicants, () => true, {
        no: a => applicantNo(a), name: a => a.full_name, application: a => a.source_application_no, applied: a => a.applied_at, stage: a => a.stage,
    });
    const approvedView = useTableView(data?.approved_requests, () => true, {
        no: r => r.request_no, department: r => r.department, position: r => r.position, vacancies: r => r.vacancies - r.filled,
        type: r => r.employment_type, needed: r => r.requested_date, approved: r => r.reviewed_at,
    });

    const stats = useMemo(() => ({
        open: postings.filter(p => p.accepting).length,
        drafts: postings.filter(p => p.status === 'Draft').length,
        closed: postings.filter(p => p.status === 'Closed' || p.status === 'Archived').length,
        applicants: postings.reduce((n, p) => n + p.applicant_count, 0),
    }), [postings]);

    const done = async (message: string) => {
        await ArchonAlert.success(message, { timer: 1800 });
        const fresh = await reload();
        // Keep an open details view in step with the change.
        setDetails(d => {
            const updated = d && fresh?.postings.find(p => p.id === d.posting.id);
            return d && updated ? { ...d, posting: updated } : null;
        });
    };

    /** Create Job Posting from an approved vacancy request (pre-filled from it). */
    const openFromRequest = (r: VacancyRequest) => { setEditing(null); setFromRequest(r); setFormOpen(true); };
    const openCreate = () => {
        if (!approved.length) {
            void ArchonAlert.warning('A job posting can only be created from an approved vacancy request, and none are waiting. A department manager requests employees under Vacancy Requests; a Super Admin approves the request.',
                { title: 'No Approved Vacancy Request' });
        } else if (approved.length === 1) {
            openFromRequest(approved[0]);
        } else {
            requestsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            void ArchonAlert.info('Choose the approved vacancy request to post under "Approved Vacancy Requests".', { timer: 2500 });
        }
    };
    const openEdit = (p: JobPosting) => { setDetails(null); setPreview(null); setFromRequest(null); setEditing(p); setFormOpen(true); };

    // Vacancy Requests > Create Job Posting opens here with ?request=<id>.
    useEffect(() => {
        const wanted = Number(params.get('request') || 0);
        if (!wanted || !data) return;
        setParams({}, { replace: true });
        const r = approved.find(x => x.id === wanted);
        if (r) openFromRequest(r);
        else void ArchonAlert.warning('That vacancy request is not approved or already has a job posting.', { title: 'Cannot Create Job Posting' });
    }, [params, data, approved, setParams]);

    const openPreview = async (p: JobPosting) => {
        try {
            const res = await jobPostingService.preview(toForm(p), p.posting_no);
            setPreview({ job: res.preview, posting: p });
        } catch (err) {
            await ArchonAlert.error('Could not build the preview: ' + (err instanceof Error ? err.message : ''));
        }
    };

    const openDetails = async (p: JobPosting) => {
        setDetails({ posting: p, applicants: null });
        try {
            const res = await jobPostingService.detail(p.id);
            setDetails({ posting: res.posting, applicants: res.applicants, request: res.vacancy_request });
        } catch (err) {
            setDetails(null);
            await ArchonAlert.error('Could not load the job posting: ' + (err instanceof Error ? err.message : ''));
        }
    };

    /** Confirm, run, report; used by Publish / Close / Archive / Restore / Delete. */
    const act = async (p: JobPosting, kind: 'publish' | 'close' | 'archive' | 'restore' | 'delete') => {
        if (kind === 'publish') {
            const missing = missingForPublish(toForm(p));
            if (missing.length) {
                await ArchonAlert.warning(`This job posting is not complete yet. Please edit it and fill in: ${missing.join(', ')}.`, { title: 'Not Ready to Publish' });
                return;
            }
        }
        const text = {
            publish: `Publish ${p.posting_no} (${p.title})? It will appear on the careers page and applicants can apply until ${p.deadline ? phpMjY(p.deadline) : 'it is closed'}.`,
            close: `Close ${p.posting_no} (${p.title})? It will no longer accept applications. Existing applicants stay in the recruitment process.`,
            archive: `Archive ${p.posting_no} (${p.title})? It is kept for records but is no longer active. Existing applicants are not affected.`,
            restore: `Restore ${p.posting_no} (${p.title}) as a Draft? You can then edit and publish it again.`,
            delete: `Delete ${p.posting_no} (${p.title})? This draft will be removed permanently.`,
        }[kind];
        const title = { publish: 'Confirm Publish', close: 'Confirm Close', archive: 'Confirm Archive', restore: 'Confirm Restore', delete: 'Confirm Delete' }[kind];
        const danger = kind === 'close' || kind === 'archive' || kind === 'delete';
        const ok = await confirmDialog({ title, paragraphs: [text], icon: danger ? 'warning' : 'question', confirmText: title.replace('Confirm ', ''), danger });
        if (!ok) return;
        setBusy(true);
        try {
            const res = await jobPostingService[kind === 'delete' ? 'remove' : kind](p.id);
            setPreview(null);
            if (kind === 'delete') setDetails(null);
            await done(res.message);
        } catch (err) {
            await ArchonAlert.error(err instanceof Error && err.message ? err.message : 'The action could not be completed.');
        } finally {
            setBusy(false);
        }
    };

    /**
     * The row's action buttons: only those its status allows. A draft that was
     * published before (restored from Archived) keeps its record: no Delete.
     */
    const buttons = (p: JobPosting) => ACTIONS[p.status].filter(a => a !== 'delete' || (!p.published_at && p.applicant_count === 0)).map(a => {
        const b = {
            view: { title: 'View', icon: Eye, run: () => void openDetails(p) },
            edit: { title: 'Edit', icon: Pencil, run: () => openEdit(p) },
            preview: { title: 'Preview (as applicants see it)', icon: Globe, run: () => void openPreview(p) },
            publish: { title: 'Publish', icon: Send, run: () => void act(p, 'publish') },
            delete: { title: 'Delete', icon: Trash2, run: () => void act(p, 'delete') },
            close: { title: 'Close', icon: Lock, run: () => void act(p, 'close') },
            archive: { title: 'Archive', icon: Archive, run: () => void act(p, 'archive') },
            restore: { title: 'Restore as Draft', icon: ArchiveRestore, run: () => void act(p, 'restore') },
        }[a];
        return (
            <button key={a} disabled={busy} className={`table-action-btn btn-job-${a}`} title={b.title} onClick={b.run}
                style={a === 'delete' ? { color: 'var(--danger)' } : undefined}>
                <Icon as={b.icon} />
            </button>
        );
    });

    return (
        <Page id="job-postings">
            <PageHeader title="Job Posting" subtitle="Create, publish and manage job postings - the start of every application" />
            <PageState loading={loading} error={error} onRetry={retry} />
            {data && (
                <>
                    <StatsGrid>
                        <StatCard icon={Megaphone} gradient={['#34d399', '#10b981']} value={stats.open} label="Open for Applications" />
                        <StatCard icon={FilePen} gradient={['#60a5fa', '#3b82f6']} value={stats.drafts} label="Drafts" />
                        <StatCard icon={Lock} gradient={['#fbbf24', '#f59e0b']} value={stats.closed} label="Closed / Archived" />
                        <StatCard icon={Users} gradient={['#a78bfa', '#8b5cf6']} value={stats.applicants} label="Total Applicants" />
                    </StatsGrid>
                    <div className="page-toolbar">
                        <div className="toolbar-left">
                            <button className="btn btn-primary" id="jpBtnCreate" onClick={openCreate}><Icon as={Plus} /> Create Job Posting</button>
                            <SearchBox value={f.search} onChange={filters.set('search')} placeholder="Search posting ID, title, position..." />
                            <select className="form-select" id="jpStatusFilter" aria-label="Status" value={f.status} onChange={e => filters.set('status')(e.target.value)}>
                                <option value="">All Statuses</option>
                                <option value="Draft">Draft</option>
                                <option value="Published">Published</option>
                                <option value="Closed">Closed</option>
                                <option value="Archived">Archived</option>
                            </select>
                            <select className="form-select" id="jpDeptFilter" aria-label="Department" value={f.department} onChange={e => filters.set('department')(e.target.value)}>
                                <option value="">All Departments</option>
                                {data.departments.map(d => (
                                    <option key={d.id} value={d.name}>{d.name}</option>
                                ))}
                            </select>
                            <FilterSelect id="jpPositionFilter" label="Positions" value={f.position} onChange={filters.set('position')} options={distinct(postings, p => p.position)} />
                            <FilterSelect id="jpTypeFilter" label="Employment Types" value={f.type} onChange={filters.set('type')} options={distinct(postings, p => p.employment_type)} />
                            <DateRangeFilter id="jpDeadline" label="Deadline" from={f.from} to={f.to} onFrom={filters.set('from')} onTo={filters.set('to')} />
                            <ClearFilters id="jpClear" active={filters.active} onClear={filters.clear} />
                            <FilterCount shown={rows.length} total={postings.length} />
                        </div>
                    </div>
                    {approved.length > 0 && (
                        <div className="card hover-card" ref={requestsRef} id="jpApprovedRequests" style={{ marginBottom: '1.5rem' }}>
                            <div className="card-header">
                                <div>
                                    <h3 className="card-title"><Icon as={ClipboardCheck} /> Approved Vacancy Requests</h3>
                                    <p className="card-subtitle">Approved by a Super Admin and ready for their job posting</p>
                                </div>
                            </div>
                            <div className="card-body no-padding">
                                <table className="data-table" id="jpApprovedRequestTable">
                                    <thead>
                                        <tr><SortTh view={approvedView} k="no">Request No.</SortTh><SortTh view={approvedView} k="department">Department</SortTh><SortTh view={approvedView} k="position">Position</SortTh><SortTh view={approvedView} k="vacancies">Vacancies</SortTh><SortTh view={approvedView} k="type">Employment Type</SortTh><SortTh view={approvedView} k="needed">Needed By</SortTh><SortTh view={approvedView} k="approved">Approved</SortTh><th>Actions</th></tr>
                                    </thead>
                                    <tbody>
                                        {approvedView.rows.map(r => (
                                            <tr className="hover-row" key={r.id} data-request-id={r.id}>
                                                <td><strong>{r.request_no}</strong></td>
                                                <td>{r.department}</td>
                                                <td>{r.position}</td>
                                                <td>{r.vacancies - r.filled}</td>
                                                <td>{r.employment_type}</td>
                                                <td>{phpMjY(r.requested_date)}</td>
                                                <td>{r.reviewed_at ? phpMjY(r.reviewed_at) : '—'}{r.requested_by_name && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Requested by {r.requested_by_name}</div>}</td>
                                                <td>
                                                    <button className="btn btn-sm btn-primary btn-create-from-request" onClick={() => openFromRequest(r)}>
                                                        <Icon as={FilePlus2} /> Create Job Posting
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    <div className="card hover-card">
                        <div className="card-body no-padding">
                            <table className="data-table" id="jobPostingTable">
                                <thead>
                                    <tr>
                                        <SortTh view={view} k="no">Job Posting ID</SortTh><SortTh view={view} k="title">Job Title</SortTh><SortTh view={view} k="department">Department</SortTh><SortTh view={view} k="type">Employment Type</SortTh>
                                        <SortTh view={view} k="vacancies">Vacancies</SortTh><SortTh view={view} k="applicants">Applicants</SortTh><SortTh view={view} k="deadline">Deadline</SortTh><SortTh view={view} k="status">Status</SortTh><th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {!rows.length ? (
                                        <EmptyRow colSpan={9}>
                                            {postings.length ? 'No records found. Try other filters or clear them.' : <>No job postings yet. Click <strong>Create Job Posting</strong> to start.</>}
                                        </EmptyRow>
                                    ) : rows.map(p => (
                                        <tr className="hover-row" key={p.id} data-id={p.id} data-status={p.status}>
                                            <td><strong>{p.posting_no}</strong></td>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{p.title}</div>
                                                {p.position && p.position !== p.title && <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{p.position}</div>}
                                                {p.vacancy_request_no && <div style={{ fontSize: '0.75rem', color: 'var(--success)' }} title="Approved vacancy request">From {p.vacancy_request_no}</div>}
                                            </td>
                                            <td>{p.department || <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>}</td>
                                            <td>{p.employment_type || '—'}</td>
                                            <td>{p.vacancies ?? '—'}</td>
                                            <td>
                                                {p.applicant_count}
                                                {p.hired_count > 0 && <div style={{ fontSize: '0.75rem', color: 'var(--success)' }}>{p.hired_count} hired</div>}
                                            </td>
                                            <td>{p.deadline ? phpMjY(p.deadline) : '—'}</td>
                                            <td><StatusCell p={p} /></td>
                                            <td style={{ whiteSpace: 'nowrap' }}>{buttons(p)}
                                                {p.status === 'Published' && can(PERM.APPLICANTS) && (
                                                    // Approved vacancy -> posting -> search the Talent Pool (AI matching; HR decides whom to contact).
                                                    <button className="table-action-btn btn-job-talent" title="Search Talent Pool for this posting" onClick={() => navigate(`/talent-pool?posting=${p.id}`)}><Icon as={Sparkles} /></button>
                                                )}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            <JobPostingFormModal open={formOpen} editing={editing} lookups={data} fromRequest={fromRequest}
                onClose={() => setFormOpen(false)}
                onSaved={msg => { setFormOpen(false); void done(msg); }}
                onPreview={job => setPreview({ job, posting: null })} />

            {/* Preview: the public job page, exactly as applicants will see it. */}
            <Modal open={!!preview} onClose={() => setPreview(null)} size="lg" zIndex={2100} title={<><Icon as={Globe} /> Job Posting Preview</>}
                footer={<>
                    <button className="btn btn-outline" onClick={() => setPreview(null)}>Close Preview</button>
                    {preview?.posting?.status === 'Draft' && (
                        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => preview.posting && void act(preview.posting, 'publish')}>
                            <Icon as={Send} /> Publish
                        </button>
                    )}
                </>}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem', padding: '0.5rem 0.75rem', background: 'rgba(59,130,246,0.08)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border)', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    <Icon as={Info} style={{ color: 'var(--primary)' }} /> Preview Mode &mdash; this is how applicants will see the job posting on the careers page.
                </div>
                {preview && (
                    <JobPostingView job={preview.job} action={
                        <button type="button" className="jpv-apply-btn" aria-disabled="true" title="Apply Now works once the posting is published" onClick={e => e.preventDefault()}>
                            APPLY NOW
                        </button>
                    } />
                )}
            </Modal>

            {/* View: the posting's record and the applicants who applied through it. */}
            <Modal open={!!details} onClose={() => setDetails(null)} size="lg" title={<><Icon as={Briefcase} /> Job Posting Details</>}
                footer={details && <>
                    <button className="btn btn-outline" onClick={() => setDetails(null)}>Close</button>
                    {ACTIONS[details.posting.status].includes('preview') && (
                        <button type="button" className="btn btn-outline" onClick={() => void openPreview(details.posting)}><Icon as={Globe} /> Preview</button>
                    )}
                    {ACTIONS[details.posting.status].includes('edit') && (
                        <button type="button" className="btn btn-primary" onClick={() => openEdit(details.posting)}><Icon as={Pencil} /> Edit</button>
                    )}
                    {ACTIONS[details.posting.status].includes('close') && (
                        <button type="button" className="btn btn-primary" style={{ background: 'var(--warning)' }} disabled={busy} onClick={() => void act(details.posting, 'close')}><Icon as={Lock} /> Close</button>
                    )}
                    {ACTIONS[details.posting.status].includes('archive') && (
                        <button type="button" className="btn btn-primary" style={{ background: 'var(--danger)' }} disabled={busy} onClick={() => void act(details.posting, 'archive')}><Icon as={Archive} /> Archive</button>
                    )}
                    {ACTIONS[details.posting.status].includes('restore') && (
                        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void act(details.posting, 'restore')}><Icon as={ArchiveRestore} /> Restore as Draft</button>
                    )}
                </>}>
                {details && (() => {
                    const p = details.posting;
                    return (
                        <>
                            <div className="modal-section">
                                <h4 className="modal-section-title"><Icon as={Briefcase} /> {p.posting_no}</h4>
                                <div className="modal-info-grid">
                                    <InfoItem label="Job Title" full><strong>{p.title}</strong></InfoItem>
                                    <InfoItem label="Status"><StatusCell p={p} /></InfoItem>
                                    <InfoItem label="Accepting Applications">{p.accepting ? 'Yes' : 'No'}</InfoItem>
                                    <InfoItem label="Department">{p.department || 'Unassigned'}</InfoItem>
                                    <InfoItem label="Position">{p.position || '—'}</InfoItem>
                                    <InfoItem label="Employment Type">{p.employment_type || '—'}</InfoItem>
                                    <InfoItem label="Work Setup">{p.work_setup || '—'}</InfoItem>
                                    <InfoItem label="Location">{p.location || '—'}</InfoItem>
                                    <InfoItem label="Vacancies">{p.vacancies ?? '—'}{p.hired_count > 0 ? ` (${p.hired_count} hired)` : ''}</InfoItem>
                                    <InfoItem label="Application Opening Date">{p.opening_date ? phpMjY(p.opening_date) : '—'}</InfoItem>
                                    <InfoItem label="Application Deadline">{p.deadline ? phpMjY(p.deadline) : 'Open until closed'}</InfoItem>
                                    <InfoItem label="Created">{phpMjYgiA(p.created_at)}{p.created_by_name ? ` by ${p.created_by_name}` : ''}</InfoItem>
                                    <InfoItem label="Published">{p.published_at ? `${phpMjYgiA(p.published_at)}${p.published_by_name ? ` by ${p.published_by_name}` : ''}` : '—'}</InfoItem>
                                    <InfoItem label="Last Updated">{p.updated_at ? `${phpMjYgiA(p.updated_at)}${p.updated_by_name ? ` by ${p.updated_by_name}` : ''}` : '—'}</InfoItem>
                                    {p.closed_at && <InfoItem label="Closed">{phpMjYgiA(p.closed_at)}</InfoItem>}
                                    {p.archived_at && <InfoItem label="Archived">{phpMjYgiA(p.archived_at)}</InfoItem>}
                                </div>
                            </div>
                            <div className="modal-section" id="jpDetailsRequest">
                                <h4 className="modal-section-title"><Icon as={ClipboardCheck} /> Vacancy Request</h4>
                                {details.request ? (
                                    <div className="modal-info-grid">
                                        <InfoItem label="Request No.">{details.request.request_no} ({details.request.status})</InfoItem>
                                        <InfoItem label="Approved Vacancies">{details.request.vacancies} ({details.request.filled} filled)</InfoItem>
                                        <InfoItem label="Requested">{phpMjYgiA(details.request.created_at)}{details.request.requested_by_name ? ` by ${details.request.requested_by_name}` : ''}</InfoItem>
                                        <InfoItem label="Approved">{details.request.reviewed_at ? phpMjYgiA(details.request.reviewed_at) : '—'}{details.request.reviewed_by_name ? ` by ${details.request.reviewed_by_name}` : ''}</InfoItem>
                                        <InfoItem label="Reason for Hiring" full>{details.request.justification}</InfoItem>
                                    </div>
                                ) : (
                                    <p style={{ color: 'var(--text-secondary)' }}>{details.applicants === null ? 'Loading…' : 'Created before vacancy requests were introduced (no request linked).'}</p>
                                )}
                            </div>
                            <div className="modal-section">
                                <h4 className="modal-section-title"><Icon as={Users} /> Applicants ({p.applicant_count})</h4>
                                {details.applicants === null ? (
                                    <p style={{ color: 'var(--text-secondary)' }}>Loading applicants…</p>
                                ) : !details.applicants.length ? (
                                    <p style={{ color: 'var(--text-secondary)' }}>No one has applied through this job posting yet.</p>
                                ) : (
                                    <table className="data-table">
                                        <thead><tr><SortTh view={postingApplicants} k="no">Applicant ID</SortTh><SortTh view={postingApplicants} k="name">Name</SortTh><SortTh view={postingApplicants} k="application">Application</SortTh><SortTh view={postingApplicants} k="applied">Applied</SortTh><SortTh view={postingApplicants} k="stage">Stage</SortTh></tr></thead>
                                        <tbody>
                                            {postingApplicants.rows.map(a => (
                                                <tr key={a.id}>
                                                    <td><strong>{applicantNo(a)}</strong></td>
                                                    <td>{a.full_name}</td>
                                                    <td>{a.source_application_no ?? '—'}</td>
                                                    <td>{datePart(a.applied_at)}</td>
                                                    <td><Badge variant={STAGE_BADGE[a.stage] ?? 'badge-info'}>{a.stage === 'Final Interview' && a.status === 'Offer' ? 'Job Offer' : a.stage}</Badge></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </>
                    );
                })()}
            </Modal>
        </Page>
    );
}
