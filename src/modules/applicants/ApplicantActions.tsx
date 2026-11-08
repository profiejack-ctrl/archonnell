import { useEffect, useState } from 'react';
import { Ban, Briefcase, CalendarClock, Eye, FileText, History, Lock, MessageSquare, User, Users, XCircle } from 'lucide-react';
import Modal from '../../components/Modal';
import Icon from '../../components/Icon';
import { Badge, EmptyRow, InfoItem, PersonCell } from '../../components/ui';
import { ClearFilters, DateRangeFilter, FilterSelect, SortTh, distinct, inDateRange, is, matchesText, useTableView, type FilterState } from '../../components/TableControls';
import { applicantService, type RejectionStage } from '../../services/applicantService';
import { ArchonAlert, esc, formDialog } from '../../utils/alerts';
import { HR_FEEDBACK_FIELDS, REJECTION_CATEGORIES, talentBadge } from '../../services/talentService';
import { ApplicationHistoryModal, FeedbackModal } from './TalentModals';
import { applicantNo, datePart, phpFjY, phpMjYgiA, phpSchedule, strimwidth } from '../../utils/format';
import ResumeModal, { type ResumeTarget } from './ResumeModal';
import type { Applicant, ApplicantDetail } from '../../types';

/*
 * View + Reject for Applicant Validation, Pre-Interview and Final Interview.
 * The applicant's name is only ever displayed (never an input): it comes from
 * the applicant record, and the server and database refuse any change to it.
 */

const STAGE_LABEL: Record<RejectionStage, string> = {
    Validation: 'Applicant Validation', 'Pre-Interview': 'Pre-Interview', 'Final Interview': 'Final Interview',
};

/** Same rules as the server (wf_rejection_reason_error); '' when the reason can be saved. */
export function rejectionReasonError(value: string): string {
    const r = value.replace(/\s+/g, ' ').trim();
    if (!r) return 'Please enter the reason for rejection.';
    if (r.length < 10) return 'The reason for rejection is too short. Please use at least 10 characters.';
    if (r.length > 500) return 'The reason for rejection must be 500 characters or fewer.';
    if (/[<>]/.test(r)) return 'The reason for rejection cannot contain < or > characters.';
    if ((r.match(/\p{L}{2,}/gu) ?? []).length < 2) return 'Please describe the reason for rejection in at least two words.';
    if (new Set(r.toLowerCase().replace(/[^\p{L}]/gu, '')).size < 5) return 'Please enter a meaningful reason for rejection.';
    return '';
}

/**
 * Reject: SweetAlert2 confirmation with a required reason, then save. The
 * applicant is e-mailed after the rejection is saved; a mail failure is reported
 * but never undoes it. Resolves true when the application was rejected.
 */
