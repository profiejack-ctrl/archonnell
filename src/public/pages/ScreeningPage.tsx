import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { ApplicantPage } from '../layouts/SiteLayouts';
import { showToast, usePageMeta, wait } from '../hooks';
import { portalService } from '../../services/portalService';
import type { ScreeningStepResult, ScreeningSummary } from '../../types/portal';

const STAGES = ['start', 'extract', 'analyze_skills', 'analyze_experience', 'analyze_education', 'screen_complete'];
const MESSAGES = [
    'Initializing AI screening process...',
    'Extracting information from resume...',
    'Analyzing your skills and competencies...',
    'Reviewing your work experience...',
    'Evaluating educational background...',
    'Finalizing resume analysis...',
];
const UI_STEPS = [
    { id: 'step-extract', label: 'Extracting information from resume' },
    { id: 'step-skills', label: 'Analyzing skills and competencies' },
    { id: 'step-experience', label: 'Reviewing work experience' },
    { id: 'step-education', label: 'Evaluating educational background' },
];

type StepState = '' | 'active' | 'done';

function StepCheck() {
    return (
        <div className="step-check">
            <svg viewBox="0 0 24 24" width="16" height="16">
                <polyline points="20 6 9 17 4 12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </div>
    );
}

function ResultBlock({ title, items, limit, empty }: { title: string; items: string[]; limit: number; empty: string }) {
    return (
        <div className="result-block">
            <h4><Check /> {title}</h4>
            <ul>{items.length ? items.slice(0, limit).map((s, i) => <li key={i}>{s}</li>) : <li>{empty}</li>}</ul>
        </div>
    );
}

