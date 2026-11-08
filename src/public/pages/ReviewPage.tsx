import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Bot, Briefcase, ClipboardList, FileText, GraduationCap, Paperclip, Search, Send, Target } from 'lucide-react';
import { ApplicantPage } from '../layouts/SiteLayouts';
import { showToast, usePageMeta } from '../hooks';
import { portalService } from '../../services/portalService';
import { backendUrl } from '../../services/http';
import { phpFjY } from '../../utils/format';
import type { ReviewData } from '../../types/portal';

const outlineBtn = { color: '#0877bb', borderColor: '#0877bb', background: '#fff' };

function Item({ label, full, children, className }: { label: string; full?: boolean; children: ReactNode; className?: string }) {
    return (
        <div className={full ? 'review-item full' : 'review-item'}>
            <label>{label}</label>
            <div className={className ? `review-value ${className}` : 'review-value'}>{children}</div>
        </div>
    );
}

function Tags({ label, items, tagClass }: { label: string; items: string[]; tagClass: string }) {
    if (!items.length) return null;
    return (
        <div className="match-block">
            <label>{label}</label>
            <div className="tags-list">{items.map((s, i) => <span key={i} className={`tag ${tagClass}`}>{s}</span>)}</div>
        </div>
    );
}

function Bullets({ label, items, small }: { label: string; items: string[]; small?: boolean }) {
    if (!items.length) return null;
    return (
        <div className="match-block">
            <label>{label}</label>
            <ul className={small ? 'match-list small' : 'match-list'}>{items.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
    );
}

/** PHP number_format($kb, 1): thousands separator + one decimal. */
function kb(bytes: number): string {
    return (bytes / 1024).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Step 4 - Review Your Application (Homepage/applicant/review.php). */
export default function ReviewPage() {
    usePageMeta('Review Your Application', 'Archon Nell Incorporated - Career Application Portal');
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const applicantId = parseInt(params.get('applicant') || '0', 10) || 0;

    const [data, setData] = useState<ReviewData | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (applicantId <= 0) return;
        let cancelled = false;
        portalService.review(applicantId).then(result => {
            if (cancelled) return;
            if (result.success) setData(result);
            else if (result.redirect === 'recommendations') navigate(`/recommendations?applicant=${applicantId}&show=1`, { replace: true });
            else navigate('/apply', { replace: true });
        }).catch(err => {
            if (!cancelled) showToast(err instanceof Error ? err.message : 'Please try again.', 'error');
        });
        return () => { cancelled = true; };
    }, [applicantId, navigate]);

    useEffect(() => {
        if (!confirming) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setConfirming(false); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [confirming]);

    if (applicantId <= 0) return <Navigate to="/apply" replace />;
    if (!data) return <ApplicantPage step={4}><section className="applicant-page review-page"></section></ApplicantPage>;

    const { applicant, education, experience, resume, recommendation, screening } = data;
    const matchScore = recommendation.match_score;
    const ringColor = matchScore >= 70 ? '#2e7d32' : (matchScore >= 40 ? '#f57c00' : '#c62828');
    const reasons = recommendation.ai_reason.split('\n').filter(Boolean);

    const submit = async () => {
        setConfirming(false);
        setSubmitting(true);
        try {
            const result = await portalService.submit(applicantId, data.job_position_id);
            if (result.success && result.application) {
                showToast('Application submitted successfully!', 'success');
                const number = result.application.application_number;
                setTimeout(() => navigate(`/success?app=${encodeURIComponent(number)}`), 1000);
            } else {
                setSubmitting(false);
                showToast(result.message || 'Failed to submit application', 'error');
            }
        } catch (err) {
            setSubmitting(false);
            showToast(err instanceof Error ? err.message : 'Please try again.', 'error');
        }
    };

    return (
        <ApplicantPage step={4}>
            <section className="applicant-page review-page">
                <div className="container">
                    <div className="page-header reveal">
                        <div className="section-label" style={{ textAlign: 'center' }}>STEP 4</div>
                        <h1 className="page-title">Review Your Application</h1>
                        <p className="page-subtitle">Please review all information below before submitting your application.</p>
                    </div>

                    <form id="reviewForm" className="review-form reveal" onSubmit={e => e.preventDefault()}>
                        <div className="review-grid">
                            <div className="review-section">
                                <fieldset className="review-block">
                                    <legend><ClipboardList /> Personal Information</legend>
                                    <div className="review-grid-2">
                                        <Item label="Full Name">{applicant.full_name}</Item>
                                        <Item label="Date of Birth">{phpFjY(applicant.date_of_birth)}</Item>
                                        <Item label="Gender">{applicant.gender}</Item>
                                        <Item label="Mobile Number">{applicant.mobile_number}</Item>
                                        <Item label="Email Address" full>{applicant.email}</Item>
                                        <Item label="Complete Address" full>{applicant.address}, {applicant.city}, {applicant.province}</Item>
                                    </div>
                                </fieldset>

                                <fieldset className="review-block">
                                    <legend><GraduationCap /> Education</legend>
                                    <div className="review-grid-2">
                                        <Item label="Highest Attainment" full>{education?.highest_attainment ?? 'N/A'}</Item>
                                        <Item label="Course / Degree">{education?.course ?? 'N/A'}</Item>
                                        <Item label="Year Graduated">{education?.year_graduated ?? 'N/A'}</Item>
                                        <Item label="School / University" full>{education?.school ?? 'N/A'}</Item>
                                    </div>
                                </fieldset>

                                <fieldset className="review-block">
                                    <legend><Briefcase /> Experience &amp; Skills</legend>
                                    <div className="review-grid-2">
                                        <Item label="Years of Experience">{experience?.years_experience ?? '0'} year(s)</Item>
                                        <Item label="Previous Position">{experience?.current_position ?? 'N/A'}</Item>
                                        <Item label="Previous Company / Employer" full>{experience?.previous_company ?? 'N/A'}</Item>
                                        <Item label="Skills" full>{experience?.skills ?? 'N/A'}</Item>
                                        {experience?.certifications ? <Item label="Certifications" full>{experience.certifications}</Item> : null}
                                        <Item label="Professional Summary" full className="summary">{experience?.professional_summary ?? 'N/A'}</Item>
                                    </div>
                                </fieldset>

                                <fieldset className="review-block">
                                    <legend><FileText /> Resume</legend>
                                    <div className="review-file">
                                        <div className="file-icon"><Paperclip /></div>
                                        <div>
                                            <div className="review-value">{resume?.original_filename ?? 'resume.pdf'}</div>
                                            <div className="review-meta">
                                                {resume ? `${kb(resume.file_size)} KB` : ''} •{' '}
                                                <a href={backendUrl(`Homepage/api/resume.php?applicant=${applicantId}`)} target="_blank" rel="noreferrer" className="text-link">View Resume</a>
                                            </div>
                                        </div>
                                    </div>
                                </fieldset>
                            </div>

                            <div className="review-sidebar">
                                <fieldset className="review-block selected-job-block">
                                    <legend><Target /> Selected Position</legend>
                                    <div className="selected-job-info">
                                        <div className="job-match-score">
                                            <div className="score-ring">
                                                <svg viewBox="0 0 120 120">
                                                    <circle cx="60" cy="60" r="50" fill="none" stroke="#e4edf2" strokeWidth="10" />
                                                    <circle
                                                        cx="60" cy="60" r="50" fill="none"
                                                        stroke={ringColor}
                                                        strokeWidth="10" strokeLinecap="round"
                                                        strokeDasharray={`${Math.round(matchScore * 3.14)} 314`}
                                                        transform="rotate(-90 60 60)"
                                                    />
                                                </svg>
                                                <div className="score-value">{matchScore}%</div>
                                            </div>
                                            <div className="match-label">Match Score</div>
                                        </div>
                                        <h3 className="selected-job-title">{recommendation.job_title}</h3>
                                    </div>
                                </fieldset>

                                <fieldset className="review-block">
                                    <legend><Bot /> AI Recommendation</legend>
                                    <div className="ai-recommendation-details">
                                        <div className="reasons-block">
                                            <strong>Why this job matches you:</strong>
                                            <div className="reasons-list">
                                                {(reasons.length ? reasons : ['Profile aligns with position requirements']).map((r, i) => (
                                                    <div key={i} className="reason-item">{r}</div>
                                                ))}
                                            </div>
                                        </div>
                                        <Tags label="Matching Skills:" items={recommendation.matching_skills} tagClass="tag-skill" />
                                        <Bullets label="Matching Experience:" items={recommendation.matching_experience} />
                                        <Bullets label="Matching Education:" items={recommendation.matching_education} />
                                    </div>
                                </fieldset>

                                <fieldset className="review-block">
                                    <legend><Search /> Resume Screening Highlights</legend>
                                    <Tags label="Detected Skills:" items={screening.skills.slice(0, 10)} tagClass="tag-detected" />
                                    <Bullets label="Experience:" items={screening.experience.slice(0, 3)} small />
                                    <Bullets label="Education:" items={screening.education.slice(0, 3)} small />
                                    {screening.ai_summary && (
                                        <div className="match-block">
                                            <label>AI Summary:</label>
                                            <p className="summary-text">{screening.ai_summary}</p>
                                        </div>
                                    )}
                                </fieldset>
                            </div>
                        </div>

                        <div className="form-actions review-actions">
                            <Link to={`/recommendations?applicant=${applicantId}&show=1`} className="btn btn-outline btn-large" style={outlineBtn}>
                                ← Edit / Change Job
                            </Link>
                            <button type="button" className="btn btn-primary btn-large" id="submitApplicationBtn" disabled={submitting} onClick={() => setConfirming(true)}>
                                <span className="btn-text" style={{ display: submitting ? 'none' : undefined }}>Submit Application</span>
                                <span className="btn-loading" style={{ display: submitting ? 'flex' : 'none' }}>
                                    <span className="spinner"></span> Submitting...
                                </span>
                            </button>
                        </div>
                    </form>
                </div>
            </section>

            <div id="confirmModal" className="modal" style={{ display: confirming ? 'flex' : 'none' }}>
                <div className="modal-overlay" onClick={() => setConfirming(false)}></div>
                <div className="modal-content">
                    <div className="modal-header">
                        <div className="modal-icon"><Send /></div>
                        <h3>Submit Your Application?</h3>
                    </div>
                    <div className="modal-body">
                        <p>Are you sure you want to submit your application for the <strong>{recommendation.job_title}</strong> position?</p>
                        <p className="modal-subtext">Once submitted, your application will be sent to our HR department for review.</p>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-outline" id="cancelSubmit" style={outlineBtn} onClick={() => setConfirming(false)}>Cancel</button>
                        <button type="button" className="btn btn-primary" id="confirmSubmit" onClick={() => void submit()}>Submit Application</button>
                    </div>
                </div>
            </div>
        </ApplicantPage>
    );
}
