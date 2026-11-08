import { useMemo, useState } from 'react';
import { Ban, CalendarCheck, CalendarClock, ChevronRight, CircleArrowRight, Clock, Eye, FileText, MailCheck } from 'lucide-react';
import Icon from '../../components/Icon';
import { Badge, EmptyRow, Page, PageHeader, PageState, PersonCell, SearchBox, StatCard, StatsGrid } from '../../components/ui';
import { usePageData } from '../../hooks/usePageData';
import { recruitmentService } from '../../services/recruitmentService';
import { ArchonAlert } from '../../utils/alerts';
import { applicantNo, parseDbDate, phpSchedule } from '../../utils/format';
import ResumeModal, { type ResumeTarget } from '../applicants/ResumeModal';
import { PositionCell, SchedulePreInterviewModal, toResumeTarget } from '../applicants/ApplicantValidationPage';
import { FilterCount, FilterSelect, SortTh, distinct, useFilters, useTableView } from '../../components/TableControls';
import { ConfirmationCell, ConfirmationModal, interviewStatus } from './InterviewConfirmation';
import { APPLICANT_FILTERS, ApplicantFilterControls, ApplicantViewModal, ListModeSelect, RejectedApplicantsTable, applicantMatches, rejectApplicant } from '../applicants/ApplicantActions';
import type { Applicant } from '../../types';

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** "All Schedules" / "Scheduled Today" / "Scheduled This Week" / "Overdue" filter (app.js scheduleMatch). */
function scheduleMatch(raw: string | null, mode: string): boolean {
    if (!mode || mode === 'All Schedules') return true;
    const t = parseDbDate(raw);
    if (!t) return false; // "To be scheduled" rows have no date
    const now = new Date();
    if (mode === 'Scheduled Today') return startOfDay(t).getTime() === startOfDay(now).getTime();
    if (mode === 'Scheduled This Week') {
        const monday = startOfDay(now);
        monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
        const nextMonday = new Date(monday);
        nextMonday.setDate(monday.getDate() + 7);
        return t >= monday && t < nextMonday;
    }
    if (mode === 'Overdue') return t < now;
    return true;
}

