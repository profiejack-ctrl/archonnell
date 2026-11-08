import { useEffect, useState } from 'react';
import { Ban, CalendarCheck, CalendarClock, CalendarDays, ClipboardList, Eye, FileText, Inbox, Mail } from 'lucide-react';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import { Badge, EmptyRow, Page, PageHeader, PageState, PersonCell, SearchBox, StatCard, StatsGrid } from '../../components/ui';
import { usePageData } from '../../hooks/usePageData';
import { useAuth } from '../../hooks/AuthContext';
import { applicantService, type Interviewer } from '../../services/applicantService';
import { ArchonAlert } from '../../utils/alerts';
import { applicantNo, datePart, fmtLongDate, isoDateFromToday, phpMjYgiA } from '../../utils/format';
import ResumeModal, { type ResumeTarget } from './ResumeModal';
import { APPLICANT_FILTERS, ApplicantFilterControls, ApplicantViewModal, ListModeSelect, RejectedApplicantsTable, applicantMatches, rejectApplicant } from './ApplicantActions';
import { FilterCount, SortTh, distinct, useFilters, useTableView } from '../../components/TableControls';
import type { Applicant } from '../../types';

export function toResumeTarget(a: Applicant): ResumeTarget {
    return { dbId: a.id, applicantNo: applicantNo(a), name: a.full_name, position: a.position, email: a.email ?? '', resumePath: a.resume_path ?? '' };
}

/** Position cell with the Job Posting the applicant applied through (ID · department). */
export function PositionCell({ a }: { a: Applicant }) {
    const posting = [a.job_posting_no, a.job_posting_department && a.job_posting_department !== 'Unassigned' ? a.job_posting_department : null].filter(Boolean).join(' · ');
    return (
        <>
            {a.position}
            {posting && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }} title="Job Posting">{posting}</div>}
        </>
    );
}


// Pre-interview scheduling rules (the server enforces the same ones).
const LEAD_DAYS = 7;
const TIME_MIN = '08:00';
const TIME_MAX = '15:00';
const LOCATIONS = ['Main Office (Cainta, Rizal)'];
const EMPTY_FORM = { date: '', time: '', type: '', location: '', interviewerId: '' };

function dateError(date: string): string {
    if (!date) return '';
    const earliest = isoDateFromToday(LEAD_DAYS);
    return date < earliest ? `The interview date must be at least ${LEAD_DAYS} days from today (earliest: ${fmtLongDate(earliest)}).` : '';
}

function timeError(time: string): string {
    return time && (time < TIME_MIN || time > TIME_MAX) ? 'The interview time must be between 8:00 AM and 3:00 PM.' : '';
}

function isMeetingLink(value: string): boolean {
    try {
        const url = new URL(value);
        return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.includes('.');
    } catch {
        return false;
    }
}

function interviewerLabel(i: Interviewer): string {
    return `${i.name} - ${[i.employee_no, i.position || i.role_name].filter(Boolean).join(' · ')}`;
}

const fieldErrorStyle = { fontSize: '0.8rem', color: 'var(--danger, #dc2626)', marginTop: '0.25rem', display: 'block' };


/**
 * Schedule Pre-Interview form (Applicant Validation), also used to reschedule
 * from Recruitment Management > Pre-Interview (reschedule). Either way the
 * applicant is e-mailed the schedule with an attendance confirmation request.
 */
