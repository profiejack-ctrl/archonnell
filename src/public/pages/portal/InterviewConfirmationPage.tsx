import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApplicantPage } from '../../layouts/SiteLayouts';
import { usePageMeta } from '../../hooks';
import { interviewConfirmationService } from '../../../services/portalService';
import { phpFjY, phpMjYgiA } from '../../../utils/format';
import type { InterviewConfirmationLink, PortalInterviewConfirmation } from '../../../types/portal';
import { PORTAL_SIGN_IN } from './ApplicantPortalLoginPage';
import InterviewConfirmationBox from './InterviewConfirmationBox';

/**
 * Interview schedule confirmation from the e-mailed link
 * (#/interview-confirmation?token=...&choice=confirm|decline). The link only
 * identifies the request; the applicant confirms here (a SweetAlert2 dialog),
 * so e-mail link scanners cannot answer for them. The server enforces the deadline.
 */
export default function InterviewConfirmationPage() {
    usePageMeta('Interview Confirmation', 'Archon Nell Incorporated - Interview Schedule');
    const [params] = useSearchParams();
    const token = params.get('token') || '';
    const [link, setLink] = useState<InterviewConfirmationLink | null>(null);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        try {
            const r = await interviewConfirmationService.lookup(token);
            if (r.success) { setLink(r); setError(''); } else setError(r.message || 'This link is not valid.');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'This page could not be loaded.');
        }
    }, [token]);
    useEffect(() => { void load(); }, [load]);

    const superseded = link?.status === 'Superseded';
    const c: PortalInterviewConfirmation | null = link && !superseded ? {
        status: link.status as PortalInterviewConfirmation['status'], deadline: link.deadline ?? '', seconds_left: link.seconds_left ?? 0,
        responded_at: link.responded_at ?? null, response_reason: null, can_respond: !!link.can_respond,
    } : null;

    return (
        <ApplicantPage>
            <section className="applicant-page portal-dashboard">
                <div className="container">
                    <div className="page-header reveal">
                        <div className="section-label" style={{ textAlign: 'center' }}>INTERVIEW SCHEDULE</div>
                        <h1 className="page-title">{link?.first_name ? `Hello, ${link.first_name}` : 'Interview Confirmation'}</h1>
                    </div>
                    <div className="application-form" id="interviewConfirmation" style={{ maxWidth: 720, margin: '0 auto' }}>
                        {error ? (
                            <>
                                <p className="portal-form-text">{error}</p>
                                <Link to={PORTAL_SIGN_IN} className="btn btn-primary">Go to the Applicant Portal</Link>
                            </>
                        ) : !link ? (
                            <p className="portal-form-text"><span className="spinner spinner-inline"></span> Loading...</p>
                        ) : (
                            <>
                                <div className="application-summary portal-summary">
                                    <div className="summary-item"><div className="summary-label">Interview</div><div className="summary-value highlight">{link.round}</div></div>
                                    <div className="summary-item"><div className="summary-label">Position</div><div className="summary-value">{link.position}</div></div>
                                    <div className="summary-item"><div className="summary-label">Department</div><div className="summary-value">{link.department || '—'}</div></div>
                                    <div className="summary-item"><div className="summary-label">Interview Date</div><div className="summary-value">{phpFjY(link.interview_at)}</div></div>
                                    <div className="summary-item"><div className="summary-label">Interview Time</div><div className="summary-value">{phpMjYgiA(link.interview_at).split(' ').slice(-2).join(' ')}</div></div>
                                    <div className="summary-item"><div className="summary-label">Interview Type</div><div className="summary-value">{link.type ?? 'To be advised'}</div></div>
                                    <div className="summary-item full"><div className="summary-label">{link.meeting_link ? 'Meeting Link' : 'Location'}</div>
                                        <div className="summary-value">{link.meeting_link ? <a href={link.meeting_link} target="_blank" rel="noopener noreferrer" className="text-link">{link.meeting_link}</a> : (link.location ?? 'To be advised')}</div></div>
                                </div>
                                {superseded
                                    ? <div className="portal-confirmation expired">{link.closed_message}</div>
                                    : c && <InterviewConfirmationBox c={c} onDone={load} onAnswer={(choice, reason) => interviewConfirmationService.respond(token, choice, reason)} />}
                                <p className="portal-muted" style={{ marginTop: 16 }}>You can also follow your application in the <Link to={PORTAL_SIGN_IN} className="text-link">Applicant Portal</Link>.</p>
                            </>
                        )}
                    </div>
                </div>
            </section>
        </ApplicantPage>
    );
}
