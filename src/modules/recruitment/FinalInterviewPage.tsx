import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, CalendarClock, CircleCheck, CircleX, Eye, Handshake, Mail, MailCheck, UserCheck } from 'lucide-react';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import { Badge, EmptyRow, Page, PageHeader, PageState, PersonCell, SearchBox, StatCard, StatsGrid } from '../../components/ui';
import { usePageData } from '../../hooks/usePageData';
import { useAuth } from '../../hooks/AuthContext';
import { recruitmentService } from '../../services/recruitmentService';
import { ArchonAlert } from '../../utils/alerts';
import { applicantNo, datePart, phpMjYgiA, phpSchedule } from '../../utils/format';
import { PositionCell } from '../applicants/ApplicantValidationPage';
import { FilterCount, FilterSelect, SortTh, distinct, useFilters, useTableView } from '../../components/TableControls';
import { APPLICANT_FILTERS, ApplicantFilterControls, ApplicantViewModal, ListModeSelect, RejectedApplicantsTable, applicantMatches, rejectApplicant } from '../applicants/ApplicantActions';
import { ConfirmationCell, ConfirmationModal } from './InterviewConfirmation';
import type { Applicant } from '../../types';

/** Recruitment Management > Final Interview - Job Offer (Onboarding Management) -> Onboarding, or Reject -> Archives. */
export default function FinalInterviewPage() {
    const { data, loading, error, retry, reload } = usePageData(recruitmentService.finalInterviewPage);
    const filters = useFilters({ ...APPLICANT_FILTERS, hiring: '', confirmation: '' });
    const f = filters.values;
    const navigate = useNavigate();
    const [listMode, setListMode] = useState<'active' | 'rejected'>('active');
    const [viewId, setViewId] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);
    const { session } = useAuth();
    const [scheduling, setScheduling] = useState<Applicant | null>(null);
    // Attendance confirmation details + HR actions.
    const [confirmOf, setConfirmOf] = useState<Applicant | null>(null);
    const [form, setForm] = useState({ date: '', time: '', type: 'Face-to-Face', location: '', interviewer: '' });

    // Interview status (scheduled or not) and hiring status (the job offer's) of a row.
    const interviewState = (a: Applicant) => (a.final_interview_at ? 'Scheduled' : 'To be scheduled');
    const hiringState = (a: Applicant) => (data?.offers[a.id] ? `Job Offer ${data.offers[a.id].status}` : 'No Job Offer');
    const view = useTableView(data?.applicants, a => applicantMatches(a, f, a.final_interview_at, interviewState(a), a.final_interviewer, a.confirmation?.response)
        && (!f.hiring || hiringState(a) === f.hiring) && (!f.confirmation || (a.confirmation?.response ?? 'Not requested') === f.confirmation), {
        no: a => applicantNo(a), name: a => a.full_name, position: a => a.position, schedule: a => a.final_interview_at, confirmation: a => a.confirmation?.response ?? '',
        hiring: a => hiringState(a),
    });
    const hiringStates = useMemo(() => distinct(data?.applicants, hiringState), [data]); // eslint-disable-line react-hooks/exhaustive-deps
    const confirmations = useMemo(() => distinct(data?.applicants, a => a.confirmation?.response ?? 'Not requested'), [data]);

    // Schedule / Reschedule: the form starts from the current final interview details.
    const openSchedule = (a: Applicant) => {
        const at = a.final_interview_at ?? '';
        setForm({
            date: at ? datePart(at) : '',
            time: at ? at.slice(11, 16) : '',
            type: a.final_interview_type || 'Face-to-Face',
            location: a.final_interview_location ?? '',
            interviewer: a.final_interviewer ?? '',
        });
        setScheduling(a);
    };

    const confirmSchedule = async () => {
        if (!scheduling) return;
        if (!form.date || !form.time) {
            await ArchonAlert.warning('Please select both date and time for the final interview.', { title: 'Missing Information' });
            return;
        }
        setBusy(true);
        try {
            const res = await recruitmentService.scheduleFinal({
                applicant_id: scheduling.id,
                datetime: `${form.date} ${form.time}`,
                interview_type: form.type,
                interview_location: form.location,
                interviewer: form.interviewer,
            });
            const name = scheduling.full_name || 'Applicant';
            const again = !!scheduling.final_interview_at;
            setScheduling(null);
            const mail = res.email_sent ? ' The applicant has been e-mailed the interview details and asked to confirm attendance'
                + (res.confirmation_deadline ? ` by ${phpMjYgiA(res.confirmation_deadline)}.` : '.')
                : res.email_error ? ` The e-mail could not be sent: ${res.email_error}` : '';
            await ArchonAlert.success(`${name}'s final interview has been ${again ? 'rescheduled' : 'scheduled'} for ${form.date} at ${form.time}.${mail}`);
            await reload();
        } catch (err) {
            await ArchonAlert.error('Could not schedule: ' + (err instanceof Error ? err.message : ''));
        } finally {
            setBusy(false);
        }
    };

    // The job offer is prepared, extended and answered in Onboarding Management > Job Offers;
    // accepting it hires the applicant (employee + onboarding record).
    const openOffer = (a: Applicant) => navigate(`/new-hire-onboarding?tab=offers&applicant=${a.id}`);
    // Reject: required reason, rejection saved, applicant e-mailed (shared with the other stages).
    const reject = async (a: Applicant) => {
        setBusy(true);
        if (await rejectApplicant(a, 'Final Interview')) await reload();
        setBusy(false);
    };

    return (
        <Page id="final-interview">
            <PageHeader title="Final Interview" subtitle="Make final hiring decisions. Job Offer → Onboarding, or Reject → Archives." />
            <PageState loading={loading} error={error} onRetry={retry} />
            {data && (
                <>
                    <StatsGrid>
                        <StatCard icon={UserCheck} gradient={['#a78bfa', '#8b5cf6']} value={data.stats.pending} label="Pending Final Interview" />
                        <StatCard icon={CircleCheck} gradient={['#34d399', '#10b981']} value={data.stats.hired_this_month} label="Hired this Month" />
                        <StatCard icon={CircleX} gradient={['#f87171', '#ef4444']} value={data.stats.rejected_this_month} label="Rejected this Month" />
                    </StatsGrid>
                    <div className="page-toolbar">
                        <div className="toolbar-left">
                            <SearchBox value={f.search} onChange={filters.set('search')} placeholder="Search name, applicant ID, interviewer..." />
                            <ListModeSelect id="finalInterviewListMode" value={listMode} onChange={setListMode} rejectedCount={data.rejected.length} />
                            {listMode === 'active' && <>
                                <FilterSelect id="finalInterviewHiring" label="Hiring Statuses" value={f.hiring} onChange={filters.set('hiring')} options={hiringStates} />
                                <FilterSelect id="finalInterviewConfirmation" label="Confirmations" value={f.confirmation} onChange={filters.set('confirmation')} options={confirmations} />
                            </>}
                            <ApplicantFilterControls idPrefix="finalInterview" rows={listMode === 'rejected' ? data.rejected : data.applicants} filters={filters}
                                dateLabel={listMode === 'rejected' ? 'Rejected' : 'Interview'} statuses={listMode === 'rejected' ? undefined : ['Scheduled', 'To be scheduled']} statusLabel="Interview Statuses" />
                            {listMode === 'active' && <FilterCount shown={view.rows.length} total={view.total} />}
                        </div>
                    </div>
                    {listMode === 'rejected' ? (
                        <RejectedApplicantsTable id="finalInterviewRejectedTable" rows={data.rejected} onView={a => setViewId(a.id)}
                            search={a => applicantMatches(a, f, a.rejected_at, 'Rejected', a.rejection_reason, a.rejected_by_name)} />
                    ) : (
                    <div className="card hover-card">
                        <div className="card-body no-padding">
                            <table className="data-table" id="finalInterviewTable">
                                <thead>
                                    <tr><SortTh view={view} k="no">Applicant ID</SortTh><SortTh view={view} k="name">Name</SortTh><SortTh view={view} k="position">Position</SortTh><SortTh view={view} k="schedule">Final Interview Schedule</SortTh><SortTh view={view} k="confirmation">Confirmation</SortTh><th>Actions</th></tr>
                                </thead>
                                <tbody>
                                    {!data.applicants.length ? (
                                        <EmptyRow colSpan={6}>No applicants awaiting a final decision. Applicants advanced from Pre-Interview appear here. Use <strong>Job Offer</strong> to prepare the offer in Onboarding Management; accepting it creates the employee and onboarding records.</EmptyRow>
                                    ) : !view.rows.length ? (
                                        <EmptyRow colSpan={6}>No records found. Try other filters or clear them.</EmptyRow>
                                    ) : view.rows.map((a, i) => (
                                        <tr className="hover-row" key={a.id} data-applicant-id={a.id}>
                                            <td><strong>{applicantNo(a)}</strong></td>
                                            <td><PersonCell index={i} name={a.full_name} /></td>
                                            <td><PositionCell a={a} /></td>
                                            <td>
                                                {a.final_interview_at ? (
                                                    <>
                                                        <Badge variant="badge-info">{phpSchedule(a.final_interview_at)}</Badge>
                                                        {(a.final_interview_type || a.final_interview_location || a.final_interviewer) && (
                                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
                                                                {[a.final_interview_type, a.final_interview_location, a.final_interviewer && `with ${a.final_interviewer}`].filter(Boolean).join(' · ')}
                                                            </div>
                                                        )}
                                                    </>
                                                ) : <Badge variant="badge-warning">To be scheduled</Badge>}
                                                {data.offers[a.id] && <div style={{ marginTop: '0.3rem' }}><Badge variant={data.offers[a.id].status === 'Extended' ? 'badge-success' : 'badge-secondary'}>Job Offer {data.offers[a.id].offer_no}: {data.offers[a.id].status}</Badge></div>}
                                            </td>
                                            <td><ConfirmationCell c={a.confirmation} /></td>
                                            <td>
                                                <button className="btn btn-sm btn-outline btn-view-applicant" title="View" onClick={() => setViewId(a.id)}><Icon as={Eye} /> View</button>{' '}
                                                {a.final_interview_at && <><button className="btn btn-sm btn-outline btn-interview-confirmation" title="Interview Confirmation" onClick={() => setConfirmOf(a)}><Icon as={MailCheck} /> Confirmation</button>{' '}</>}
                                                <button className="btn btn-sm btn-primary btn-schedule-final-interview" title={a.final_interview_at ? 'Reschedule Final Interview' : 'Schedule Final Interview'} onClick={() => openSchedule(a)}>
                                                    <Icon as={CalendarClock} /> {a.final_interview_at ? 'Reschedule' : 'Schedule'}
                                                </button>{' '}
                                                <button className="btn btn-sm btn-success btn-job-offer" title="Job Offer (Onboarding Management)" onClick={() => openOffer(a)}><Icon as={Handshake} /> Job Offer</button>{' '}
                                                <button className="btn btn-sm btn-danger btn-reject-applicant" title="Reject" disabled={busy} onClick={() => void reject(a)}><Icon as={CircleX} /> Reject</button>
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

            <ApplicantViewModal applicantId={viewId} stage="Final Interview" onClose={() => setViewId(null)} onRejected={() => void reload()} />
            <ConfirmationModal applicant={confirmOf} round="Final Interview" department={confirmOf?.department ?? confirmOf?.job_posting_department ?? ''}
                onClose={() => setConfirmOf(null)} onChanged={reload} onReschedule={openSchedule} onReject={a => void reject(a)} />

            <Modal open={!!scheduling} onClose={() => setScheduling(null)} titleTag="div"
                title={<><Icon as={CalendarClock} /> {scheduling?.final_interview_at ? 'Reschedule' : 'Schedule'} Final Interview</>}
                footer={<>
                    <button className="btn btn-outline" onClick={() => setScheduling(null)}>Cancel</button>
                    <button className="btn btn-primary" id="confirmScheduleFinalInterview" disabled={busy} onClick={() => void confirmSchedule()}>
                        <Icon as={CalendarCheck} /> {scheduling?.final_interview_at ? 'Save New Schedule' : 'Schedule Final Interview'}
                    </button>
                </>}>
                <div className="modal-form-grid">
                    <div className="form-group full-width">
                        <label>Applicant</label>
                        <input type="text" className="form-input" id="scheduleFinalApplicantName" readOnly
                            value={scheduling ? `${applicantNo(scheduling)} - ${scheduling.full_name} (${scheduling.position})` : ''} />
                    </div>
                    <div className="form-group">
                        <label>Interview Date</label>
                        <input type="date" className="form-input" id="scheduleFinalDate" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label>Interview Time</label>
                        <input type="time" className="form-input" id="scheduleFinalTime" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label>Interview Type</label>
                        <select className="form-input" id="scheduleFinalType" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                            <option value="Face-to-Face">Face-to-Face</option>
                            <option value="Online">Online</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Location / Meeting Link</label>
                        <input type="text" className="form-input" id="scheduleFinalLocation" placeholder="Office address or meeting URL"
                            value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
                    </div>
                    <div className="form-group full-width">
                        <label>Interviewer</label>
                        <input type="text" className="form-input" id="scheduleFinalInterviewer" placeholder="e.g., Department Head - Final Interview"
                            value={form.interviewer} onChange={e => setForm({ ...form, interviewer: e.target.value })} />
                    </div>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    <Icon as={Mail} /> The applicant will be e-mailed the interview details{session?.mail_from ? ` from ${session.mail_from}` : ''}.
                </p>
            </Modal>

        </Page>
    );
}
