import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { ApplicantPage } from '../layouts/SiteLayouts';
import { usePageMeta } from '../hooks';
import { portalService } from '../../services/portalService';
import { parseDbDate, phpFjY } from '../../utils/format';
import type { SubmittedApplication } from '../../types/portal';

const NEXT_STEPS = [
    { title: 'HR Review', text: 'Our recruitment team will carefully review your application and resume against the job requirements.' },
    { title: 'Initial Screening', text: 'If your qualifications meet our criteria, you will be contacted for an initial phone or video screening.' },
    { title: 'Interview & Assessment', text: 'Shortlisted candidates will be invited for an interview and may be asked to complete relevant assessments.' },
    { title: 'Job Offer', text: 'Successful candidates will receive a formal job offer and onboarding instructions.' },
];

/** PHP date('F j, Y g:i A') */
function submittedOn(value: string): string {
    const d = parseDbDate(value);
    if (!d) return '';
    const h = d.getHours() % 12 || 12;
    return `${phpFjY(value)} ${h}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

/** Application Submitted (Homepage/applicant/success.php). */
export default function SuccessPage() {
    usePageMeta('Application Submitted', 'Archon Nell Incorporated - Career Application Portal');
    const [params] = useSearchParams();
    const applicationNumber = params.get('app') || '';
    const [application, setApplication] = useState<SubmittedApplication | null>(null);

    useEffect(() => {
        if (!applicationNumber) return;
        portalService.application(applicationNumber).then(r => setApplication(r.application)).catch(() => setApplication(null));
    }, [applicationNumber]);

    return (
        <ApplicantPage>
            <section className="applicant-page success-page">
                <div className="container">
                    <div className="success-container reveal">
                        <div className="success-icon">
                            <svg viewBox="0 0 120 120" width="120" height="120">
                                <circle cx="60" cy="60" r="55" fill="#e8f5e9" stroke="#4caf50" strokeWidth="4" />
                                <path d="M35 60 L52 77 L87 42" fill="none" stroke="#2e7d32" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="100" strokeDashoffset="100" className="check-path" />
                            </svg>
                        </div>

                        <h1 className="success-title">Application Submitted Successfully!</h1>
                        <p className="success-intro">Thank you for applying to <strong>Archon Nell Incorporated</strong>.</p>
                        <p className="success-subintro">Your application has been received and will be reviewed by our HR department.</p>

                        {application && (
                            <div className="application-summary">
                                <div className="summary-item">
                                    <div className="summary-label">Application Number</div>
                                    <div className="summary-value highlight">{application.application_number}</div>
                                </div>
                                <div className="summary-item">
                                    <div className="summary-label">Applicant Number</div>
                                    <div className="summary-value">{application.applicant_number}</div>
                                </div>
                                <div className="summary-item">
                                    <div className="summary-label">Full Name</div>
                                    <div className="summary-value">{application.full_name}</div>
                                </div>
                                <div className="summary-item">
                                    <div className="summary-label">Selected Position</div>
                                    <div className="summary-value highlight">{application.job_title}</div>
                                </div>
                                <div className="summary-item">
                                    <div className="summary-label">Status</div>
                                    <div className="summary-value">
                                        <span className="status-badge status-submitted">{application.status}</span>
                                    </div>
                                </div>
                                <div className="summary-item">
                                    <div className="summary-label">Match Score</div>
                                    <div className="summary-value">
                                        <div className="score-display">
                                            <div className="score-bar">
                                                <div className="score-fill" style={{ width: `${application.match_score ?? ''}%` }}></div>
                                            </div>
                                            <span>{Number(application.match_score ?? 0)}%</span>
                                        </div>
                                    </div>
                                </div>
                                {application.submitted_at && (
                                    <div className="summary-item">
                                        <div className="summary-label">Date Submitted</div>
                                        <div className="summary-value">{submittedOn(application.submitted_at)}</div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="next-steps-card">
                            <h3>What Happens Next?</h3>
                            <ol className="next-steps-list">
                                {NEXT_STEPS.map((s, i) => (
                                    <li key={s.title}>
                                        <span className="step-num">{i + 1}</span>
                                        <div>
                                            <strong>{s.title}</strong>
                                            <p>{s.text}</p>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        </div>

                        <div className="note-card">
                            <div className="note-icon"><Mail /></div>
                            <div className="note-content">
                                <strong>Keep an eye on your inbox.</strong>
                                <p>Updates on your application status will be sent to <code>{application?.email ?? 'your registered email address'}</code>. Please also check your spam or junk folder regularly.</p>
                            </div>
                        </div>

                        <div className="success-actions">
                            <Link to="/" className="btn btn-primary btn-large">← Back to Homepage</Link>
                            <Link to="/about" className="btn btn-outline btn-large" style={{ color: '#0877bb', borderColor: '#0877bb', background: '#fff' }}>
                                Learn More About Us
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            <style>{`
.check-path {
    animation: drawCheck 0.8s ease-out 0.3s forwards;
}
@keyframes drawCheck {
    to { stroke-dashoffset: 0; }
}
`}</style>
        </ApplicantPage>
    );
}