/** Step 2 - AI Resume Screening (Homepage/applicant/screening.php). */
export default function ScreeningPage() {
    usePageMeta('AI Resume Screening', 'Archon Nell Incorporated - Career Application Portal');
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const applicantId = parseInt(params.get('applicant') || '0', 10) || 0;

    const [progress, setProgress] = useState(0);
    const [message, setMessage] = useState('Initializing screening process...');
    const [steps, setSteps] = useState<StepState[]>(['', '', '', '']);
    const [summary, setSummary] = useState<ScreeningSummary | null>(null);
    const started = useRef(false);

    useEffect(() => {
        if (applicantId <= 0 || started.current) return;
        started.current = true;
        let cancelled = false;

        const update = (percent: number, text?: string) => {
            if (cancelled) return;
            setProgress(Math.min(100, percent));
            if (text) setMessage(text);
        };
        const mark = (idx: number, state: StepState) => {
            if (!cancelled) setSteps(s => s.map((v, i) => (i === idx ? state : v)));
        };
        const toRecommendations = () => { if (!cancelled) navigate(`/recommendations?applicant=${applicantId}`); };

        const processStep = async (stage: string): Promise<ScreeningStepResult> => {
            try {
                return await portalService.screeningStep(applicantId, stage);
            } catch (e) {
                return { success: false, message: e instanceof Error ? e.message : 'Processing error. Continuing...' };
            }
        };

        (async () => {
            mark(0, 'active');
            for (let i = 0; i < STAGES.length; i++) {
                const stage = STAGES[i];
                const base = (i / (STAGES.length - 1)) * 100;
                const next = ((i + 1) / (STAGES.length - 1)) * 100;
                update(base, MESSAGES[i] || MESSAGES[MESSAGES.length - 1]);

                await wait(500 + Math.random() * 400);
                if (cancelled) return;
                const result = await processStep(stage);
                if (cancelled) return;

                if (result.success) {
                    update(result.progress || next, result.message || MESSAGES[i]);
                    if (i === 1) { mark(0, 'done'); mark(1, 'active'); }
                    else if (i === 2) { mark(1, 'done'); mark(2, 'active'); }
                    else if (i === 3) { mark(2, 'done'); mark(3, 'active'); }
                    else if (i === 4) { mark(3, 'done'); }

                    if (result.is_complete && stage === 'screen_complete') {
                        update(100, 'Resume analysis complete!');
                        await wait(500);
                        if (result.screening_summary) {
                            if (!cancelled) setSummary(result.screening_summary);
                        } else {
                            toRecommendations();
                        }
                        return;
                    }
                } else {
                    if (i >= 2) continue;
                    showToast(result.message || 'Continuing screening process...');
                }
            }
            update(100, 'Screening complete!');
            await wait(600);
            toRecommendations();
        })();

        return () => { cancelled = true; started.current = false; };
    }, [applicantId, navigate]);

    if (applicantId <= 0) return <Navigate to="/apply" replace />;

    return (
        <ApplicantPage step={2}>
            <section className="applicant-page screening-page">
                <div className="container">
                    <div className="page-header reveal">
                        <div className="section-label" style={{ textAlign: 'center' }}>STEP 2</div>
                        <h1 className="page-title">AI Resume Screening</h1>
                        <p className="page-subtitle">Our AI is analyzing your resume to extract key information and match you with suitable positions.</p>
                    </div>

                    <div className="screening-container reveal">
                        <div className="screening-card" style={summary ? { display: 'none' } : undefined}>
                            <div className="ai-icon-wrapper">
                                <div className="ai-icon">
                                    <svg viewBox="0 0 64 64" width="80" height="80">
                                        <defs>
                                            <linearGradient id="aiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                                <stop offset="0%" style={{ stopColor: '#0877bb', stopOpacity: 1 }} />
                                                <stop offset="100%" style={{ stopColor: '#1594d0', stopOpacity: 1 }} />
                                            </linearGradient>
                                        </defs>
                                        <rect x="16" y="20" width="32" height="24" rx="4" fill="url(#aiGrad)" className="pulse-shape" />
                                        <circle cx="26" cy="32" r="3" fill="#fff" />
                                        <circle cx="38" cy="32" r="3" fill="#fff" />
                                        <path d="M28 40 Q32 43 36 40" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
                                        <rect x="28" y="12" width="8" height="8" rx="2" fill="#0877bb" opacity="0.8" />
                                        <line x1="32" y1="12" x2="32" y2="8" stroke="#0877bb" strokeWidth="2" strokeLinecap="round" />
                                        <circle cx="32" cy="6" r="2" fill="#0877bb" className="blink" />
                                        <line x1="16" y1="26" x2="10" y2="22" stroke="#0877bb" strokeWidth="2" strokeLinecap="round" />
                                        <line x1="48" y1="26" x2="54" y2="22" stroke="#0877bb" strokeWidth="2" strokeLinecap="round" />
                                        <line x1="16" y1="38" x2="10" y2="42" stroke="#0877bb" strokeWidth="2" strokeLinecap="round" />
                                        <line x1="48" y1="38" x2="54" y2="42" stroke="#0877bb" strokeWidth="2" strokeLinecap="round" />
                                    </svg>
                                </div>
                                <div className="ai-scan-ring"></div>
                                <div className="ai-scan-ring delay-1"></div>
                                <div className="ai-scan-ring delay-2"></div>
                            </div>

                            <h2 className="screening-title" id="screeningTitle">{summary ? 'Resume Analysis Complete!' : 'Analyzing your resume...'}</h2>
                            <p className="screening-message" id="screeningMessage" style={summary ? { display: 'none' } : undefined}>{message}</p>

                            <div className="progress-bar-container">
                                <div className="progress-bar">
                                    <div className="progress-fill" id="progressFill" style={{ width: `${progress}%` }}></div>
                                </div>
                                <div className="progress-percent" id="progressPercent">{Math.round(progress)}%</div>
                            </div>

                            <div className="screening-steps">
                                {UI_STEPS.map((s, i) => (
                                    <div key={s.id} className={steps[i] ? `screening-step ${steps[i]}` : 'screening-step'} id={s.id}>
                                        <StepCheck />
                                        <span>{s.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div id="screeningResult" className="screening-result" style={{ display: summary ? 'block' : 'none' }}>
                        <div className="result-header">
                            <div className="result-check"><Check /></div>
                            <h2>Resume Screening Complete</h2>
                        </div>
                        <div id="resultContent">
                            {summary && (
                                <>
                                    <ResultBlock title="Detected Skills" items={summary.skills ?? []} limit={12} empty="Skills analyzed from resume and profile" />
                                    <ResultBlock title="Work Experience" items={summary.work_experience ?? []} limit={6} empty="Work experience details analyzed" />
                                    <ResultBlock title="Education Background" items={summary.education ?? []} limit={6} empty="Educational qualifications verified" />
                                    <ResultBlock title="Certifications" items={summary.certifications ?? []} limit={6} empty="No certifications explicitly detected" />
                                </>
                            )}
                        </div>
                        <div className="result-actions">
                            <button type="button" className="btn btn-primary btn-large" id="toRecommendations" onClick={() => navigate(`/recommendations?applicant=${applicantId}`)}>
                                Continue to Job Recommendations →
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </ApplicantPage>
    );
}