export async function rejectApplicant(a: { id: number; full_name: string; applicant_no: string | null; position: string }, stage: RejectionStage): Promise<boolean> {
    const area = (id: string, label: string, ph = '') =>
        `<label for="${id}" style="display:block;text-align:left;font-size:0.8rem;font-weight:600;margin:0.6rem 0 0.25rem;">${label}</label>`
        + `<textarea id="${id}" class="form-input" maxlength="2000" rows="2" style="resize:vertical;" placeholder="${esc(ph)}"></textarea>`;
    const form = await formDialog<Record<string, string | boolean>>({
        title: 'Reject Applicant',
        icon: 'warning',
        danger: true,
        confirmText: 'Reject Applicant',
        html: `<p>You are rejecting <strong>${esc(a.full_name)}</strong> (${esc(applicantNo(a))}) for <strong>${esc(a.position)}</strong> at <strong>${esc(STAGE_LABEL[stage])}</strong>.</p>`
            + '<div style="text-align:left;">'
            + '<label for="rjCategory" style="display:block;font-size:0.8rem;font-weight:600;margin:0.6rem 0 0.25rem;">Rejection Reason <span style="color:#ef4444">*</span></label>'
            + `<select id="rjCategory" class="form-input"><option value="">Select a reason&hellip;</option>${REJECTION_CATEGORIES.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select>`
            + '<label for="rjReason" style="display:block;font-size:0.8rem;font-weight:600;margin:0.6rem 0 0.25rem;">Details for the applicant <span style="color:#ef4444">*</span></label>'
            + '<textarea id="rjReason" class="form-input" maxlength="500" rows="3" style="resize:vertical;" placeholder="e.g., The required sales experience for this position was not met."></textarea>'
            + '<div style="font-size:0.75rem;color:#6b7280;margin-top:0.2rem;">The applicant sees this in the rejection e-mail and the Applicant Portal. For "Other", describe the specific reason.</div>'
            + '<label style="display:flex;gap:0.5rem;align-items:flex-start;margin-top:0.9rem;font-size:0.85rem;"><input type="checkbox" id="rjFuture" style="margin-top:3px;">'
            + '<span><strong>Consider for Future Opportunities</strong><br><span style="color:#6b7280;font-size:0.78rem;">The applicant is asked by e-mail whether we may contact them about future openings. '
            + 'They join the Talent Pool only if they answer Yes.</span></span></label>'
            + '<details style="margin-top:0.9rem;"><summary style="cursor:pointer;font-weight:600;font-size:0.85rem;">Internal HR Feedback (optional, never shown to the applicant)</summary>'
            + HR_FEEDBACK_FIELDS.map(([k, l]) => area('rjHr_' + k, l)).join('')
            + '</details></div>',
        collect: popup => {
            const val = (id: string) => (popup.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('#' + id)?.value ?? '').trim();
            const category = val('rjCategory');
            if (!category) return 'Please choose the rejection reason.';
            const reasonErr = rejectionReasonError(val('rjReason'));
            if (reasonErr) return category === 'Other' && !val('rjReason') ? 'For "Other", please describe the specific reason.' : reasonErr;
            const out: Record<string, string | boolean> = { category, reason: val('rjReason'), invite_future: !!popup.querySelector<HTMLInputElement>('#rjFuture')?.checked };
            for (const [k, l] of HR_FEEDBACK_FIELDS) {
                const v = val('rjHr_' + k);
                if (/[<>]/.test(v)) return `${l} cannot contain < or > characters.`;
                out['hr_' + k] = v;
            }
            return out;
        },
    });
    if (form === null) return false;
    try {
        const { reason, ...extra } = form;
        const res = await applicantService.reject(a.id, stage, String(reason), extra);
        const name = a.full_name || 'The applicant';
        if (res.email_sent) {
            await ArchonAlert.success(`${name} has been rejected at ${res.rejection_stage}. The applicant has been notified by e-mail`
                + (res.future_invited ? ' and asked whether we may contact them about future opportunities.' : '.'));
        } else {
            await ArchonAlert.warning(`${name} has been rejected at ${res.rejection_stage}, but the notification e-mail could not be sent${res.email_error ? `: ${res.email_error}` : '.'} The rejection is saved.`,
                { title: 'Rejected - E-mail Not Sent' });
        }
        return true;
    } catch (err) {
        await ArchonAlert.error('Could not reject: ' + (err instanceof Error ? err.message : ''));
        return false;
    }
}

/** "Active" / "Rejected at this stage" list switch for the stage pages. */
export function ListModeSelect({ value, onChange, rejectedCount, id }: {
    value: 'active' | 'rejected'; onChange: (v: 'active' | 'rejected') => void; rejectedCount: number; id: string;
}) {
    return (
        <select className="form-select" id={id} value={value} onChange={e => onChange(e.target.value as 'active' | 'rejected')}>
            <option value="active">Active Applicants</option>
            <option value="rejected">Rejected at this Stage ({rejectedCount})</option>
        </select>
    );
}

