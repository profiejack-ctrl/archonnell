import { useEffect, useState } from 'react';
import { Download, FileText, FileType, Star, User } from 'lucide-react';
import Modal from '../../components/Modal';
import Icon from '../../components/Icon';
import { InfoItem } from '../../components/ui';
import { applicantService } from '../../services/applicantService';
import { backendUrl } from '../../services/http';
import type { AiDetail } from '../../types';

export interface ResumeTarget {
    dbId: number;
    applicantNo: string;
    name: string;
    position: string;
    email: string;
    /** Stored resume (e.g. "Homepage/uploads/resumes/RESUME_2026_12345.pdf"); '' when none. */
    resumePath: string;
}

/** "Applicant Resume" modal: applicant info, resume download and the AI screening / recommendation results. */
export default function ResumeModal({ target, onClose }: { target: ResumeTarget | null; onClose: () => void }) {
    const [ai, setAi] = useState<{ state: 'loading' | 'none' | 'ready'; detail?: AiDetail }>({ state: 'loading' });
    const [shown, setShown] = useState<ResumeTarget | null>(null);

    useEffect(() => {
        if (!target) return;
        setShown(target);
        setAi({ state: 'loading' });
        if (!target.dbId) { setAi({ state: 'none' }); return; }
        let cancelled = false;
        applicantService.aiDetail(target.dbId)
            .then(({ detail }) => { if (!cancelled) setAi(detail && detail.available ? { state: 'ready', detail } : { state: 'none' }); })
            .catch(err => {
                console.warn('Applicant AI detail:', err instanceof Error ? err.message : err);
                if (!cancelled) setAi({ state: 'none' });
            });
        return () => { cancelled = true; };
    }, [target]);

    const t = target ?? shown;
    const d = ai.detail;
    // The file is served by download-resume.php (login + permission checked), under
    // the same name the download gets.
    const ext = (t?.resumePath.split('.').pop() || '').toLowerCase();
    const fileName = `Resume_${(t?.name || 'Applicant').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '')}.${ext || 'pdf'}`;
    const resumeUrl = t ? backendUrl(`download-resume.php?id=${encodeURIComponent(String(t.dbId))}`) : '';
    const skills = d?.screening?.extracted_skills || [];
    const reasons = String(d?.recommendation?.ai_reason || '').split('\n').filter(Boolean);

    return (
        <Modal open={!!target} onClose={onClose} titleTag="div" size="lg" title={<><Icon as={FileText} /> Applicant Resume</>}
            footer={<button className="btn btn-outline" onClick={onClose}>Close</button>}>
            <div className="modal-section">
                <div className="modal-section-title"><Icon as={User} /> Applicant Information</div>
                <div className="modal-info-grid">
                    <InfoItem label="Name">{t?.name || '-'}</InfoItem>
                    <InfoItem label="Applicant ID">{t?.applicantNo || '-'}</InfoItem>
                    <InfoItem label="Position">{t?.position || '-'}</InfoItem>
                    <InfoItem label="Email">{t?.email || '-'}</InfoItem>
                </div>
            </div>
            <div className="modal-section">
                <div className="modal-section-title"><Icon as={FileText} /> Resume Preview</div>
                <div style={{ padding: '1.25rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)', textAlign: 'center' }}>
                    {!t?.resumePath ? (
                        <>
                            <Icon as={FileType} style={{ fontSize: '3rem', color: 'var(--text-muted)' }} />
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.75rem' }}>No resume file is on record for this applicant.</p>
                        </>
                    ) : (
                        <>
                            {ext === 'pdf' ? (
                                <iframe key={resumeUrl} src={resumeUrl} title={`Resume of ${t.name}`} id="resumePreviewFrame"
                                    style={{ width: '100%', height: '480px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: '#fff' }} />
                            ) : (
                                <Icon as={FileType} style={{ fontSize: '3rem', color: 'var(--danger)' }} />
                            )}
                            <p style={{ marginTop: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }} id="resumeFileName">{fileName}</p>
                            {ext !== 'pdf' && (
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Word documents cannot be previewed in the browser. Download the file to open it.</p>
                            )}
                            <button type="button" id="resumeDownloadBtn" className="btn btn-sm btn-outline" style={{ marginTop: '1rem' }}
                                onClick={() => { window.location.href = `${resumeUrl}&download=1`; }}>
                                <Icon as={Download} /> Download Resume
                            </button>
                        </>
                    )}
                </div>
            </div>
            <div className="modal-section" id="resumeAiSection">
                <div className="modal-section-title"><Icon as={Star} /> Skills, Experience &amp; AI Results</div>
                {ai.state === 'loading' && <div id="resumeAiLoading" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Loading AI screening and recommendation results…</div>}
                {ai.state === 'none' && <div id="resumeAiUnavailable" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No AI Resume Screening / Job Recommendation data is available for this applicant.</div>}
                {ai.state === 'ready' && d && (
                    <div id="resumeAiContent" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        <div id="resumeAiEducationExperience" className="modal-info-grid">
                            {d.education && (
                                <>
                                    <InfoItem label="Highest Attainment">{d.education.highest_attainment || '-'}</InfoItem>
                                    <InfoItem label="School">{d.education.school || '-'}</InfoItem>
                                    <InfoItem label="Course">{d.education.course || '-'}</InfoItem>
                                </>
                            )}
                            {d.experience && (
                                <>
                                    <InfoItem label="Years of Experience">{d.experience.years_experience || '0'}</InfoItem>
                                    <InfoItem label="Previous Position">{d.experience.current_position || '-'}</InfoItem>
                                    <InfoItem label="Previous Company">{d.experience.previous_company || '-'}</InfoItem>
                                </>
                            )}
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>AI-Detected Skills</div>
                            <div id="resumeAiSkills" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                {skills.length
                                    ? skills.slice(0, 15).map((s, i) => <span className="tag tag-skill" key={i}>{s}</span>)
                                    : <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No skills extracted.</span>}
                            </div>
                        </div>
                        {d.screening?.ai_summary && (
                            <div id="resumeAiSummaryWrap">
                                <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>AI Resume Screening Summary</div>
                                <p id="resumeAiSummary" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{d.screening.ai_summary}</p>
                            </div>
                        )}
                        {d.screening?.job_evaluation && (() => {
                            const ev = d.screening.job_evaluation;
                            return (
                                <div id="resumeAiJobEvaluation">
                                    <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                                        Job Posting Requirements ({ev.job_posting_no} · {ev.job_title} — {ev.score}% match)
                                    </div>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>{ev.summary}</p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                        {ev.required_skills_matched.map(s => <span className="badge badge-success" key={`m-${s}`} title="Required skill found">{s}</span>)}
                                        {ev.required_skills_missing.map(s => <span className="badge badge-danger" key={`x-${s}`} title="Required skill not found">{s}</span>)}
                                        {ev.preferred_skills_matched.map(s => <span className="badge badge-info" key={`p-${s}`} title="Preferred skill found">{s}</span>)}
                                    </div>
                                </div>
                            );
                        })()}
                        {d.recommendation && (
                            <div id="resumeAiRecommendationWrap">
                                <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                                    AI Job Recommendation (<span id="resumeAiRecommendedJob">{`${d.recommendation.job_title || 'Selected Position'} — ${Math.round(Number(d.recommendation.match_score || 0))}% match`}</span>)
                                </div>
                                <div id="resumeAiRecommendationReasons" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                    {reasons.length
                                        ? reasons.map((r, i) => <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }} key={i}>{r}</div>)
                                        : <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No recommendation reasoning available.</div>}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
}
