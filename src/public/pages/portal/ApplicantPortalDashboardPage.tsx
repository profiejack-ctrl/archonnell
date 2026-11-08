import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Bell, BadgeCheck, Briefcase, CalendarClock, Check, CircleAlert, ClipboardList, Hourglass, ListChecks, LogOut,
    MessageSquare, Paperclip, RefreshCw, Sparkles, Star, X, XCircle,
} from 'lucide-react';
import { ApplicantPage } from '../../layouts/SiteLayouts';
import { showToast, usePageMeta } from '../../hooks';
import { applicantPortalService } from '../../../services/portalService';
import { parseDbDate, phpFjY, phpMjYgiA } from '../../../utils/format';
import type { ApplicantDashboard, InterviewSchedule, PortalOpportunity, PortalTalent, ProgressStep } from '../../../types/portal';
import { confirmDialog } from '../../../utils/alerts';
import { PORTAL_SIGN_IN } from './ApplicantPortalLoginPage';
import InterviewConfirmationBox from './InterviewConfirmationBox';
import JobOfferBox from './JobOfferBox';

/** Status is re-read from the server this often while the page is open. */
const REFRESH_MS = 60_000;

const outlineBtn = { color: '#0877bb', borderColor: '#0877bb', background: '#fff' };

const STATUS_BADGE: Record<ApplicantDashboard['summary']['status_tone'], string> = {
    review: 'status-submitted',
    interview: 'status-interview',
    hired: 'status-hired',
    rejected: 'status-rejected',
};

const INTERVIEW_BADGE: Record<InterviewSchedule['status'], string> = {
    'Scheduled': 'status-submitted',
    'Awaiting Result': 'status-interview',
    'Completed': 'status-hired',
};