/* ------------------------------------------------------------------
 * Filters shared by the applicant / interview tables (search, position,
 * department, status, date range); see components/TableControls.
 * ------------------------------------------------------------------ */
export const APPLICANT_FILTERS = { search: '', position: '', department: '', status: '', from: '', to: '' };
export type ApplicantFilterValues = typeof APPLICANT_FILTERS;

/** The applicant's department: the position's, else the job posting's. */
export function applicantDepartment(a: Applicant): string {
    return a.department || (a.job_posting_department && a.job_posting_department !== 'Unassigned' ? a.job_posting_department : '') || '';
}

/**
 * Applicant matches the filters. `date` is the value the date range applies to
 * (applied / interview / rejected date); `status` the status the table shows.
 */
export function applicantMatches(a: Applicant, f: ApplicantFilterValues, date: string | null | undefined, status: string,
    ...searchCells: (string | null | undefined)[]): boolean {
    return matchesText(f.search, applicantNo(a), a.full_name, a.position, a.job_posting_no, a.email, ...searchCells)
        && is(f.position, a.position) && is(f.department, applicantDepartment(a)) && is(f.status, status)
        && inDateRange(date, f.from, f.to);
}

/** Position / Department / Status / date range / Clear Filters for an applicant table. */
export function ApplicantFilterControls({ idPrefix, rows, filters, dateLabel, statuses, statusLabel = 'Statuses' }: {
    idPrefix: string;
    rows: Applicant[];
    filters: FilterState<ApplicantFilterValues>;
    dateLabel: string;
    /** Status dropdown options; omit when the table has a single status. */
    statuses?: string[];
    statusLabel?: string;
}) {
    const { values: f, set, clear, active } = filters;
    return (
        <>
            <FilterSelect id={`${idPrefix}Position`} label="Positions" value={f.position} onChange={set('position')} options={distinct(rows, a => a.position)} />
            <FilterSelect id={`${idPrefix}Department`} label="Departments" value={f.department} onChange={set('department')} options={distinct(rows, applicantDepartment)} />
            {statuses && statuses.length > 1 && (
                <FilterSelect id={`${idPrefix}Status`} label={statusLabel} value={f.status} onChange={set('status')} options={statuses} />
            )}
            <DateRangeFilter id={`${idPrefix}Date`} label={dateLabel} from={f.from} to={f.to} onFrom={set('from')} onTo={set('to')} />
            <ClearFilters id={`${idPrefix}Clear`} active={active} onClear={clear} />
        </>
    );
}

