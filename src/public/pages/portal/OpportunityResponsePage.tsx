import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, Sparkles, X } from 'lucide-react';
import { ApplicantPage } from '../../layouts/SiteLayouts';
import { usePageMeta } from '../../hooks';
import { opportunityService } from '../../../services/portalService';
import { phpFjY } from '../../../utils/format';
import type { OpportunityLink } from '../../../types/portal';
import { PORTAL_SIGN_IN } from './ApplicantPortalLoginPage';

const outlineBtn = { color: '#0877bb', borderColor: '#0877bb', background: '#fff' };

/**
 * Answer links e-mailed to applicants (#/opportunity?type=&choice=&token=):
 *   future: be considered for future opportunities after a rejection (yes / no)
 *   job:    a Future Job Opportunity from the Talent Pool (accept / decline)
 * The link only pre-selects the answer; the applicant confirms it here, so
 * e-mail link scanners cannot answer on their behalf.
 */
export default function OpportunityResponsePage() {
    usePageMeta('Your Answer', 'Archon Nell Incorporated - Career Opportunities');
    const [params] = useSearchParams();
    const type = params.get('type') || '';
    const token = params.get('token') || '';
    const suggested = params.get('choice') || '';
    const [link, setLink] = useState<OpportunityLink | null>(null);
    const [error, setError] = useState('');
    const [done, setDone] = useState<{ message: string; applicationNo?: string | null } | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        opportunityService.lookup(type, token)
            .then(r => (r.success ? setLink(r) : setError(r.message || 'This link is no longer valid.')))
            .catch(e => setError(e instanceof Error ? e.message : 'This page could not be loaded.'));
    }, [type, token]);

    const answer = async (choice: string) => {
        setBusy(true);
        try {
            const r = await opportunityService.respond(type, token, choice);
            if (r.success) setDone({ message: r.message || 'Thank you.', applicationNo: r.application_no });
            else setError(r.message || 'Your answer could not be saved.');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Your answer could not be saved.');
        } finally {
            setBusy(false);
        }
    };

    const isJob = link?.type === 'job';
    const yes = isJob ? 'accept' : 'yes';
    const no = isJob ? 'decline' : 'no';

    return (
        <ApplicantPage>
            <section className="applicant-page portal-dashboard">
                <div className="container">
                    <div className="page-header reveal">
                        <div className="section-label" style={{ textAlign: 'center' }}>{isJob ? 'FUTURE JOB OPPORTUNITY' : 'FUTURE OPPORTUNITIES'}</div>
                        <h1 className="page-title">{link?.first_name ? `Hello, ${link.first_name}` : 'Your Answer'}</h1>
                    </div>
                    <div className="application-form portal-loading" id="opportunityResponse">
                        {done ? (
                            <>
                                <p className="portal-form-text"><Check /> {done.message}</p>
                                <Link to={PORTAL_SIGN_IN} className="btn btn-primary">Go to the Applicant Portal</Link>
                            </>
                        ) : error ? (
                            <>
                                <p className="portal-form-text">{error}</p>
                                <Link to={PORTAL_SIGN_IN} className="btn btn-primary">Go to the Applicant Portal</Link>
                            </>
                        ) : !link ? (
                            <p className="portal-form-text"><span className="spinner spinner-inline"></span> Loading...</p>
                        ) : (
                            <>
                                {isJob ? (
                                    <>
                                        <p className="portal-form-text"><Sparkles /> We have a new position that may match your skills and experience. Would you like to be considered for this opportunity?</p>
                                        <div className="application-summary portal-summary">
                                            <div className="summary-item"><div className="summary-label">Position</div><div className="summary-value highlight">{link.job_title}</div></div>
                                            <div className="summary-item"><div className="summary-label">Department</div><div className="summary-value">{link.department || '—'}</div></div>
                                            <div className="summary-item"><div className="summary-label">Job Posting ID</div><div className="summary-value">{link.posting_no}</div></div>
                                            {link.expires_at && <div className="summary-item"><div className="summary-label">Answer By</div><div className="summary-value">{phpFjY(link.expires_at)}</div></div>}
                                            {link.message && <div className="summary-item full"><div className="summary-label">Message from HR</div><div className="summary-value">{link.message}</div></div>}
                                        </div>
                                        <p className="portal-muted">Accepting creates a new application that goes through our normal recruitment process. This is not a job offer.</p>
                                    </>
                                ) : (
                                    <p className="portal-form-text">
                                        Thank you for your interest in the {link.position} position. Although your application did not proceed, we would like to keep your
                                        profile for future job opportunities that match your qualifications. Would you like to be considered?
                                    </p>
                                )}
                                <div className="portal-toolbar-actions" style={{ justifyContent: 'center', marginTop: 16 }}>
                                    <button type="button" className={`btn ${suggested === no ? 'btn-outline' : 'btn-primary'} btn-op-yes`} disabled={busy}
                                        style={suggested === no ? outlineBtn : undefined} onClick={() => void answer(yes)}>
                                        <Check /> {isJob ? 'Accept & Apply' : 'Yes, Contact Me for Future Opportunities'}
                                    </button>
                                    <button type="button" className={`btn ${suggested === no ? 'btn-primary' : 'btn-outline'} btn-op-no`} disabled={busy}
                                        style={suggested === no ? undefined : outlineBtn} onClick={() => void answer(no)}>
                                        <X /> {isJob ? 'Decline' : 'No, Do Not Contact Me'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </section>
        </ApplicantPage>
    );
}