export function SchedulePreInterviewModal({ applicant, reschedule = false, onClose, onDone }: {
    applicant: Applicant | null; reschedule?: boolean; onClose: () => void; onDone: () => unknown;
}) {
    const { session } = useAuth();
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    // Interviewers free at the chosen date + time (null until both are valid).
    const [interviewers, setInterviewers] = useState<Interviewer[] | null>(null);
    const [interviewersError, setInterviewersError] = useState('');
    const [refresh, setRefresh] = useState(0);

    // A new form each time it opens; a reschedule starts from the current type / location.
    useEffect(() => {
        if (!applicant) return;
        setForm(reschedule && applicant.interview_type
            ? { ...EMPTY_FORM, type: applicant.interview_type, location: applicant.interview_location ?? '' }
            : EMPTY_FORM);
    }, [applicant, reschedule]);

    const slotReady = !!applicant && !!form.date && !!form.time && !dateError(form.date) && !timeError(form.time);

    // Date or time changed: reload who is available for that slot and drop a choice that no longer is.
    useEffect(() => {
        setInterviewers(null);
        setInterviewersError('');
        if (!slotReady) {
            setForm(f => (f.interviewerId ? { ...f, interviewerId: '' } : f));
            return;
        }
        let cancelled = false;
        applicantService.availableInterviewers(`${form.date} ${form.time}`)
            .then(r => {
                if (cancelled) return;
                setInterviewers(r.interviewers);
                setForm(f => (f.interviewerId && !r.interviewers.some(i => String(i.id) === f.interviewerId) ? { ...f, interviewerId: '' } : f));
            })
            .catch(err => {
                if (cancelled) return;
                setInterviewersError(err instanceof Error ? err.message : 'Could not load interviewers.');
                setForm(f => (f.interviewerId ? { ...f, interviewerId: '' } : f));
            });
        return () => { cancelled = true; };
    }, [slotReady, form.date, form.time, refresh]);

    const confirmSchedule = async () => {
        if (!applicant) return;
        const warn = (message: string, title = 'Missing Information') => ArchonAlert.warning(message, { title });
        if (!form.date || !form.time) {
            await warn('Please select both date and time for the pre-interview.');
            return;
        }
        const slotError = dateError(form.date) || timeError(form.time);
        if (slotError) { await warn(slotError, 'Invalid Schedule'); return; }
        if (!form.type) { await warn('Please select the interview type.'); return; }
        const location = form.location.trim();
        if (form.type === 'Online') {
            if (!location) { await warn('Please provide the meeting link for the online interview.'); return; }
            if (!isMeetingLink(location)) { await warn('Please provide a valid meeting link (starting with http:// or https://).', 'Invalid Meeting Link'); return; }
        } else if (!LOCATIONS.includes(location)) {
            await warn('Please select the interview location.');
            return;
        }
        if (!form.interviewerId || !interviewers?.some(i => String(i.id) === form.interviewerId)) {
            await warn(interviewers && !interviewers.length
                ? 'No available interviewer for the selected date and time.'
                : 'Please select an available interviewer.');
            return;
        }
        setSaving(true);
        try {
            const res = await applicantService.schedulePreInterview({
                applicant_id: applicant.id,
                datetime: `${form.date} ${form.time}`,
                interview_type: form.type,
                interview_location: location,
                interviewer_id: Number(form.interviewerId),
                ...(reschedule ? { reschedule: 1 } : {}),
            });
            const name = applicant.full_name || 'Applicant';
            onClose();
            if (reschedule) {
                const mail = res.email_sent
                    ? ` A new confirmation request was e-mailed to the applicant (deadline ${res.confirmation_deadline ? phpMjYgiA(res.confirmation_deadline) : '3 days'}).`
                    : res.email_error ? ` The e-mail could not be sent: ${res.email_error}` : '';
                await ArchonAlert.success(`${name}'s pre-interview has been rescheduled for ${form.date} at ${form.time}.${mail}`);
            } else {
                await ArchonAlert.success(`${name} has been scheduled for Pre-Interview on ${form.date} at ${form.time}. Record moved to Recruitment Management → Pre-Interview.`);
            }
            await onDone();
        } catch (err) {
            await ArchonAlert.error('Could not schedule: ' + (err instanceof Error ? err.message : ''));
            setRefresh(n => n + 1); // the interviewer may have just been booked by someone else
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal open={!!applicant} onClose={onClose} titleTag="div" title={<><Icon as={CalendarClock} /> {reschedule ? 'Reschedule' : 'Schedule'} Pre-Interview</>}
            footer={<>
                <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                <button className="btn btn-primary" id="confirmSchedulePreInterview" disabled={saving} onClick={() => void confirmSchedule()}>
                    <Icon as={CalendarCheck} /> {reschedule ? 'Save New Schedule' : <>Schedule &amp; Proceed to Pre-Interview</>}
                </button>
            </>}>
            <div className="modal-form-grid">
                <div className="form-group full-width">
                    <label>Applicant</label>
                    <input type="text" className="form-input" id="scheduleApplicantName" readOnly
                        value={applicant ? `${applicantNo(applicant)} - ${applicant.full_name} (${applicant.position})` : ''} />
                </div>
                {reschedule && applicant?.pre_interview_at && (
                    <div className="form-group full-width">
                        <label>Current Schedule</label>
                        <input type="text" className="form-input" readOnly value={phpMjYgiA(applicant.pre_interview_at)} />
                    </div>
                )}
                <div className="form-group">
                    <label>Interview Date</label>
                    <input type="date" className="form-input" id="schedulePreDate" required min={isoDateFromToday(LEAD_DAYS)}
                        value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                    {dateError(form.date) && <small style={fieldErrorStyle}>{dateError(form.date)}</small>}
                </div>
                <div className="form-group">
                    <label>Interview Time</label>
                    <input type="time" className="form-input" id="schedulePreTime" required min={TIME_MIN} max={TIME_MAX}
                        value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
                    {timeError(form.time) && <small style={fieldErrorStyle}>{timeError(form.time)}</small>}
                </div>
                <div className="form-group">
                    <label>Interview Type</label>
                    <select className="form-input" id="scheduleInterviewType" required value={form.type}
                        onChange={e => setForm({ ...form, type: e.target.value, location: e.target.value === 'Face-to-Face' ? LOCATIONS[0] : '' })}>
                        <option value="">-- Select Interview Type --</option>
                        <option value="Face-to-Face">Face to Face</option>
                        <option value="Online">Online</option>
                    </select>
                </div>
                <div className="form-group">
                    <label>Location / Meeting Link</label>
                    {form.type === 'Online' ? (
                        <input type="url" className="form-input" id="scheduleInterviewLocation" required maxLength={255} placeholder="https://meet.google.com/..."
                            value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
                    ) : (
                        <select className="form-input" id="scheduleInterviewLocation" required disabled={!form.type}
                            value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}>
                            <option value="">{form.type ? '-- Select Location --' : 'Select an interview type first'}</option>
                            {form.type && LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                    )}
                    {form.type === 'Online' && form.location.trim() && !isMeetingLink(form.location.trim())
                        && <small style={fieldErrorStyle}>Please provide a valid meeting link (starting with http:// or https://).</small>}
                </div>
                <div className="form-group full-width">
                    <label>Interviewer</label>
                    <select className="form-input" id="schedulePreNotes" required disabled={!interviewers?.length}
                        value={form.interviewerId} onChange={e => setForm({ ...form, interviewerId: e.target.value })}>
                        <option value="">
                            {!slotReady ? 'Select a valid interview date and time first'
                                : interviewersError ? 'Could not load interviewers'
                                : !interviewers ? 'Checking availability...'
                                : interviewers.length ? '-- Select Interviewer --' : 'No available interviewer'}
                        </option>
                        {interviewers?.map(i => <option key={i.id} value={i.id}>{interviewerLabel(i)}</option>)}
                    </select>
                    {slotReady && interviewers && !interviewers.length
                        && <small style={fieldErrorStyle}>No available interviewer for the selected date and time.</small>}
                    {slotReady && interviewersError && <small style={fieldErrorStyle}>{interviewersError}</small>}
                </div>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                <Icon as={Mail} /> The applicant will be e-mailed the interview details{session?.mail_from ? ` from ${session.mail_from}` : ''} and asked to confirm attendance within 3 days.
            </p>
        </Modal>
    );
}

/** Applicant Management > Applicant Validation - validate applicants and schedule pre-interviews. */
export default function ApplicantValidationPage() {
    const { data, loading, error, retry, reload } = usePageData(applicantService.validationPage);
    const filters = useFilters(APPLICANT_FILTERS);
    const f = filters.values;
    const [resume, setResume] = useState<ResumeTarget | null>(null);
    const [scheduling, setScheduling] = useState<Applicant | null>(null);
    const [listMode, setListMode] = useState<'active' | 'rejected'>('active');
    const [viewId, setViewId] = useState<number | null>(null);
    const [rejectingId, setRejectingId] = useState<number | null>(null);

    const reject = async (a: Applicant) => {
        setRejectingId(a.id);
        if (await rejectApplicant(a, 'Validation')) await reload();
        setRejectingId(null);
    };

    const view = useTableView(data?.applicants, a => applicantMatches(a, f, a.applied_at, a.status), {
        no: a => applicantNo(a), name: a => a.full_name, position: a => a.position, email: a => a.email, applied: a => a.applied_at, status: a => a.status,
    });

    const openSchedule = (a: Applicant) => setScheduling(a);

    return (
        <Page id="applicant-validation">
            <PageHeader title="Applicant Validation" subtitle="Validate applicants and schedule pre-interviews" />
            <PageState loading={loading} error={error} onRetry={retry} />
            {data && (
                <>
                    <StatsGrid>
                        <StatCard icon={Inbox} gradient={['#60a5fa', '#3b82f6']} value={data.stats.new} label="New Applicants" />
                        <StatCard icon={ClipboardList} gradient={['#fbbf24', '#f59e0b']} value={data.stats.reviewing} label="Under Review" />
                        <StatCard icon={CalendarDays} gradient={['#a78bfa', '#8b5cf6']} value={data.stats.scheduled} label="Scheduled for Pre-Interview" />
                    </StatsGrid>
                    <div className="page-toolbar">
                        <div className="toolbar-left">
                            <SearchBox value={f.search} onChange={filters.set('search')} placeholder="Search name, applicant ID, email..." />
                            <ListModeSelect id="validationListMode" value={listMode} onChange={setListMode} rejectedCount={data.rejected.length} />
                            <ApplicantFilterControls idPrefix="validation" rows={listMode === 'rejected' ? data.rejected : data.applicants} filters={filters}
                                dateLabel={listMode === 'rejected' ? 'Rejected' : 'Applied'} statuses={listMode === 'rejected' ? undefined : distinct(data.applicants, a => a.status)} />
                            {listMode === 'active' && <FilterCount shown={view.rows.length} total={view.total} />}
                        </div>
                    </div>
                    {listMode === 'rejected' ? (
                        <RejectedApplicantsTable id="validationRejectedTable" rows={data.rejected} onView={a => setViewId(a.id)}
                            search={a => applicantMatches(a, f, a.rejected_at, 'Rejected', a.rejection_reason, a.rejected_by_name)} />
                    ) : (
                    <div className="card hover-card">
                        <div className="card-body no-padding">
                            <table className="data-table" id="applicantValidationTable">
                                <thead>
                                    <tr>
                                        <SortTh view={view} k="no">Applicant ID</SortTh><SortTh view={view} k="name">Name</SortTh><SortTh view={view} k="position">Position</SortTh>
                                        <SortTh view={view} k="email">Email</SortTh><SortTh view={view} k="applied">Applied Date</SortTh><SortTh view={view} k="status">Status</SortTh><th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {!data.applicants.length ? (
                                        <EmptyRow colSpan={7}>No applicants awaiting validation. New applications submitted through the careers portal appear here automatically.</EmptyRow>
                                    ) : !view.rows.length ? (
                                        <EmptyRow colSpan={7}>No records found. Try other filters or clear them.</EmptyRow>
                                    ) : view.rows.map((a, i) => (
                                        <tr className="hover-row" key={a.id} data-applicant-id={a.id}>
                                            <td><strong>{applicantNo(a)}</strong></td>
                                            <td><PersonCell index={i} name={a.full_name} /></td>
                                            <td><PositionCell a={a} /></td>
                                            <td>{a.email ?? ''}</td>
                                            <td>{datePart(a.applied_at)}</td>
                                            <td><Badge variant={a.status === 'Reviewing' ? 'badge-warning' : 'badge-info'}>{a.status}</Badge></td>
                                            <td>
                                                <button className="btn btn-sm btn-outline btn-view-resume" title="View Resume" onClick={() => setResume(toResumeTarget(a))}>
                                                    <Icon as={FileText} /> Resume
                                                </button>{' '}
                                                <button className="btn btn-sm btn-outline btn-view-applicant" title="View" onClick={() => setViewId(a.id)}>
                                                    <Icon as={Eye} /> View
                                                </button>{' '}
                                                <button className="btn btn-sm btn-primary btn-schedule-pre-interview" title="Schedule Pre-Interview" onClick={() => openSchedule(a)}>
                                                    <Icon as={CalendarClock} /> Schedule
                                                </button>{' '}
                                                <button className="btn btn-sm btn-danger btn-reject-applicant" title="Reject" disabled={rejectingId === a.id} onClick={() => void reject(a)}>
                                                    <Icon as={Ban} /> Reject
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    )}
                </>
            )}

            <ResumeModal target={resume} onClose={() => setResume(null)} />
            <ApplicantViewModal applicantId={viewId} stage="Validation" onClose={() => setViewId(null)} onRejected={() => void reload()} />
            <SchedulePreInterviewModal applicant={scheduling} onClose={() => setScheduling(null)} onDone={reload} />
        </Page>
    );
}