/** Recruitment Management > Pre-Interview. */
export default function PreInterviewPage() {
    const { data, loading, error, retry, reload } = usePageData(recruitmentService.preInterviewPage);
    const filters = useFilters({ ...APPLICANT_FILTERS, mode: 'All Schedules', interviewer: '', confirmation: '' });
    const f = filters.values;
    const [resume, setResume] = useState<ResumeTarget | null>(null);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [listMode, setListMode] = useState<'active' | 'rejected'>('active');
    const [viewId, setViewId] = useState<number | null>(null);
    // Attendance confirmation details + HR actions, and Reschedule (new confirmation request).
    const [confirmOf, setConfirmOf] = useState<Applicant | null>(null);
    const [rescheduling, setRescheduling] = useState<Applicant | null>(null);

    const reject = async (a: Applicant) => {
        setBusyId(a.id);
        if (await rejectApplicant(a, 'Pre-Interview')) await reload();
        setBusyId(null);
    };

    const shownStatus = (a: Applicant) => (interviewStatus(a.pre_interview_at, a.confirmation) === 'Rescheduled' ? 'Rescheduled' : 'Scheduled');
    const view = useTableView(data?.applicants, a => applicantMatches(a, f, a.pre_interview_at, shownStatus(a), a.interviewer, a.confirmation?.response)
        && scheduleMatch(a.pre_interview_at, f.mode) && (!f.interviewer || a.interviewer === f.interviewer)
        && (!f.confirmation || (a.confirmation?.response ?? 'Not requested') === f.confirmation), {
        no: a => applicantNo(a), name: a => a.full_name, position: a => a.position, schedule: a => a.pre_interview_at, status: a => shownStatus(a),
        confirmation: a => a.confirmation?.response ?? '',
    });
    const interviewers = useMemo(() => distinct(data?.applicants, a => a.interviewer), [data]);
    const confirmations = useMemo(() => distinct(data?.applicants, a => a.confirmation?.response ?? 'Not requested'), [data]);

    const proceed = async (id: number) => {
        const a = data?.applicants.find(x => x.id === id);
        if (!a) return;
        const ok = await ArchonAlert.confirm({
            title: 'Proceed to Final Interview',
            text: `Proceed ${a.full_name || 'this applicant'} (${applicantNo(a)}) to Final Interview?`,
            icon: 'question',
            confirmText: 'Proceed',
        });
        if (!ok) return;
        setBusyId(id);
        try {
            await recruitmentService.proceedToFinal(id);
            await ArchonAlert.success(`${a.full_name} has been moved to Final Interview.`);
            await reload();
        } catch (err) {
            await ArchonAlert.error('Could not advance applicant: ' + (err instanceof Error ? err.message : ''));
        } finally {
            setBusyId(null);
        }
    };

    return (
        <Page id="pre-interview">
            <PageHeader title="Pre-Interview" subtitle="Manage applicants scheduled for pre-interview. Review resumes and proceed to Final Interview." />
            <PageState loading={loading} error={error} onRetry={retry} />
            {data && (
                <>
                    <StatsGrid>
                        <StatCard icon={CalendarCheck} gradient={['#60a5fa', '#3b82f6']} value={data.stats.scheduled_today} label="Scheduled Today" />
                        <StatCard icon={Clock} gradient={['#a78bfa', '#8b5cf6']} value={data.stats.total} label="Total Pre-Interview" />
                        <StatCard icon={CircleArrowRight} gradient={['#34d399', '#10b981']} value={data.stats.proceeded_to_final} label="Proceeded to Final" />
                    </StatsGrid>
                    <div className="page-toolbar">
                        <div className="toolbar-left">
                            <SearchBox value={f.search} onChange={filters.set('search')} placeholder="Search name, applicant ID, interviewer..." />
                            <select className="form-select" id="preInterviewSchedule" aria-label="Schedule" value={f.mode} onChange={e => filters.set('mode')(e.target.value)}>
                                <option>All Schedules</option>
                                <option>Scheduled Today</option>
                                <option>Scheduled This Week</option>
                                <option>Overdue</option>
                            </select>
                            <ListModeSelect id="preInterviewListMode" value={listMode} onChange={setListMode} rejectedCount={data.rejected.length} />
                            {listMode === 'active' && <>
                                <FilterSelect id="preInterviewInterviewer" label="Interviewers" value={f.interviewer} onChange={filters.set('interviewer')} options={interviewers} />
                                <FilterSelect id="preInterviewConfirmation" label="Confirmations" value={f.confirmation} onChange={filters.set('confirmation')} options={confirmations} />
                            </>}
                            <ApplicantFilterControls idPrefix="preInterview" rows={listMode === 'rejected' ? data.rejected : data.applicants} filters={filters}
                                dateLabel={listMode === 'rejected' ? 'Rejected' : 'Interview'} statuses={listMode === 'rejected' ? undefined : ['Scheduled', 'Rescheduled']} />
                            {listMode === 'active' && <FilterCount shown={view.rows.length} total={view.total} />}
                        </div>
                    </div>
                    {listMode === 'rejected' ? (
                        <RejectedApplicantsTable id="preInterviewRejectedTable" rows={data.rejected} onView={a => setViewId(a.id)}
                            search={a => applicantMatches(a, f, a.rejected_at, 'Rejected', a.rejection_reason, a.rejected_by_name)} />
                    ) : (
                    <div className="card hover-card">
                        <div className="card-body no-padding">
                            <table className="data-table" id="preInterviewTable">
                                <thead>
                                    <tr><SortTh view={view} k="no">Applicant ID</SortTh><SortTh view={view} k="name">Name</SortTh><SortTh view={view} k="position">Position</SortTh><SortTh view={view} k="schedule">Pre-Interview Schedule</SortTh><SortTh view={view} k="status">Status</SortTh><SortTh view={view} k="confirmation">Confirmation</SortTh><th>Actions</th></tr>
                                </thead>
                                <tbody>
                                    {!data.applicants.length ? (
                                        <EmptyRow colSpan={7}>No applicants in the Pre-Interview stage. Applicants scheduled from Applicant Validation appear here.</EmptyRow>
                                    ) : !view.rows.length ? (
                                        <EmptyRow colSpan={7}>No records found. Try other filters or clear them.</EmptyRow>
                                    ) : view.rows.map((a, i) => (
                                        <tr className="hover-row" key={a.id} data-applicant-id={a.id} data-scheduled-at={a.pre_interview_at ?? ''}>
                                            <td><strong>{applicantNo(a)}</strong></td>
                                            <td><PersonCell index={i} name={a.full_name} /></td>
                                            <td><PositionCell a={a} /></td>
                                            <td><Badge variant="badge-info">{a.pre_interview_at ? phpSchedule(a.pre_interview_at) : 'To be scheduled'}</Badge></td>
                                            <td><Badge variant="badge-warning">{interviewStatus(a.pre_interview_at, a.confirmation) === 'Rescheduled' ? 'Rescheduled' : 'Scheduled'}</Badge></td>
                                            <td><ConfirmationCell c={a.confirmation} /></td>
                                            <td>
                                                <button className="btn btn-sm btn-outline btn-pre-view-resume" title="View Resume" onClick={() => setResume(toResumeTarget(a))}>
                                                    <Icon as={FileText} /> Resume
                                                </button>{' '}
                                                <button className="btn btn-sm btn-outline btn-view-applicant" title="View" onClick={() => setViewId(a.id)}>
                                                    <Icon as={Eye} /> View
                                                </button>{' '}
                                                <button className="btn btn-sm btn-outline btn-interview-confirmation" title="Interview Confirmation" onClick={() => setConfirmOf(a)}>
                                                    <Icon as={MailCheck} /> Confirmation
                                                </button>{' '}
                                                <button className="btn btn-sm btn-outline btn-reschedule-pre-interview" title="Reschedule Pre-Interview" onClick={() => setRescheduling(a)}>
                                                    <Icon as={CalendarClock} /> Reschedule
                                                </button>{' '}
                                                <button className="btn btn-sm btn-success btn-proceed-final" title="Proceed to Final Interview"
                                                    disabled={busyId === a.id} onClick={() => void proceed(a.id)}>
                                                    <Icon as={ChevronRight} /> Proceed
                                                </button>{' '}
                                                <button className="btn btn-sm btn-danger btn-reject-applicant" title="Reject" disabled={busyId === a.id} onClick={() => void reject(a)}>
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
            <ApplicantViewModal applicantId={viewId} stage="Pre-Interview" onClose={() => setViewId(null)} onRejected={() => void reload()} />
            <ConfirmationModal applicant={confirmOf} round="Pre-Interview" department={confirmOf?.department ?? confirmOf?.job_posting_department ?? ''}
                onClose={() => setConfirmOf(null)} onChanged={reload} onReschedule={setRescheduling} onReject={a => void reject(a)} />
            <SchedulePreInterviewModal applicant={rescheduling} reschedule onClose={() => setRescheduling(null)} onDone={reload} />
        </Page>
    );
}