function time12(value: string | null | undefined): string {
    const d = parseDbDate(value);
    if (!d) return '';
    return `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

/** "Thursday, October 1, 2026" */
function longDate(value: string | null | undefined): string {
    const d = parseDbDate(value);
    return d ? d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '';
}

function stepDate(step: ProgressStep): string {
    if (!step.date) return '';
    const when = phpMjYgiA(step.date);
    if (step.key === 'pre' || step.key === 'final') return step.state === 'completed' ? `Held ${when}` : `Scheduled ${when}`;
    return when;
}

function Item({ label, full, children }: { label: string; full?: boolean; children: ReactNode }) {
    return (
        <div className={full ? 'review-item full' : 'review-item'}>
            <label>{label}</label>
            <div className="review-value">{children}</div>
        </div>
    );
}

function Summary({ label, highlight, full, children }: { label: string; highlight?: boolean; full?: boolean; children: ReactNode }) {
    return (
        <div className={full ? 'summary-item full' : 'summary-item'}>
            <div className="summary-label">{label}</div>
            <div className={highlight ? 'summary-value highlight' : 'summary-value'}>{children}</div>
        </div>
    );
}

function InterviewCard({ iv, onChanged }: { iv: InterviewSchedule; onChanged: () => unknown }) {
    const online = iv.type === 'Online';
    let place: ReactNode = 'To be advised';
    if (online) {
        place = iv.meeting_link
            ? <a href={iv.meeting_link} target="_blank" rel="noopener noreferrer" className="text-link portal-link">{iv.meeting_link}</a>
            : 'The meeting link will be sent to you by HR.';
    } else if (iv.location) {
        place = iv.location;
    }
    return (
        <div className="portal-interview">
            <h4 className="portal-interview-title">{iv.round}</h4>
            <div className="review-grid-2">
                <Item label="Interview Date">{longDate(iv.scheduled_at)}</Item>
                <Item label="Interview Time">{time12(iv.scheduled_at)}</Item>
                <Item label="Interview Type">{iv.type ?? 'To be advised'}</Item>
                <Item label={online ? 'Meeting Link' : 'Location'}>{place}</Item>
                <Item label="Interviewer">{iv.interviewer ?? 'Human Resources & Administration'}</Item>
                <Item label="Interview Status"><span className={`status-badge ${INTERVIEW_BADGE[iv.status]}`}>{iv.status}</span></Item>
            </div>
            {/* Attendance confirmation (separate from the interview status); 3-day deadline enforced by the server. */}
            {iv.confirmation && iv.round_key && (
                <InterviewConfirmationBox c={iv.confirmation} onDone={onChanged}
                    onAnswer={(choice, reason) => applicantPortalService.interviewRespond(iv.round_key as string, choice, reason)} />
            )}
        </div>
    );
}

const OPPORTUNITY_BADGE: Record<PortalOpportunity['status'], string> = {
    Invited: 'status-interview',
    Accepted: 'status-hired',
    Declined: 'status-rejected',
    Withdrawn: 'status-submitted',
    Expired: 'status-submitted',
};

type Busy = (fn: () => Promise<void>) => Promise<void>;

/** "Consider me for future opportunities" after a rejection; the applicant can change it any time. */
function FutureOpportunities({ talent, run }: { talent: PortalTalent; run: Busy }) {
    const answer = (choice: 'yes' | 'no') => run(async () => {
        const r = await applicantPortalService.futurePreference(choice);
        showToast(r.message || (r.success ? 'Saved.' : 'Your answer could not be saved.'), r.success ? 'success' : 'error');
    });
    const pref = talent.future_pref;
    return (
        <fieldset className="review-block portal-future">
            <legend><Sparkles /> Future Opportunities</legend>
            <p className="portal-form-text">
                {pref === 'Agreed' && <>You agreed to be considered for future opportunities{talent.in_talent_pool ? ' and your profile is in our Talent Pool' : ''}. HR may contact you when a position matches your qualifications.</>}
                {pref === 'Declined' && <>You asked us not to contact you about future opportunities. You can change your mind at any time.</>}
                {pref === 'Pending Response' && <>Although this application did not proceed, we would like to keep your profile for future job opportunities that match your qualifications. Would you like to be considered?</>}
            </p>
            <div className="portal-toolbar-actions">
                {pref !== 'Agreed' && <button type="button" className="btn btn-primary btn-future-yes" onClick={() => void answer('yes')}><Check /> Yes, Contact Me for Future Opportunities</button>}
                {pref !== 'Declined' && <button type="button" className="btn btn-outline btn-future-no" style={outlineBtn} onClick={() => void answer('no')}><X /> No, Do Not Contact Me</button>}
            </div>
        </fieldset>
    );
}

/** Future Job Opportunity invitations sent from the Talent Pool (an invitation to apply, not a job offer). */
function JobOpportunities({ items, run, onApplied }: { items: PortalOpportunity[]; run: Busy; onApplied: (no: string) => void }) {
    const respond = async (o: PortalOpportunity, choice: 'accept' | 'decline') => {
        const ok = await confirmDialog({
            title: choice === 'accept' ? 'Apply for this Position' : 'Decline Opportunity',
            paragraphs: [choice === 'accept'
                ? `A new application for ${o.job_title} will be created from your profile. It goes through our normal recruitment process; this is not a job offer.`
                : 'We will not send you further invitations unless you change your future opportunity preference.'],
            icon: 'question', confirmText: choice === 'accept' ? 'Accept & Apply' : 'Decline',
        });
        if (!ok) return;
        await run(async () => {
            const r = await applicantPortalService.respondOpportunity(o.opportunity_no, choice);
            showToast(r.message || (r.success ? 'Saved.' : 'Your answer could not be saved.'), r.success ? 'success' : 'error');
            if (r.success && r.application_no) onApplied(r.application_no);
        });
    };
    return (
        <fieldset className="review-block portal-opportunities">
            <legend><Briefcase /> Job Opportunities</legend>
            <p className="portal-muted">Positions our HR team thinks match your profile. Accepting creates a new application; it is not a job offer.</p>
            <div className="portal-interviews">
                {items.map(o => (
                    <div className="portal-interview" key={o.opportunity_no}>
                        <h4 className="portal-interview-title">{o.job_title} <span className={`status-badge ${OPPORTUNITY_BADGE[o.status]}`}>{o.status === 'Invited' ? 'Awaiting Your Answer' : o.status}</span></h4>
                        <div className="review-grid-2">
                            <Item label="Job Posting ID">{o.posting_no}</Item>
                            <Item label="Department">{o.department || '—'}</Item>
                            <Item label="Sent">{phpFjY(o.sent_at)}</Item>
                            {o.status === 'Invited' && o.expires_at && <Item label="Answer By">{phpFjY(o.expires_at)}</Item>}
                            {o.responded_at && <Item label="Answered">{phpFjY(o.responded_at)}</Item>}
                            {o.new_application_no && <Item label="New Application ID">{o.new_application_no}</Item>}
                            {o.message && <Item label="Message from HR" full>{o.message}</Item>}
                        </div>
                        {o.status === 'Invited' && (
                            <div className="portal-toolbar-actions" style={{ marginTop: 12 }}>
                                <button type="button" className="btn btn-primary btn-opp-accept" onClick={() => void respond(o, 'accept')}><Check /> Accept &amp; Apply</button>
                                <button type="button" className="btn btn-outline btn-opp-decline" style={outlineBtn} onClick={() => void respond(o, 'decline')}><X /> Decline</button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </fieldset>
    );
}

/** Recruitment experience feedback (once per application). */
function FeedbackForm({ ratings, run }: { ratings: Record<string, string>; run: Busy }) {
    const [values, setValues] = useState<Record<string, string>>({});
    const [comments, setComments] = useState('');
    const submit = () => run(async () => {
        const r = await applicantPortalService.submitFeedback({ ...values, comments });
        showToast(r.message || (r.success ? 'Thank you for your feedback.' : 'Your feedback could not be sent.'), r.success ? 'success' : 'error');
    });
    return (
        <fieldset className="review-block portal-feedback">
            <legend><MessageSquare /> Share Your Feedback</legend>
            <p className="portal-muted">How was your experience with our recruitment process? (1 = poor, 5 = excellent)</p>
            {Object.entries(ratings).map(([key, label]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, margin: '6px 0' }}>
                    <span>{label}</span>
                    <span role="radiogroup" aria-label={label}>
                        {[1, 2, 3, 4, 5].map(n => (
                            <button key={n} type="button" role="radio" aria-checked={values[key] === String(n)} title={`${n} of 5`} data-rating={`${key}-${n}`}
                                onClick={() => setValues(v => ({ ...v, [key]: String(n) }))}
                                style={{ background: 'none', border: 0, padding: 2, cursor: 'pointer', color: Number(values[key] || 0) >= n ? '#f59e0b' : '#cbd5e1' }}>
                                <Star size={20} fill="currentColor" />
                            </button>
                        ))}
                    </span>
                </div>
            ))}
            <textarea className="form-input" id="portalFeedbackComments" rows={3} maxLength={2000} placeholder="Comments (optional)" value={comments}
                onChange={e => setComments(e.target.value)} style={{ width: '100%', marginTop: 8 }} />
            <button type="button" className="btn btn-primary btn-feedback-submit" style={{ marginTop: 10 }} onClick={() => void submit()}>Submit Feedback</button>
        </fieldset>
    );
}

/** Applicant Portal dashboard: the signed-in applicant's own application only. */
export default function ApplicantPortalDashboardPage() {
    usePageMeta('My Application', 'Archon Nell Incorporated - Applicant Portal');
    const navigate = useNavigate();
    const [data, setData] = useState<ApplicantDashboard | null>(null);
    const [loadError, setLoadError] = useState('');
    const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    /** passive = background refresh (does not keep the session alive). */
    const load = useCallback(async (passive: boolean, app = '') => {
        try {
            const r = await applicantPortalService.dashboard(passive, app);
            if (r.success) {
                setData(r);
                setLoadError('');
                setRefreshedAt(new Date());
            } else if (r.authenticated === false) {
                navigate(PORTAL_SIGN_IN, {
                    replace: true,
                    state: { notice: passive ? 'Your session has ended. Please sign in again.' : (r.message || 'Please sign in to view your application.') },
                });
            } else {
                setLoadError(r.message || 'Your application could not be loaded. Please try again.');
            }
        } catch (err) {
            setLoadError(err instanceof Error ? err.message : 'Your application could not be loaded. Please try again.');
        }
    }, [navigate]);

    // Changes HR makes (schedule, stage, hire...) show up without reloading the page.
    useEffect(() => {
        void load(false);
        const timer = window.setInterval(() => void load(true), REFRESH_MS);
        const onVisible = () => { if (document.visibilityState === 'visible') void load(true); };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [load]);

    /** My Applications: open another of the applicant's own applications. */
    const openApplication = async (applicationId: string) => {
        setRefreshing(true);
        await load(false, applicationId);
        setRefreshing(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const refresh = async () => {
        setRefreshing(true);
        await load(false);
        setRefreshing(false);
    };

    /** Runs a portal action, then re-reads the dashboard so the change shows. */
    const run: Busy = async fn => {
        setRefreshing(true);
        try { await fn(); } catch (e) { showToast(e instanceof Error ? e.message : 'Please try again.', 'error'); }
        await load(false);
        setRefreshing(false);
    };

    const signOut = async () => {
        try { await applicantPortalService.logout(); } catch { /* signed out below either way */ }
        showToast('You have signed out of the Applicant Portal.', 'success');
        navigate(PORTAL_SIGN_IN, { replace: true });
    };

    if (!data) {
        return (
            <ApplicantPage>
                <section className="applicant-page portal-dashboard">
                    <div className="container">
                        <div className="application-form portal-loading">
                            {loadError ? (
                                <>
                                    <p className="portal-form-text">{loadError}</p>
                                    <button type="button" className="btn btn-primary btn-large" onClick={() => void refresh()} disabled={refreshing}>Try Again</button>
                                </>
                            ) : (
                                <p className="portal-form-text"><span className="spinner spinner-inline"></span> Loading your application...</p>
                            )}
                        </div>
                    </div>
                </section>
            </ApplicantPage>
        );
    }

    const { summary, application } = data;
    const latest = summary.latest_update;
    const StatusIcon = summary.status_tone === 'rejected' ? XCircle
        : summary.status_tone === 'hired' ? BadgeCheck
            : summary.status_tone === 'interview' ? CalendarClock : Hourglass;

    return (
        <ApplicantPage>
            <section className="applicant-page portal-dashboard">
                <div className="container">
                    <div className="page-header reveal">
                        <div className="section-label" style={{ textAlign: 'center' }}>APPLICANT PORTAL</div>
                        <h1 className="page-title">Welcome, {data.applicant.first_name || data.applicant.full_name}</h1>
                        <p className="page-subtitle">Here is the latest status of your application with <strong>Archon Nell Incorporated</strong>.</p>
                    </div>

                    <div className="portal-toolbar">
                        <span className="portal-toolbar-text">
                            Updates automatically{refreshedAt ? ` · Last checked ${refreshedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''}
                        </span>
                        <div className="portal-toolbar-actions">
                            <button type="button" className="btn btn-outline" style={outlineBtn} onClick={() => void refresh()} disabled={refreshing}>
                                <RefreshCw /> {refreshing ? 'Refreshing...' : 'Refresh'}
                            </button>
                            <button type="button" className="btn btn-primary" onClick={() => void signOut()}>
                                <LogOut /> Sign Out
                            </button>
                        </div>
                    </div>

                    {loadError && <div className="validation-summary portal-inline-error">{loadError}</div>}

                    {/* Each application is tracked separately; only this applicant's own are listed. */}
                    {data.applications.length > 1 && (
                        <fieldset className="review-block portal-applications">
                            <legend><Briefcase /> My Applications</legend>
                            <div className="portal-table-wrap">
                                <table className="portal-table">
                                    <thead>
                                        <tr><th>Job</th><th>Department</th><th>Date Applied</th><th>Status</th><th></th></tr>
                                    </thead>
                                    <tbody>
                                        {data.applications.map(a => (
                                            <tr key={a.application_id} className={a.current ? 'current' : undefined}>
                                                <td>
                                                    <strong>{a.job_title || '—'}</strong>
                                                    <div className="portal-muted">{a.application_id}{a.job_posting_no ? ` · ${a.job_posting_no}` : ''}</div>
                                                </td>
                                                <td>{a.department || '—'}</td>
                                                <td>{phpFjY(a.date_applied)}</td>
                                                <td><span className={`status-badge ${STATUS_BADGE[a.status_tone]}`}>{a.status}</span></td>
                                                <td>
                                                    {a.current
                                                        ? <span className="portal-muted">Viewing</span>
                                                        : <button type="button" className="btn btn-outline" style={outlineBtn} disabled={refreshing}
                                                            onClick={() => void openApplication(a.application_id)}>View</button>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </fieldset>
                    )}

                    <div className="application-summary portal-summary">
                        <Summary label="Applicant Name">{data.applicant.full_name}</Summary>
                        <Summary label="Application ID" highlight>{summary.application_id}</Summary>
                        {summary.job_posting_no && <Summary label="Job Posting ID">{summary.job_posting_no}</Summary>}
                        <Summary label="Applied Position" highlight>{summary.position || '—'}</Summary>
                        <Summary label="Department">{summary.department || 'To be assigned'}</Summary>
                        <Summary label="Date Applied">{phpFjY(summary.date_applied)}</Summary>
                        <Summary label="Current Application Status">
                            <span className={`status-badge ${STATUS_BADGE[summary.status_tone]}`}>{summary.status}</span>
                        </Summary>
                        <Summary label="Latest Update" full>
                            {latest.title}{latest.date ? <span className="portal-muted"> · {phpMjYgiA(latest.date)}</span> : null}
                        </Summary>
                    </div>

                    <div className={`portal-status portal-status-${summary.status_tone}`} role="status">
                        <div className="portal-status-icon"><StatusIcon /></div>
                        <div>
                            <strong>{summary.status}</strong>
                            <p>{summary.status_message}</p>
                            {summary.rejection && (
                                <dl className="portal-rejection">
                                    {summary.rejection.stage && <><dt>Rejection Stage</dt><dd>{summary.rejection.stage}</dd></>}
                                    {summary.rejection.reason && <><dt>Reason</dt><dd>{summary.rejection.reason}</dd></>}
                                    {summary.rejection.date && <><dt>Date</dt><dd>{phpFjY(summary.rejection.date)}</dd></>}
                                </dl>
                            )}
                        </div>
                    </div>

                    {/* This application's job offer: details + Accept / Decline until the expiration date. */}
                    {data.offer && (
                        <fieldset className="review-block portal-job-offer">
                            <legend><Briefcase /> Job Offer</legend>
                            <JobOfferBox offer={data.offer} onDone={() => load(false)} onAnswer={(choice, reason) => applicantPortalService.offerRespond(choice, reason)} />
                        </fieldset>
                    )}
                    {data.talent?.can_answer && <FutureOpportunities talent={data.talent} run={run} />}
                    {!!data.talent?.opportunities.length && (
                        <JobOpportunities items={data.talent.opportunities} run={run}
                            onApplied={no => showToast(`New application ${no} created. Select it under My Applications.`, 'success')} />
                    )}

                    <div className="review-grid portal-grid">
                        <div className="review-section">
                            <fieldset className="review-block">
                                <legend><ListChecks /> Application Progress</legend>
                                <ol className="portal-timeline">
                                    {data.progress.map((step, i) => (
                                        <li key={step.key} className={`timeline-step ${step.state}`}>
                                            <div className="timeline-marker">
                                                {step.state === 'completed' ? <Check /> : step.state === 'rejected' ? <X /> : i + 1}
                                            </div>
                                            <div className="timeline-body">
                                                <div className="timeline-title">
                                                    {step.label}
                                                    {step.state === 'current' && <span className="timeline-tag">Current stage</span>}
                                                </div>
                                                <p className="timeline-text">{step.description}</p>
                                                {step.state !== 'pending' && step.date && <div className="timeline-date">{stepDate(step)}</div>}
                                            </div>
                                        </li>
                                    ))}
                                </ol>
                            </fieldset>

                            {data.interviews.length > 0 && (
                                <fieldset className="review-block">
                                    <legend><CalendarClock /> Interview Schedule</legend>
                                    <div className="portal-interviews">
                                        {data.interviews.map(iv => <InterviewCard key={iv.round} iv={iv} onChanged={() => load(false)} />)}
                                    </div>
                                </fieldset>
                            )}

                            <fieldset className="review-block">
                                <legend><ClipboardList /> Application Information</legend>
                                <div className="review-grid-2">
                                    <Item label="Full Name">{application.full_name}</Item>
                                    <Item label="Email Address">{application.email}</Item>
                                    <Item label="Mobile Number">{application.mobile_number}</Item>
                                    <Item label="Date Applied">{phpFjY(application.date_applied)}</Item>
                                    <Item label="Applied Position">{application.position || '—'}</Item>
                                    {summary.job_posting_no && <Item label="Job Posting ID">{summary.job_posting_no}</Item>}
                                    <Item label="Department">{application.department || 'To be assigned'}</Item>
                                    <Item label="Address" full>{application.address || '—'}</Item>
                                </div>
                                <div className="review-file portal-resume">
                                    <div className="file-icon"><Paperclip /></div>
                                    <div>
                                        <div className="review-value">{application.resume?.file_name ?? 'No resume on file'}</div>
                                        {application.resume && (
                                            <div className="review-meta">
                                                {(application.resume.file_size / 1024).toFixed(1)} KB •{' '}
                                                <a href={applicantPortalService.resumeUrl()} target="_blank" rel="noreferrer" className="text-link">View Resume</a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <p className="portal-muted portal-readonly">
                                    <CircleAlert /> These are the details you submitted. To correct any of them, please contact our HR department.
                                </p>
                            </fieldset>
                        </div>

                        <div className="review-sidebar portal-sidebar">
                            <fieldset className="review-block">
                                <legend><Bell /> Application Updates</legend>
                                <ul className="portal-updates">
                                    {data.updates.map((u, i) => (
                                        <li key={`${u.date}-${i}`} className={`update-${u.tone}`}>
                                            <span className="update-dot" aria-hidden="true"></span>
                                            <div>
                                                <div className="update-title">{u.title}</div>
                                                <p className="update-text">{u.message}</p>
                                                {u.date && <div className="update-date">{phpMjYgiA(u.date)}</div>}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </fieldset>
                            {data.talent?.feedback.allowed && (data.talent.feedback.submitted
                                ? <fieldset className="review-block"><legend><MessageSquare /> Your Feedback</legend><p className="portal-form-text">Thank you, your feedback was received.</p></fieldset>
                                : <FeedbackForm ratings={data.talent.feedback.ratings} run={run} />)}
                        </div>
                    </div>
                </div>
            </section>
        </ApplicantPage>
    );
}
