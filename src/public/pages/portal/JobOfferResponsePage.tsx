import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApplicantPage } from '../../layouts/SiteLayouts';
import { usePageMeta } from '../../hooks';
import { jobOfferLinkService } from '../../../services/portalService';
import type { JobOfferLink, PortalJobOffer } from '../../../types/portal';
import { PORTAL_SIGN_IN } from './ApplicantPortalLoginPage';
import JobOfferBox from './JobOfferBox';

/**
 * Job offer from the e-mailed link (#/job-offer?token=...&choice=accept|decline).
 * The link only identifies the offer; the applicant answers here (a SweetAlert2
 * dialog), so e-mail link scanners cannot answer for them.
 */
export default function JobOfferResponsePage() {
    usePageMeta('Job Offer', 'Archon Nell Incorporated - Job Offer');
    const [params] = useSearchParams();
    const token = params.get('token') || '';
    const [offer, setOffer] = useState<JobOfferLink | null>(null);
    const [error, setError] = useState('');
    const [answered, setAnswered] = useState(false);

    const load = useCallback(async () => {
        try {
            const r = await jobOfferLinkService.lookup(token);
            if (r.success) { setOffer(r); setError(''); } else setError(r.message || 'This link is not valid.');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'This page could not be loaded.');
        }
    }, [token]);
    useEffect(() => { void load(); }, [load]);

    return (
        <ApplicantPage>
            <section className="applicant-page portal-dashboard">
                <div className="container">
                    <div className="page-header reveal">
                        <div className="section-label" style={{ textAlign: 'center' }}>JOB OFFER</div>
                        <h1 className="page-title">{offer?.first_name ? `Congratulations, ${offer.first_name}!` : 'Job Offer'}</h1>
                    </div>
                    <div className="application-form" id="jobOfferResponse" style={{ maxWidth: 760, margin: '0 auto' }}>
                        {error ? (
                            <>
                                <p className="portal-form-text">{answered ? 'Thank you, your answer was saved.' : error}</p>
                                <Link to={PORTAL_SIGN_IN} className="btn btn-primary">Go to the Applicant Portal</Link>
                            </>
                        ) : !offer ? (
                            <p className="portal-form-text"><span className="spinner spinner-inline"></span> Loading...</p>
                        ) : (
                            <>
                                <JobOfferBox offer={offer as PortalJobOffer} onDone={async () => { setAnswered(true); await load(); }}
                                    onAnswer={(choice, reason) => jobOfferLinkService.respond(token, choice, reason)} />
                                <p className="portal-muted" style={{ marginTop: 16 }}>You can also see this offer in the <Link to={PORTAL_SIGN_IN} className="text-link">Applicant Portal</Link>.</p>
                            </>
                        )}
                    </div>
                </div>
            </section>
        </ApplicantPage>
    );
}
