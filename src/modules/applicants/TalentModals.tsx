import { useEffect, useState } from 'react';
import { History, Lock, MessageSquare, Save, Star } from 'lucide-react';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import { Badge, EmptyRow } from '../../components/ui';
import { HR_FEEDBACK_FIELDS, talentBadge, talentService, type ApplicantHistory } from '../../services/talentService';
import { ArchonAlert } from '../../utils/alerts';
import { phpMjY, phpMjYgiA } from '../../utils/format';

function useHistory(applicantId: number | null) {
    const [data, setData] = useState<ApplicantHistory | null>(null);
    const [error, setError] = useState('');
    const load = () => {
        if (!applicantId) return;
        talentService.history(applicantId).then(setData).catch(e => setError(e instanceof Error ? e.message : 'Could not load the history.'));
    };
    useEffect(() => { setData(null); setError(''); load(); }, [applicantId]); // eslint-disable-line react-hooks/exhaustive-deps
    return { data, error, reload: load };
}

/** Every application of the same person (same e-mail + date of birth) and their future opportunities. */
export function ApplicationHistoryModal({ applicantId, onClose }: { applicantId: number | null; onClose: () => void }) {
    const { data, error } = useHistory(applicantId);
    return (
        <Modal open={!!applicantId} onClose={onClose} size="lg" title={<><Icon as={History} /> Application History</>}
            footer={<button className="btn btn-outline" onClick={onClose}>Close</button>}>
            {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
            {!data && !error && <p style={{ color: 'var(--text-secondary)' }}>Loading&hellip;</p>}
            {data && (
                <>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 0 }}>All applications of this applicant (same e-mail address and date of birth). Each keeps its own position, stage, result and feedback.</p>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table" id="historyApplications">
                            <thead><tr><th>Applicant ID</th><th>Position</th><th>Department</th><th>Applied</th><th>Result</th><th>Rejection Reason</th><th>Source</th></tr></thead>
                            <tbody>
                                {data.applications.map(a => (
                                    <tr key={a.id} data-id={a.id} style={a.id === applicantId ? { background: 'var(--bg-secondary)' } : undefined}>
                                        <td style={{ whiteSpace: 'nowrap' }}><strong>{a.applicant_no ?? `#${a.id}`}</strong>{a.id === applicantId && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>this application</div>}</td>
                                        <td>{a.position}{a.job_posting_no && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{a.job_posting_no}</div>}</td>
                                        <td>{a.department ?? '—'}</td>
                                        <td style={{ whiteSpace: 'nowrap' }}>{phpMjY(a.applied_at)}</td>
                                        <td><Badge variant={talentBadge(a.display_status)}>{a.display_status}</Badge>{a.rejection_stage && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>at {a.rejection_stage}</div>}</td>
                                        <td style={{ maxWidth: 220 }}>{a.rejection_category ? <><strong>{a.rejection_category}</strong><div style={{ fontSize: '0.78rem' }}>{a.rejection_reason}</div></> : '—'}</td>
                                        <td>{a.origin_applicant_id ? 'Talent Pool' : 'Careers portal'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <h4 className="modal-section-title" style={{ marginTop: '1.25rem' }}>Future Job Opportunities</h4>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table" id="historyOpportunities">
                            <thead><tr><th>Opportunity</th><th>Job Posting</th><th>AI Match</th><th>Sent</th><th>Status</th><th>Answered</th></tr></thead>
                            <tbody>
                                {!data.opportunities.length ? <EmptyRow colSpan={6}>No future opportunities sent yet.</EmptyRow> : data.opportunities.map(o => (
                                    <tr key={o.id}>
                                        <td><strong>{o.opportunity_no}</strong></td>
                                        <td>{o.posting_no} · {o.title}</td>
                                        <td>{o.match_score !== null ? `${Math.round(Number(o.match_score))}%` : '—'}</td>
                                        <td style={{ whiteSpace: 'nowrap' }}>{phpMjY(o.sent_at)}</td>
                                        <td><Badge variant={o.status === 'Accepted' ? 'badge-success' : o.status === 'Invited' ? 'badge-info' : o.status === 'Declined' ? 'badge-danger' : 'badge-secondary'}>{o.status}</Badge></td>
                                        <td style={{ whiteSpace: 'nowrap' }}>{o.responded_at ? phpMjY(o.responded_at) : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </Modal>
    );
}

/** Internal HR feedback (HR only) and the applicant's own feedback on the recruitment experience. */
export function FeedbackModal({ applicantId, name, onClose, onChanged }: { applicantId: number | null; name?: string; onClose: () => void; onChanged?: () => void }) {
    const { data, error, reload } = useHistory(applicantId);
    const [adding, setAdding] = useState(false);
    const [form, setForm] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    useEffect(() => { setAdding(false); setForm({}); }, [applicantId]);
    const save = async () => {
        if (!applicantId) return;
        if (!Object.values(form).some(v => v.trim())) { await ArchonAlert.warning('Please fill in at least one feedback field.', { title: 'Missing Information' }); return; }
        if (Object.values(form).some(v => /[<>]/.test(v))) { await ArchonAlert.warning('Please do not use < or > characters.', { title: 'Check the Feedback' }); return; }
        setBusy(true);
        try {
            const res = await talentService.addHrFeedback(applicantId, form);
            setAdding(false);
            setForm({});
            await ArchonAlert.success(res.message, { timer: 1800 });
            reload();
            onChanged?.();
        } catch (e) {
            await ArchonAlert.error(e instanceof Error ? e.message : 'The feedback could not be saved.');
        } finally {
            setBusy(false);
        }
    };
    const af = data?.applicant_feedback;
    return (
        <Modal open={!!applicantId} onClose={onClose} size="lg" title={<><Icon as={MessageSquare} /> Feedback{name ? ` · ${name}` : ''}</>}
            footer={<>
                <button className="btn btn-outline" onClick={onClose}>Close</button>
                {!adding ? <button className="btn btn-primary" id="fbAddBtn" onClick={() => setAdding(true)}><Icon as={MessageSquare} /> Add HR Feedback</button>
                    : <button className="btn btn-primary" id="fbSaveBtn" disabled={busy} onClick={() => void save()}><Icon as={Save} /> Save Feedback</button>}
            </>}>
            {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
            {data && (
                <>
                    <div className="modal-section" id="fbHrSection">
                        <h4 className="modal-section-title"><Icon as={Lock} /> Internal HR Feedback <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-muted)' }}>(private: never shown to the applicant)</span></h4>
                        {adding && (
                            <form className="modal-form-grid" id="hrFeedbackForm" onSubmit={e => e.preventDefault()} style={{ marginBottom: '1rem' }}>
                                {HR_FEEDBACK_FIELDS.map(([k, l]) => (
                                    <div className="form-group full-width" key={k}>
                                        <label htmlFor={'fb_' + k}>{l}</label>
                                        <textarea className="form-input" id={'fb_' + k} maxLength={2000} style={{ minHeight: 56, resize: 'vertical' }} value={form[k] ?? ''}
                                            onChange={e => setForm({ ...form, [k]: e.target.value })} />
                                    </div>
                                ))}
                            </form>
                        )}
                        {!data.hr_feedback.length ? <p style={{ color: 'var(--text-secondary)' }}>No internal HR feedback yet.</p> : data.hr_feedback.map(f => (
                            <div key={f.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '0.75rem 0.9rem', marginBottom: '0.75rem' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>{phpMjYgiA(f.created_at)}{f.created_by_name ? ` · ${f.created_by_name}` : ''}</div>
                                {HR_FEEDBACK_FIELDS.filter(([k]) => f[k]).map(([k, l]) => (
                                    <div key={k} style={{ marginBottom: '0.35rem' }}><strong style={{ fontSize: '0.8rem' }}>{l}:</strong> <span style={{ whiteSpace: 'pre-line' }}>{f[k]}</span></div>
                                ))}
                            </div>
                        ))}
                    </div>
                    <div className="modal-section" id="fbApplicantSection">
                        <h4 className="modal-section-title"><Icon as={Star} /> Applicant Feedback <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-muted)' }}>(the applicant's view of the recruitment process)</span></h4>
                        {!af ? <p style={{ color: 'var(--text-secondary)' }}>The applicant has not shared feedback yet (optional, from the Applicant Portal after the application is decided).</p> : (
                            <div className="modal-info-grid">
                                {Object.entries(data.ratings).map(([k, l]) => (
                                    <div className="info-item" key={k}><div className="info-label">{l}</div><div className="info-value">{af[k] ? `${'★'.repeat(Number(af[k]))}${'☆'.repeat(5 - Number(af[k]))} ${af[k]}/5` : '—'}</div></div>
                                ))}
                                <div className="info-item full-width"><div className="info-label">Additional Comments</div><div className="info-value" style={{ whiteSpace: 'pre-line' }}>{af.comments || '—'}</div></div>
                                <div className="info-item"><div className="info-label">Submitted</div><div className="info-value">{phpMjYgiA(af.submitted_at)}</div></div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </Modal>
    );
}