/** Applicants rejected at this stage: kept for the record, View only (no second rejection). */
export function RejectedApplicantsTable({ rows, search, onView, id }: {
    rows: Applicant[]; search: (a: Applicant) => boolean; onView: (a: Applicant) => void; id: string;
}) {
    const view = useTableView(rows, search, {
        no: a => applicantNo(a), name: a => a.full_name, position: a => a.position, rejected: a => a.rejected_at,
        reason: a => a.rejection_reason, by: a => a.rejected_by_name,
    }, { key: 'rejected', dir: 'desc' });
    const shown = view.rows;
    return (
        <div className="card hover-card">
            <div className="card-body no-padding">
                <table className="data-table" id={id}>
                    <thead>
                        <tr>
                            <SortTh view={view} k="no">Applicant ID</SortTh><SortTh view={view} k="name">Name</SortTh><SortTh view={view} k="position">Position</SortTh>
                            <SortTh view={view} k="rejected">Rejected On</SortTh><SortTh view={view} k="reason">Reason</SortTh><SortTh view={view} k="by">Rejected By</SortTh>
                            <th>Status</th><th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!shown.length ? (
                            <EmptyRow colSpan={8}>{rows.length ? 'No records found. Try other filters or clear them.' : 'No applicants have been rejected at this stage.'}</EmptyRow>
                        ) : shown.map((a, i) => (
                            <tr className="hover-row" key={a.id} data-applicant-id={a.id}>
                                <td><strong>{applicantNo(a)}</strong></td>
                                <td><PersonCell index={i} name={a.full_name} /></td>
                                <td>{a.position}{a.job_posting_no && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{a.job_posting_no}</div>}</td>
                                <td>{a.rejected_at ? datePart(a.rejected_at) : '—'}</td>
                                <td style={{ maxWidth: 260 }} title={a.rejection_reason ?? ''}>{strimwidth(a.rejection_reason, 70) || '—'}</td>
                                <td>{a.rejected_by_name ?? '—'}</td>
                                <td><Badge variant="badge-danger">Rejected</Badge></td>
                                <td>
                                    <button className="btn btn-sm btn-outline btn-view-applicant" title="View" onClick={() => onView(a)}>
                                        <Icon as={Eye} /> View
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

const dash = (v: string | null | undefined) => (v && String(v).trim() ? v : '—');

/** One interview's details (pre-interview or final interview). */
function InterviewItems({ title, at, type, location, interviewer }: {
    title: string; at: string | null; type: string | null; location: string | null; interviewer: string | null;
}) {
    const online = type === 'Online';
    return (
        <>
            <InfoItem label={`${title} Date`}>{at ? phpFjY(at) : 'To be scheduled'}</InfoItem>
            <InfoItem label={`${title} Time`}>{at ? phpSchedule(at).split(' · ')[1] : '—'}</InfoItem>
            <InfoItem label="Interview Type">{type === 'Face-to-Face' ? 'Face to Face' : dash(type)}</InfoItem>
            <InfoItem label="Interviewer">{dash(interviewer)}</InfoItem>
            <InfoItem label={online ? 'Meeting Link' : 'Location'} full>
                {online && location && /^https?:\/\//i.test(location)
                    ? <a href={location} target="_blank" rel="noopener noreferrer" style={{ wordBreak: 'break-all' }}>{location}</a>
                    : dash(location)}
            </InfoItem>
        </>
    );
}

/**
 * View: the applicant exactly as recorded (name read-only), the Job Posting,
 * interviews, rejection details and recruitment history, with View Resume and,
 * while the application is still at this page's stage, Reject.
 */
export function ApplicantViewModal({ applicantId, stage, onClose, onRejected }: {
    applicantId: number | null; stage: RejectionStage; onClose: () => void; onRejected: () => void;
}) {
    const [detail, setDetail] = useState<ApplicantDetail | null>(null);
    const [error, setError] = useState('');
    const [resume, setResume] = useState<ResumeTarget | null>(null);
    const [busy, setBusy] = useState(false);
    const [historyOf, setHistoryOf] = useState<number | null>(null);
    const [feedbackOf, setFeedbackOf] = useState<number | null>(null);

    useEffect(() => {
        if (!applicantId) return;
        let cancelled = false;
        setDetail(null);
        setError('');
        applicantService.detail(applicantId)
            .then(d => { if (!cancelled) setDetail(d); })
            .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the applicant.'); });
        return () => { cancelled = true; };
    }, [applicantId]);

    const a = detail?.applicant;
    const jp = detail?.job_posting;
    const rj = detail?.rejection;
    const canReject = !!a && a.stage === stage;

    const reject = async () => {
        if (!a) return;
        setBusy(true);
        const done = await rejectApplicant(a, stage);
        setBusy(false);
        if (done) { onClose(); onRejected(); }
    };

    const openResume = () => a && setResume({
        dbId: a.id, applicantNo: applicantNo(a), name: a.full_name, position: a.position, email: a.email ?? '', resumePath: a.resume_path ?? '',
    });

    return (
        <>
            <Modal open={!!applicantId} onClose={onClose} size="lg" titleTag="div" title={<><Icon as={User} /> Applicant Details</>}
                footer={<>
                    {detail && !detail.resume_available && <span style={{ marginRight: 'auto', fontSize: '0.85rem', color: 'var(--text-muted)' }} id="applicantResumeUnavailable">Resume not available.</span>}
                    <button className="btn btn-outline" onClick={onClose}>Close</button>
                    {a && <button type="button" className="btn btn-outline" id="applicantViewHistoryBtn" onClick={() => setHistoryOf(a.id)}><Icon as={History} /> Application History</button>}
                    {a && <button type="button" className="btn btn-outline" id="applicantViewFeedbackBtn" onClick={() => setFeedbackOf(a.id)}><Icon as={MessageSquare} /> Feedback</button>}
                    <button type="button" className="btn btn-outline" id="applicantViewResume" disabled={!detail?.resume_available} onClick={openResume}>
                        <Icon as={FileText} /> View Resume
                    </button>
                    {canReject && (
                        <button type="button" className="btn btn-primary" id="applicantViewReject" style={{ background: 'var(--danger)' }} disabled={busy} onClick={() => void reject()}>
                            <Icon as={Ban} /> Reject
                        </button>
                    )}
                </>}>
                {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
                {!detail && !error && <p style={{ color: 'var(--text-secondary)' }}>Loading applicant…</p>}
                {a && (
                    <>
                        <div className="modal-section">
                            <div className="modal-section-title"><Icon as={User} /> Applicant Information</div>
                            <div className="modal-info-grid">
                                <InfoItem label="Applicant ID">{applicantNo(a)}</InfoItem>
                                <InfoItem label="Full Name">
                                    <span id="applicantViewName" style={{ fontWeight: 700 }}>{a.full_name}</span>{' '}
                                    <span title="The applicant's name is fixed and cannot be changed." style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                        <Icon as={Lock} /> Read-only
                                    </span>
                                </InfoItem>
                                <InfoItem label="Email Address">{dash(a.email)}</InfoItem>
                                <InfoItem label="Mobile Number">{dash(a.mobile_number)}</InfoItem>
                                <InfoItem label="Date of Birth">{a.date_of_birth ? phpFjY(a.date_of_birth) : '—'}</InfoItem>
                                <InfoItem label="Date Applied">{phpMjYgiA(a.applied_at)}</InfoItem>
                                <InfoItem label="Address" full>{dash(a.address)}</InfoItem>
                            </div>
                        </div>

                        <div className="modal-section">
                            <div className="modal-section-title"><Icon as={Briefcase} /> Application</div>
                            <div className="modal-info-grid">
                                <InfoItem label="Job Posting">{jp ? jp.posting_no : '—'}</InfoItem>
                                <InfoItem label="Application ID">{dash(a.application_no)}</InfoItem>
                                <InfoItem label="Job Title">{jp ? jp.title : a.position}</InfoItem>
                                <InfoItem label="Position">{dash(jp?.position ?? a.position)}</InfoItem>
                                <InfoItem label="Department">{dash(jp?.department)}</InfoItem>
                                <InfoItem label="Employment Type">{dash(jp?.employment_type)}</InfoItem>
                                <InfoItem label="Application Status">
                                    <Badge variant={a.status === 'Rejected' ? 'badge-danger' : a.status === 'Hired' ? 'badge-success' : 'badge-info'}>{a.status === 'Offer' ? 'Job Offer' : a.status}</Badge>
                                </InfoItem>
                                <InfoItem label="Recruitment Stage">{a.stage === 'Rejected' && rj?.stage ? `Rejected at ${rj.stage}` : a.stage}</InfoItem>
                            </div>
                        </div>

                        {rj && (
                            <div className="modal-section" id="applicantViewRejection">
                                <div className="modal-section-title" style={{ color: 'var(--danger)' }}><Icon as={XCircle} /> Rejection</div>
                                <div className="modal-info-grid">
                                    <InfoItem label="Rejection Stage">{dash(rj.stage)}</InfoItem>
                                    <InfoItem label="Rejected On">{rj.rejected_at ? phpMjYgiA(rj.rejected_at) : '—'}</InfoItem>
                                    <InfoItem label="Rejected By">{dash(rj.rejected_by)}</InfoItem>
                                    {rj.category && <InfoItem label="Rejection Reason">{rj.category}</InfoItem>}
                                    <InfoItem label="Reason for Rejection" full>{dash(rj.reason)}</InfoItem>
                                </div>
                            </div>
                        )}
                        {detail?.talent && (a.stage === 'Rejected' || detail.talent.origin_applicant_id) && (
                            <div className="modal-section" id="applicantViewTalent">
                                <div className="modal-section-title"><Icon as={Users} /> Future Opportunities</div>
                                <div className="modal-info-grid">
                                    <InfoItem label="Application Status"><Badge variant={talentBadge(detail.talent.display_status)}>{detail.talent.display_status}</Badge></InfoItem>
                                    {a.stage === 'Rejected' && <InfoItem label="Future Opportunity Preference">{detail.talent.future_pref ?? 'Not invited'}{detail.talent.future_pref_at ? ` · ${phpFjY(detail.talent.future_pref_at)}` : ''}</InfoItem>}
                                    {detail.talent.talent_pool_status && <InfoItem label="Talent Pool Status">{detail.talent.talent_pool_status}</InfoItem>}
                                    {detail.talent.last_contacted_at && <InfoItem label="Last Contacted">{phpMjYgiA(detail.talent.last_contacted_at)}</InfoItem>}
                                    {detail.talent.origin_applicant_id && <InfoItem label="Source">New application from the Talent Pool (previous application #{detail.talent.origin_applicant_id})</InfoItem>}
                                    {detail.talent.archived_at && <InfoItem label="Archived" full>{phpMjYgiA(detail.talent.archived_at)}{detail.talent.archive_reason ? ` · ${detail.talent.archive_reason}` : ''}</InfoItem>}
                                </div>
                            </div>
                        )}

                        {(a.pre_interview_at || a.interview_type) && (
                            <div className="modal-section">
                                <div className="modal-section-title"><Icon as={CalendarClock} /> Pre-Interview</div>
                                <div className="modal-info-grid">
                                    <InterviewItems title="Interview" at={a.pre_interview_at} type={a.interview_type} location={a.interview_location} interviewer={a.interviewer} />
                                </div>
                            </div>
                        )}
                        {(a.final_interview_at || a.final_interview_type || a.stage === 'Final Interview') && (
                            <div className="modal-section">
                                <div className="modal-section-title"><Icon as={CalendarClock} /> Final Interview</div>
                                <div className="modal-info-grid">
                                    <InterviewItems title="Interview" at={a.final_interview_at} type={a.final_interview_type} location={a.final_interview_location} interviewer={a.final_interviewer} />
                                </div>
                            </div>
                        )}

                        <div className="modal-section">
                            <div className="modal-section-title"><Icon as={History} /> Recruitment History</div>
                            <table className="data-table" id="applicantViewHistory">
                                <thead><tr><th>Date</th><th>Action</th><th>Details</th><th>By</th></tr></thead>
                                <tbody>
                                    {detail!.history.map((h, i) => (
                                        <tr key={i}>
                                            <td style={{ whiteSpace: 'nowrap' }}>{phpMjYgiA(h.created_at)}</td>
                                            <td>{h.action}</td>
                                            <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{h.description}</td>
                                            <td>{h.username ?? '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </Modal>
            <ResumeModal target={resume} onClose={() => setResume(null)} />
            <ApplicationHistoryModal applicantId={historyOf} onClose={() => setHistoryOf(null)} />
            <FeedbackModal applicantId={feedbackOf} name={a?.full_name} onClose={() => setFeedbackOf(null)} />
        </>
    );
}
