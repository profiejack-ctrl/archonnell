import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ban, Briefcase, CheckCircle2, ClipboardPlus, Clock, Eye, FilePlus2, Info, Send, XCircle } from 'lucide-react';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import { Badge, EmptyRow, InfoItem, Page, PageHeader, PageState, SearchBox, StatCard, StatsGrid } from '../../components/ui';
import { usePageData } from '../../hooks/usePageData';
import { vacancyRequestService, type VacancyRequestForm } from '../../services/vacancyRequestService';
import { ArchonAlert, confirmDialog, esc, promptText } from '../../utils/alerts';
import { isoDateFromToday, phpFjY, phpMjY, phpMjYgiA } from '../../utils/format';
import { rejectionReasonError } from '../applicants/ApplicantActions';
import { ClearFilters, DateRangeFilter, FilterCount, FilterSelect, SortTh, distinct, inDateRange, is, matchesText, useFilters, useTableView } from '../../components/TableControls';
import type { VacancyRequest, VacancyRequestStatus } from '../../types';

const STATUS_BADGE: Record<VacancyRequestStatus, string> = {
    Pending: 'badge-warning', Approved: 'badge-success', Rejected: 'badge-danger', Cancelled: 'badge-secondary',
};

const req = <span style={{ color: 'var(--danger)' }}>*</span>;
const hint = { fontSize: '0.75rem', color: 'var(--text-muted)' } as const;

/** Same checks as the server (vr_create); '' when the form can be submitted. */
function formError(f: VacancyRequestForm): string {
    if (!f.position_id) return 'Please select the requested position.';
    if (!/^\d+$/.test(f.vacancies) || +f.vacancies < 1 || +f.vacancies > 99) return 'Number of Employees Needed must be a whole number from 1 to 99.';
    if (!f.employment_type) return 'Please select the employment type.';
    if (!f.requested_date) return 'Please select the date the employees are needed.';
    if (f.requested_date < isoDateFromToday()) return 'The requested date cannot be in the past.';
    if (f.justification.replace(/\s+/g, ' ').trim().length < 20) return 'Please explain the reason for hiring in at least 20 characters.';
    if (!f.required_skills.trim()) return 'Required Skills are required.';
    if (!f.qualifications.trim()) return 'Required Qualifications are required.';
    if ([f.justification, f.required_skills, f.qualifications, f.notes].some(v => /[<>]/.test(v))) return 'Please do not use < or > characters.';
    return '';
}

/** Where the request is in the workflow, for the list. */
function postingCell(r: VacancyRequest) {
    if (r.job_posting_no) {
        return <>{r.job_posting_no} <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>({r.job_posting_status})</span></>;
    }
    return r.status === 'Approved' ? <span style={{ color: 'var(--text-secondary)' }}>Awaiting job posting</span> : '—';
}

/**
 * Vacancy Requests: HR Managers, Admins and Super Admins request employees for their own
 * department, Super Admins approve or reject, and Recruitment Management creates the
 * job posting of an approved request (Recruitment Management > Job Posting).
 */
