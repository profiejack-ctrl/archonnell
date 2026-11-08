import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Info } from 'lucide-react';
import { ApplicantPage } from '../layouts/SiteLayouts';
import { showToast, usePageMeta, wait } from '../hooks';
import { portalService } from '../../services/portalService';
import type { JobRecommendation } from '../../types/portal';

const STAGES = [
    { s: 'start', msg: 'Loading applicant profile...', pct: 10 },
    { s: 'load_jobs', msg: 'Fetching available positions...', pct: 28 },
    { s: 'compare_skills', msg: 'Comparing skills with job requirements...', pct: 50 },
    { s: 'compare_experience', msg: 'Matching work experience...', pct: 70 },
    { s: 'calculate', msg: 'Calculating compatibility scores...', pct: 88 },
    { s: 'finalize', msg: 'Generating recommendations...', pct: 100 },
];

const jobIdOf = (rec: JobRecommendation) => Number(rec.job_position_id ?? rec.job_id ?? 0);
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

function RecommendationCard({ rec, rank, selected, onSelect }: { rec: JobRecommendation; rank: number; selected: boolean; onSelect: () => void }) {
    const score = Number(rec.match_score ?? 0);
    const scoreClass = score >= 70 ? 'score-high' : (score >= 40 ? 'score-mid' : 'score-low');
    const dashArray = Math.round((score / 100) * 251.2);
    const skills = list(rec.matching_skills);
    const exp = list(rec.matching_experience);
    const edu = list(rec.matching_education);
    const reasons = String(rec.ai_reason || rec.reason || '').split('\n').filter(Boolean);
    const desc = String(rec.description || '');

    return (
        <div className={selected ? 'recommendation-card selected' : 'recommendation-card'} data-job-id={jobIdOf(rec)} data-score={score} onClick={onSelect}>
            <div className="rec-radio"></div>
            <div className="rec-content">
                <div className="rec-header">
                    <h3 className="rec-title">{rec.job_title || 'Available Position'}</h3>
                    <span className="rec-rank">Rank #{rank}</span>
                </div>
                {desc && <p className="rec-description">{desc.substring(0, 160)}{desc.length > 160 ? '...' : ''}</p>}
                <div className="match-reasons">
                    {reasons.length > 0 && (
                        <div className="reasons-list">{reasons.slice(0, 4).map((r, i) => <div key={i} className="reason-item">{r}</div>)}</div>
                    )}
                    {skills.length > 0 && (
                        <div className="reason-block" style={{ marginTop: 10 }}>
                            <h5>Matching Skills</h5>
                            <div className="tags-list">{skills.slice(0, 6).map((s, i) => <span key={i} className="tag tag-skill">{s}</span>)}</div>
                        </div>
                    )}
                    {(exp.length > 0 || edu.length > 0) && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                            {exp.length > 0 && (
                                <div className="match-block"><label>Experience</label><ul className="match-list small">{exp.slice(0, 2).map((e, i) => <li key={i}>{e}</li>)}</ul></div>
                            )}
                            {edu.length > 0 && (
                                <div className="match-block"><label>Education</label><ul className="match-list small">{edu.slice(0, 2).map((e, i) => <li key={i}>{e}</li>)}</ul></div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            <div className="rec-score-wrapper">
                <div className="score-circle">
                    <svg viewBox="0 0 100 100">
                        <circle className="score-bg" cx="50" cy="50" r="40"></circle>
                        <circle className={`score-fg ${scoreClass}`} cx="50" cy="50" r="40" strokeDasharray={`${dashArray} 251.2`} transform="rotate(-90 50 50)"></circle>
                    </svg>
                    <div className="score-text">
                        <span className="percent">{Math.round(score)}%</span>
                        <span className="label">Match</span>
                    </div>
                </div>
                <button className="select-btn" type="button">Select This Job</button>
            </div>
        </div>
    );
}

/** Step 3 - AI Job Recommendations (Homepage/applicant/recommendations.php). */
export default function RecommendationsPage() {
    usePageMeta('AI Job Recommendations', 'Archon Nell Incorporated - Career Application Portal');
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const applicantId = parseInt(params.get('applicant') || '0', 10) || 0;
    const showDirect = parseInt(params.get('show') || '0', 10) || 0;

    const [fullName, setFullName] = useState<string | null>(null);
    const [processing, setProcessing] = useState<{ msg: string; pct: number } | null>(null);
    const [recommendations, setRecommendations] = useState<JobRecommendation[] | null>(null);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);
    const selectionRef = useRef<HTMLDivElement>(null);
    const started = useRef(false);

    useEffect(() => {
        if (applicantId <= 0 || started.current) return;
        started.current = true;
        let cancelled = false;

        const fetchDirect = async (): Promise<JobRecommendation[]> => {
            try {
                const result = await portalService.getRecommendations(applicantId);
                return result.success && result.recommendations?.length ? result.recommendations : [];
            } catch {
                return [];
            }
        };

        (async () => {
            let preselected = 0;
            try {
                const applicant = await portalService.applicant(applicantId);
                if (!applicant.success) { if (!cancelled) navigate('/apply', { replace: true }); return; }
                if (cancelled) return;
                setFullName(applicant.full_name);
                preselected = applicant.preselected_job_id;
            } catch {
                if (!cancelled) navigate('/apply', { replace: true });
                return;
            }

            let recs: JobRecommendation[] = [];
            if (showDirect) {
                recs = await fetchDirect();
            } else {
                for (let i = 0; i < STAGES.length; i++) {
                    if (cancelled) return;
                    setProcessing({ msg: STAGES[i].msg, pct: STAGES[i].pct });
                    await wait(450 + Math.random() * 350);
                    if (cancelled) return;
                    try {
                        const result = await portalService.generateRecommendations(applicantId, STAGES[i].s);
                        if (result.success && result.is_complete) {
                            recs = result.recommendations || [];
                            break;
                        }
                        if (i === STAGES.length - 1) recs = await fetchDirect();
                    } catch {
                        if (i === STAGES.length - 1) recs = await fetchDirect();
                    }
                }
                if (recs.length === 0) recs = await fetchDirect();
            }
            if (cancelled) return;
            setProcessing(null);
            setRecommendations(recs);

            // A job posting's "Apply Now" choice is selected on arrival (it can still be changed).
            if (preselected && recs.some(r => jobIdOf(r) === preselected)) setSelectedId(preselected);
        })();

        return () => { cancelled = true; started.current = false; };
    }, [applicantId, showDirect, navigate]);

    useEffect(() => {
        if (selectedId) selectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [selectedId]);

    if (applicantId <= 0) return <Navigate to="/apply" replace />;
    if (fullName === null) return <ApplicantPage step={3}><section className="applicant-page recommendations-page"></section></ApplicantPage>;

    const selected = recommendations?.find(r => jobIdOf(r) === selectedId) ?? null;

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!selectedId) {
            showToast('Please select a job position first.', 'warning');
            return;
        }
        setBusy(true);
        try {
            const result = await portalService.selectJob(applicantId, selectedId);
            if (result.success) {
                showToast('Position selected!', 'success');
                setTimeout(() => navigate(`/review?applicant=${applicantId}`), 600);
            } else {
                setBusy(false);
                showToast(result.message || 'Failed to select job', 'error');
            }
        } catch (err) {
            setBusy(false);
            showToast(err instanceof Error ? err.message : 'Please try again.', 'error');
        }
    };

    return (
        <ApplicantPage step={3}>
            <section className="applicant-page recommendations-page">
                <div className="container">
                    <div className="page-header reveal">
                        <div className="section-label" style={{ textAlign: 'center' }}>STEP 3</div>
                        <h1 className="page-title">AI Job Recommendations</h1>
                        <p className="page-subtitle">
                            Hello, <strong>{fullName}</strong>! Based on our analysis of your resume, here are the most suitable positions for you.
                        </p>
                    </div>

                    <div id="recProcessing" className="processing-banner" style={{ display: processing ? 'block' : 'none' }}>
                        <div className="processing-inner">
                            <div className="spinner spinner-inline"></div>
                            <span id="processingMessage">{processing?.msg ?? 'Finding suitable positions...'}</span>
                            <div className="mini-progress">
                                <div className="mini-progress-fill" id="miniProgressFill" style={{ width: `${processing?.pct ?? 0}%` }}></div>
                            </div>
                        </div>
                    </div>

                    <div id="recommendationsList" className="recommendations-list reveal">
                        {recommendations !== null && recommendations.length === 0 && (
                            <div className="processing-banner" style={{ display: 'block', background: '#fff8e1', borderColor: '#ffe082' }}>
                                <div className="processing-inner">
                                    <div style={{ color: '#f57c00' }}><Info style={{ width: 28, height: 28 }} /></div>
                                    <span>No job positions are currently available. Please try again later or contact HR.</span>
                                </div>
                            </div>
                        )}
                        {recommendations?.map((rec, idx) => (
                            <RecommendationCard
                                key={jobIdOf(rec)}
                                rec={rec}
                                rank={idx + 1}
                                selected={jobIdOf(rec) === selectedId}
                                onSelect={() => setSelectedId(jobIdOf(rec))}
                            />
                        ))}
                    </div>

                    <div id="selectionInfo" className="selection-info" ref={selectionRef} style={{ display: selectedId ? 'block' : 'none' }}>
                        <div className="selection-card">
                            <div className="selection-label">Selected Position:</div>
                            <div className="selection-title" id="selectedJobTitle">{selected ? (selected.job_title || 'Selected Position') : ''}</div>
                            <div className="selection-score" id="selectedJobScore">{selected ? `Match Score: ${Math.round(Number(selected.match_score ?? 0))}%` : ''}</div>
                        </div>
                        <form id="jobSelectionForm" className="selection-form" onSubmit={onSubmit}>
                            <div className="form-actions">
                                <button
                                    type="button"
                                    className="btn btn-outline btn-large"
                                    id="backBtn"
                                    style={{ color: '#0877bb', borderColor: '#0877bb', background: '#fff' }}
                                    onClick={() => navigate(`/screening?applicant=${applicantId}`)}
                                >
                                    ← Back
                                </button>
                                <button type="submit" className="btn btn-primary btn-large" id="continueReviewBtn" disabled={!selectedId || busy}>
                                    {busy ? <><span className="spinner spinner-inline"></span> Processing...</> : 'Continue to Review →'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </section>
        </ApplicantPage>
    );
}