export default function VacancyRequestsPage() {
    const { data, loading, error, retry, reload } = usePageData(vacancyRequestService.page);
    const navigate = useNavigate();
    const filters = useFilters({ search: '', status: '', department: '', position: '', type: '', from: '', to: '' });
    const f = filters.values;
    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState<VacancyRequestForm | null>(null);
    const [viewing, setViewing] = useState<VacancyRequest | null>(null);
    const [busy, setBusy] = useState(false);

    const list = useMemo(() => data?.requests ?? [], [data]);
    const view = useTableView(list, r => is(f.status, r.status) && is(f.department, r.department) && is(f.position, r.position) && is(f.type, r.employment_type)
        && inDateRange(r.requested_date, f.from, f.to) && matchesText(f.search, r.request_no, r.department, r.position, r.requested_by_name, r.status, r.job_posting_no), {
        no: r => r.request_no, department: r => r.department, position: r => r.position, vacancies: r => r.vacancies, type: r => r.employment_type,
        needed: r => r.requested_date, by: r => r.requested_by_name, status: r => r.status, posting: r => r.job_posting_no,
    });
    const rows = view.rows;
    const count = (s: VacancyRequestStatus) => list.filter(r => r.status === s).length;

    const manager = data?.manager ?? null;
    const canCancel = (r: VacancyRequest) => (!!data?.is_admin || manager?.department_id === r.department_id)
        && (r.status === 'Pending' || (r.status === 'Approved' && !r.job_posting_id));
    const canPost = (r: VacancyRequest) => !!data?.can_recruit && r.status === 'Approved' && !r.job_posting_id;

    const openForm = () => {
        if (!manager) return;
        setForm({
            department_id: manager.department_id, position_id: '', vacancies: '1', employment_type: '', justification: '',
            required_skills: '', qualifications: '', requested_date: '', notes: '',
        });
        setFormOpen(true);
    };

    const done = async (message: string) => {
        setViewing(null);
        await ArchonAlert.success(message, { timer: 1800 });
        await reload();
    };

    const submit = async () => {
        if (!form) return;
        const invalid = formError(form);
        if (invalid) { await ArchonAlert.warning(invalid, { title: 'Missing Information' }); return; }
        const position = data?.positions.find(p => String(p.id) === form.position_id)?.title ?? '';
        const ok = await confirmDialog({
            title: 'Submit Vacancy Request',
            paragraphs: [`Request ${form.vacancies} ${position} for ${manager?.department}? It will be sent to the Super Admin for approval.`],
            icon: 'question', confirmText: 'Submit',
        });
        if (!ok) return;
        setBusy(true);
        try {
            const res = await vacancyRequestService.create(form);
            setFormOpen(false);
            await done(res.message);
        } catch (err) {
            await ArchonAlert.error(err instanceof Error ? err.message : 'The request could not be submitted.');
        } finally {
            setBusy(false);
        }
    };

    const approve = async (r: VacancyRequest) => {
        const ok = await confirmDialog({
            title: 'Approve Vacancy Request',
            paragraphs: [`Approve ${r.request_no}: ${r.vacancies} ${r.position} for ${r.department}? Recruitment Management will be notified to create the job posting.`],
            icon: 'question', confirmText: 'Approve',
        });
        if (!ok) return;
        setBusy(true);
        try {
            await done((await vacancyRequestService.approve(r.id)).message);
        } catch (err) {
            await ArchonAlert.error(err instanceof Error ? err.message : 'The request could not be approved.');
        } finally {
            setBusy(false);
        }
    };

    const reject = async (r: VacancyRequest) => {
        const reason = await promptText({
            title: 'Reject Vacancy Request',
            html: `<p>Reject <strong>${esc(r.request_no)}</strong>: ${r.vacancies} ${esc(r.position)} for ${esc(r.department)}?</p><p>The requester will see this reason.</p>`,
            label: 'Reason for Rejection', placeholder: 'e.g., The current headcount budget does not allow additional hires this quarter.',
            confirmText: 'Reject Request', danger: true, validate: rejectionReasonError,
        });
        if (reason === null) return;
        setBusy(true);
        try {
            await done((await vacancyRequestService.reject(r.id, reason)).message);
        } catch (err) {
            await ArchonAlert.error(err instanceof Error ? err.message : 'The request could not be rejected.');
        } finally {
            setBusy(false);
        }
    };

    const cancel = async (r: VacancyRequest) => {
        const ok = await confirmDialog({
            title: 'Cancel Vacancy Request', paragraphs: [`Cancel ${r.request_no} (${r.vacancies} ${r.position})? It can no longer be approved or posted.`],
            icon: 'warning', confirmText: 'Cancel Request', danger: true,
        });
        if (!ok) return;
        setBusy(true);
        try {
            await done((await vacancyRequestService.cancel(r.id)).message);
        } catch (err) {
            await ArchonAlert.error(err instanceof Error ? err.message : 'The request could not be cancelled.');
        } finally {
            setBusy(false);
        }
    };

    const createPosting = (r: VacancyRequest) => navigate(`/job-postings?request=${r.id}`);

    const actions = (r: VacancyRequest) => (
        <>
            <button className="table-action-btn btn-vr-view" title="View" onClick={() => setViewing(r)}><Icon as={Eye} /></button>
            {data?.is_admin && r.status === 'Pending' && <>
                <button className="table-action-btn btn-vr-approve" title="Approve" disabled={busy} style={{ color: 'var(--success)' }} onClick={() => void approve(r)}><Icon as={CheckCircle2} /></button>
                <button className="table-action-btn btn-vr-reject" title="Reject" disabled={busy} style={{ color: 'var(--danger)' }} onClick={() => void reject(r)}><Icon as={XCircle} /></button>
            </>}
            {canPost(r) && <button className="table-action-btn btn-vr-post" title="Create Job Posting" onClick={() => createPosting(r)}><Icon as={FilePlus2} /></button>}
            {canCancel(r) && <button className="table-action-btn btn-vr-cancel" title="Cancel Request" disabled={busy} onClick={() => void cancel(r)}><Icon as={Ban} /></button>}
        </>
    );

    const allowed = !!data && (!!manager || data.is_admin || data.can_recruit);
    const set = (k: keyof VacancyRequestForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        setForm(f => (f ? { ...f, [k]: e.target.value } : f));

    return (
        <Page id="vacancy-requests">
            <PageHeader title="Vacancy Requests" subtitle="HR Managers, Admins and Super Admins request employees for their department; approved requests become job postings" />
            <PageState loading={loading} error={error} onRetry={retry} />
            {data && !allowed && (
                <div className="card hover-card"><div className="card-body" style={{ color: 'var(--text-secondary)' }}>
                    <Icon as={Info} /> Only an HR Manager, Admin or Super Admin can request employees, for their own department. Requests are approved by a Super Admin.
                </div></div>
            )}
            {data && allowed && (
                <>
                    <StatsGrid>
                        <StatCard icon={Clock} gradient={['#fbbf24', '#f59e0b']} value={count('Pending')} label="Pending Approval" />
                        <StatCard icon={CheckCircle2} gradient={['#34d399', '#10b981']} value={count('Approved')} label="Approved" />
                        <StatCard icon={Briefcase} gradient={['#60a5fa', '#3b82f6']} value={list.filter(r => r.status === 'Approved' && !r.job_posting_id).length} label="Awaiting Job Posting" />
                        <StatCard icon={XCircle} gradient={['#f87171', '#ef4444']} value={count('Rejected')} label="Rejected" />
                    </StatsGrid>
                    <div className="page-toolbar">
                        <div className="toolbar-left">
                            {manager && <button className="btn btn-primary" id="vrBtnCreate" onClick={openForm}><Icon as={ClipboardPlus} /> New Vacancy Request</button>}
                            <SearchBox value={f.search} onChange={filters.set('search')} placeholder="Search request no., position, requester..." />
                            <select className="form-select" id="vrStatusFilter" aria-label="Status" value={f.status} onChange={e => filters.set('status')(e.target.value)}>
                                <option value="">All Statuses</option>
                                <option value="Pending">Pending</option>
                                <option value="Approved">Approved</option>
                                <option value="Rejected">Rejected</option>
                                <option value="Cancelled">Cancelled</option>
                            </select>
                            <FilterSelect id="vrDeptFilter" label="Departments" value={f.department} onChange={filters.set('department')} options={distinct(list, r => r.department)} />
                            <FilterSelect id="vrPositionFilter" label="Positions" value={f.position} onChange={filters.set('position')} options={distinct(list, r => r.position)} />
                            <FilterSelect id="vrTypeFilter" label="Employment Types" value={f.type} onChange={filters.set('type')} options={distinct(list, r => r.employment_type)} />
                            <DateRangeFilter id="vrNeeded" label="Needed By" from={f.from} to={f.to} onFrom={filters.set('from')} onTo={filters.set('to')} />
                            <ClearFilters id="vrClear" active={filters.active} onClear={filters.clear} />
                            <FilterCount shown={rows.length} total={list.length} />
                        </div>
                    </div>
                    {manager && (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem' }}>
                            <Icon as={Info} /> You can request employees for <strong>{manager.department}</strong>, your department.
                        </p>
                    )}
                    <div className="card hover-card">
                        <div className="card-body no-padding">
                            <table className="data-table" id="vacancyRequestTable">
                                <thead>
                                    <tr>
                                        <SortTh view={view} k="no">Request No.</SortTh><SortTh view={view} k="department">Department</SortTh><SortTh view={view} k="position">Position</SortTh><SortTh view={view} k="vacancies">Vacancies</SortTh><SortTh view={view} k="type">Employment Type</SortTh>
                                        <SortTh view={view} k="needed">Needed By</SortTh><SortTh view={view} k="by">Requested By</SortTh><SortTh view={view} k="status">Status</SortTh><SortTh view={view} k="posting">Job Posting</SortTh><th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {!rows.length ? (
                                        <EmptyRow colSpan={10}>{list.length ? 'No records found. Try other filters or clear them.' : (manager ? <>No vacancy requests yet. Click <strong>New Vacancy Request</strong> when your department needs employees.</> : 'No vacancy requests yet.')}</EmptyRow>
                                    ) : rows.map(r => (
                                        <tr className="hover-row" key={r.id} data-id={r.id} data-status={r.status}>
                                            <td><strong>{r.request_no}</strong></td>
                                            <td>{r.department}</td>
                                            <td>{r.position}</td>
                                            <td>{r.status === 'Approved' || r.filled > 0 ? `${r.filled} / ${r.vacancies} filled` : r.vacancies}</td>
                                            <td>{r.employment_type}</td>
                                            <td>{phpMjY(r.requested_date)}</td>
                                            <td>{r.requested_by_name ?? '—'}<div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{phpMjY(r.created_at)}</div></td>
                                            <td><Badge variant={STATUS_BADGE[r.status]}>{r.status}</Badge></td>
                                            <td>{postingCell(r)}</td>
                                            <td style={{ whiteSpace: 'nowrap' }}>{actions(r)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* New request (HR Manager / Admin / Super Admin of the department) */}
            <Modal open={formOpen} onClose={() => setFormOpen(false)} size="lg" title={<><Icon as={ClipboardPlus} /> New Vacancy Request</>}
                footer={<>
                    <button className="btn btn-outline" onClick={() => setFormOpen(false)}>Cancel</button>
                    <button type="button" className="btn btn-primary" id="vrBtnSubmit" disabled={busy} onClick={() => void submit()}><Icon as={Send} /> Submit for Approval</button>
                </>}>
                {form && (
                    <form id="vacancyRequestForm" className="modal-form-grid" onSubmit={e => e.preventDefault()}>
                        <div className="form-group">
                            <label htmlFor="vrDepartment">Department</label>
                            <input type="text" className="form-input" id="vrDepartment" readOnly value={manager?.department ?? ''} style={{ background: 'var(--bg-secondary)' }} />
                            <span style={hint}>You can request employees for your own department only.</span>
                        </div>
                        <div className="form-group">
                            <label htmlFor="vrPosition">Requested Position / Designation {req}</label>
                            <select className="form-input" id="vrPosition" value={form.position_id} onChange={set('position_id')}>
                                <option value="">Select position&hellip;</option>
                                {data?.positions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="vrVacancies">Number of Employees Needed {req}</label>
                            <input type="number" className="form-input" id="vrVacancies" min={1} max={99} step={1} value={form.vacancies} onChange={set('vacancies')} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="vrEmploymentType">Employment Type {req}</label>
                            <select className="form-input" id="vrEmploymentType" value={form.employment_type} onChange={set('employment_type')}>
                                <option value="">Select employment type&hellip;</option>
                                {data?.employment_types.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="vrRequestedDate">Needed By {req}</label>
                            <input type="date" className="form-input" id="vrRequestedDate" min={isoDateFromToday()} value={form.requested_date} onChange={set('requested_date')} />
                        </div>
                        <div className="form-group full-width">
                            <label htmlFor="vrJustification">Reason for Hiring / Hiring Justification {req}</label>
                            <textarea className="form-input" id="vrJustification" style={{ minHeight: 90, resize: 'vertical' }}
                                placeholder="Why the department needs these employees" value={form.justification} onChange={set('justification')} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="vrSkills">Required Skills {req}</label>
                            <textarea className="form-input" id="vrSkills" style={{ minHeight: 70, resize: 'vertical' }}
                                placeholder="Comma-separated, e.g., Negotiation, Customer Service" value={form.required_skills} onChange={set('required_skills')} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="vrQualifications">Required Qualifications {req}</label>
                            <textarea className="form-input" id="vrQualifications" style={{ minHeight: 70, resize: 'vertical' }}
                                placeholder="One per line" value={form.qualifications} onChange={set('qualifications')} />
                        </div>
                        <div className="form-group full-width">
                            <label htmlFor="vrNotes">Additional Notes</label>
                            <textarea className="form-input" id="vrNotes" style={{ minHeight: 60, resize: 'vertical' }} value={form.notes} onChange={set('notes')} />
                        </div>
                    </form>
                )}
            </Modal>

            {/* View (and review) a request */}
            <Modal open={!!viewing} onClose={() => setViewing(null)} size="lg" title={<><Icon as={ClipboardPlus} /> Vacancy Request {viewing?.request_no}</>}
                footer={viewing && <>
                    <button className="btn btn-outline" onClick={() => setViewing(null)}>Close</button>
                    {canCancel(viewing) && <button type="button" className="btn btn-outline" disabled={busy} onClick={() => void cancel(viewing)}><Icon as={Ban} /> Cancel Request</button>}
                    {data?.is_admin && viewing.status === 'Pending' && <>
                        <button type="button" className="btn btn-primary" id="vrViewReject" style={{ background: 'var(--danger)' }} disabled={busy} onClick={() => void reject(viewing)}><Icon as={XCircle} /> Reject</button>
                        <button type="button" className="btn btn-primary" id="vrViewApprove" style={{ background: 'var(--success)' }} disabled={busy} onClick={() => void approve(viewing)}><Icon as={CheckCircle2} /> Approve</button>
                    </>}
                    {canPost(viewing) && <button type="button" className="btn btn-primary" id="vrViewPost" onClick={() => createPosting(viewing)}><Icon as={FilePlus2} /> Create Job Posting</button>}
                </>}>
                {viewing && (
                    <>
                        <div className="modal-section">
                            <h4 className="modal-section-title"><Icon as={Briefcase} /> Request</h4>
                            <div className="modal-info-grid">
                                <InfoItem label="Status"><Badge variant={STATUS_BADGE[viewing.status]}>{viewing.status}</Badge></InfoItem>
                                <InfoItem label="Request No.">{viewing.request_no}</InfoItem>
                                <InfoItem label="Department">{viewing.department}</InfoItem>
                                <InfoItem label="Requested Position">{viewing.position}</InfoItem>
                                <InfoItem label="Number of Employees Needed">{viewing.vacancies}{viewing.status === 'Approved' ? ` (${viewing.filled} filled)` : ''}</InfoItem>
                                <InfoItem label="Employment Type">{viewing.employment_type}</InfoItem>
                                <InfoItem label="Needed By">{phpFjY(viewing.requested_date)}</InfoItem>
                                <InfoItem label="Requested">{phpMjYgiA(viewing.created_at)}{viewing.requested_by_name ? ` by ${viewing.requested_by_name}` : ''}</InfoItem>
                                <InfoItem label="Reason for Hiring" full><span style={{ whiteSpace: 'pre-line' }}>{viewing.justification}</span></InfoItem>
                                <InfoItem label="Required Skills" full>{viewing.required_skills}</InfoItem>
                                <InfoItem label="Required Qualifications" full><span style={{ whiteSpace: 'pre-line' }}>{viewing.qualifications}</span></InfoItem>
                                {viewing.notes && <InfoItem label="Additional Notes" full><span style={{ whiteSpace: 'pre-line' }}>{viewing.notes}</span></InfoItem>}
                            </div>
                        </div>
                        {(viewing.reviewed_at || viewing.cancelled_at || viewing.job_posting_no) && (
                            <div className="modal-section">
                                <h4 className="modal-section-title"><Icon as={CheckCircle2} /> Review &amp; Job Posting</h4>
                                <div className="modal-info-grid">
                                    {viewing.reviewed_at && <InfoItem label={viewing.status === 'Rejected' ? 'Rejected' : 'Reviewed'}>{phpMjYgiA(viewing.reviewed_at)}{viewing.reviewed_by_name ? ` by ${viewing.reviewed_by_name}` : ''}</InfoItem>}
                                    {viewing.rejection_reason && <InfoItem label="Reason for Rejection" full>{viewing.rejection_reason}</InfoItem>}
                                    {viewing.cancelled_at && <InfoItem label="Cancelled">{phpMjYgiA(viewing.cancelled_at)}</InfoItem>}
                                    {viewing.job_posting_no && <InfoItem label="Job Posting">{viewing.job_posting_no} ({viewing.job_posting_status})</InfoItem>}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </Modal>
        </Page>
    );
}
