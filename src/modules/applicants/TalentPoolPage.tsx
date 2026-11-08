import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Archive, Briefcase, Eye, FileText, History, Info, MessageSquare, Send, Sparkles, UserMinus, Users } from 'lucide-react';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import { Badge, EmptyRow, InfoItem, Page, PageHeader, PageState, SearchBox, StatCard, StatsGrid } from '../../components/ui';
import { usePageData } from '../../hooks/usePageData';
import { PREF_BADGE, talentBadge, talentService, type TalentMatch, type TalentRow } from '../../services/talentService';
import { ArchonAlert, confirmDialog, esc, promptText } from '../../utils/alerts';
import { phpMjY, phpMjYgiA, strimwidth } from '../../utils/format';
import { ApplicantViewModal } from './ApplicantActions';
import ResumeModal, { type ResumeTarget } from './ResumeModal';
import { ClearFilters, DateRangeFilter, FilterCount, FilterSelect, SortTh, distinct, inDateRange, is, matchesText, useFilters, useTableView } from '../../components/TableControls';
import { archiveApplicant, archiveReasonError, resumeTarget } from './RejectedApplicantsPage';
import { ApplicationHistoryModal, FeedbackModal } from './TalentModals';

/**
 * Applicant Management > Talent Pool: rejected applicants who agreed to be
 * contacted about future opportunities. HR picks a published Job Posting to
 * rank them with the AI job matching, reviews, and contacts the ones to invite
 * (an invitation to apply - never a job offer).
 */
export default function TalentPoolPage() {
    const { data, loading, error, retry, reload } = usePageData(talentService.poolPage);
    const [params, setParams] = useSearchParams();
    const [posting, setPosting] = useState(params.get('posting') ?? '');
    const [matches, setMatches] = useState<Record<number, TalentMatch> | null>(null);
    const [matching, setMatching] = useState(false);
    const filters = useFilters({ search: '', position: '', department: '', pref: '', status: '', from: '', to: '' });
    const fv = filters.values;
    const [viewId, setViewId] = useState<number | null>(null);
    const [historyOf, setHistoryOf] = useState<number | null>(null);
    const [feedbackOf, setFeedbackOf] = useState<TalentRow | null>(null);
    const [resume, setResume] = useState<ResumeTarget | null>(null);
    const [consider, setConsider] = useState<{ row: TalentRow; posting: string; match: TalentMatch | null; message: string } | null>(null);
    const [busy, setBusy] = useState(false);

    // AI job matching of the whole pool against the chosen Job Posting.
    const runMatch = async (id: string) => {
        setMatches(null);
        if (!id) return;
        setMatching(true);
        try {
            const res = await talentService.matches(Number(id));
            setMatches(Object.fromEntries(res.candidates.map(c => [c.id, c])));
        } catch (e) {
            await ArchonAlert.error(e instanceof Error ? e.message : 'The matching could not be run.');
        } finally {
            setMatching(false);
        }
    };
    useEffect(() => { void runMatch(posting); if (posting) setParams({ posting }, { replace: true }); }, [posting, data]); // eslint-disable-line react-hooks/exhaustive-deps

    const list = useMemo(() => data?.applicants ?? [], [data]);
    // With an AI match for a posting, the best matches come first until a column is sorted.
    const ordered = useMemo(() => (matches ? [...list].sort((x, y) => (matches[y.id]?.match_score ?? -1) - (matches[x.id]?.match_score ?? -1)) : list), [list, matches]);
    const view = useTableView(ordered, a => matchesText(fv.search, a.applicant_no, a.full_name, a.position, a.department, a.skills, a.qualifications, a.experience)
        && is(fv.position, a.position) && is(fv.department, a.department) && is(fv.pref, a.future_pref) && is(fv.status, a.talent_pool_status)
        && inDateRange(a.applied_at, fv.from, fv.to), {
        name: a => a.full_name, no: a => a.applicant_no, match: a => matches?.[a.id]?.match_score ?? null, position: a => a.position, department: a => a.department,
        applied: a => a.applied_at, reason: a => a.rejection_category ?? a.rejection_reason, pref: a => a.future_pref, status: a => a.talent_pool_status,
        contacted: a => a.last_contacted_at,
    });
    const rows = view.rows;

    const openConsider = async (row: TalentRow, postingId = posting) => {
        let match: TalentMatch | null = null;
        if (postingId) {
            try { match = (await talentService.matches(Number(postingId))).candidates.find(c => c.id === row.id) ?? null; } catch { /* shown as no match */ }
        }
        setConsider({ row, posting: postingId, match, message: '' });
    };
    const changeConsiderPosting = async (id: string) => {
        if (!consider) return;
        let match: TalentMatch | null = null;
        if (id) {
            try { match = (await talentService.matches(Number(id))).candidates.find(c => c.id === consider.row.id) ?? null; } catch { /* none */ }
        }
        setConsider({ ...consider, posting: id, match });
    };
    const contact = async () => {
        if (!consider) return;
        if (!consider.posting) { await ArchonAlert.warning('Please choose the job posting.', { title: 'Job Posting' }); return; }
        if (/[<>]/.test(consider.message)) { await ArchonAlert.warning('Please do not use < or > characters.'); return; }
        const p = data?.postings.find(x => String(x.id) === consider.posting);
        const ok = await confirmDialog({
            title: 'Contact Applicant',
            paragraphs: [`Send ${consider.row.full_name} an invitation to apply for ${p?.title} (${p?.posting_no})? This is a Future Job Opportunity, not a job offer: if they accept, a new application starts in Applicant Validation.`],
            icon: 'question', confirmText: 'Send Invitation',
        });
        if (!ok) return;
        setBusy(true);
        try {
            const res = await talentService.contact(consider.row.id, Number(consider.posting), consider.message.trim());
            setConsider(null);
            await ArchonAlert.success(res.message, { timer: 2600 });
            await reload();
        } catch (e) {
            await ArchonAlert.error(e instanceof Error ? e.message : 'The applicant could not be contacted.');
        } finally {
            setBusy(false);
        }
    };
    const remove = async (a: TalentRow) => {
        const reason = await promptText({
            title: 'Remove from Talent Pool', html: `<p>Remove <strong>${esc(a.full_name)}</strong> from the Talent Pool? Their applications and history are kept.</p>`,
            label: 'Reason', placeholder: 'e.g., Profile no longer matches our hiring needs.', confirmText: 'Remove', danger: true, validate: archiveReasonError,
        });
        if (reason === null) return;
        try {
            const res = await talentService.removeFromPool(a.id, reason);
            await ArchonAlert.success(res.message, { timer: 1800 });
            await reload();
        } catch (e) {
            await ArchonAlert.error(e instanceof Error ? e.message : 'The applicant could not be removed.');
        }
    };

    const selected = data?.postings.find(p => String(p.id) === posting);
    const count = (s: string) => list.filter(a => a.talent_pool_status === s).length;

    return (
        <Page id="talent-pool">
            <PageHeader title="Talent Pool" subtitle="Previously rejected applicants who agreed to be contacted about future opportunities" />
            <PageState loading={loading} error={error} onRetry={retry} />
            {data && (
                <>
                    <StatsGrid>
                        <StatCard icon={Users} gradient={['#34d399', '#10b981']} value={list.length} label="In the Talent Pool" />
                        <StatCard icon={Sparkles} gradient={['#60a5fa', '#3b82f6']} value={count('Active')} label="Available to Contact" />
                        <StatCard icon={Send} gradient={['#a78bfa', '#7c3aed']} value={count('Contacted')} label="Opportunity Offered" />
                        <StatCard icon={Briefcase} gradient={['#fbbf24', '#f59e0b']} value={count('Re-applied')} label="Re-applied (New Application)" />
                    </StatsGrid>
                    <div className="card hover-card" id="tpMatchCard" style={{ marginBottom: '1.25rem' }}>
                        <div className="card-body" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            <div style={{ flex: '1 1 320px' }}>
                                <label htmlFor="tpPosting" style={{ fontWeight: 600, fontSize: '0.85rem' }}><Icon as={Sparkles} /> Find potential candidates for a job posting (AI Job Matching)</label>
                                <select className="form-select" id="tpPosting" style={{ width: '100%', marginTop: '0.35rem' }} value={posting} onChange={e => setPosting(e.target.value)}>
                                    <option value="">Choose a published job posting&hellip;</option>
                                    {data.postings.map(p => <option key={p.id} value={p.id}>{p.posting_no} · {p.title} ({p.department})</option>)}
                                </select>
                            </div>
                            <p style={{ flex: '1 1 300px', margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                <Icon as={Info} /> The AI ranks the pool by skills, experience and qualifications against the posting's requirements. It never contacts, hires or makes an offer: HR reviews and decides whom to contact.
                            </p>
                        </div>
                    </div>
                    <div className="page-toolbar"><div className="toolbar-left">
                        <SearchBox value={fv.search} onChange={filters.set('search')} placeholder="Search name, skills, position..." id="tpSearch" />
                        <FilterSelect id="tpPositionFilter" label="Positions" value={fv.position} onChange={filters.set('position')} options={distinct(list, a => a.position)} />
                        <FilterSelect id="tpDepartmentFilter" label="Departments" value={fv.department} onChange={filters.set('department')} options={distinct(list, a => a.department)} />
                        <FilterSelect id="tpStatusFilter" label="Pool Statuses" value={fv.status} onChange={filters.set('status')} options={distinct(list, a => a.talent_pool_status)} />
                        <FilterSelect id="tpPrefFilter" label="Preferences" value={fv.pref} onChange={filters.set('pref')} options={distinct(list, a => a.future_pref)} />
                        <DateRangeFilter id="tpDate" label="Applied" from={fv.from} to={fv.to} onFrom={filters.set('from')} onTo={filters.set('to')} />
                        <ClearFilters id="tpClear" active={filters.active} onClear={filters.clear} />
                        <FilterCount shown={rows.length} total={list.length} />
                    </div></div>
                    {matching && <p style={{ color: 'var(--text-secondary)' }}>Matching the Talent Pool against {selected?.title}&hellip;</p>}
                    <div className="card hover-card">
                        <div className="card-body no-padding">
                            <table className="data-table" id="talentPoolTable">
                                <thead>
                                    <tr>
                                        <SortTh view={view} k="name">Applicant Name</SortTh><SortTh view={view} k="no">Applicant ID</SortTh>{matches && <SortTh view={view} k="match">AI Match{selected ? ` · ${selected.posting_no}` : ''}</SortTh>}
                                        <SortTh view={view} k="position">Previous Position</SortTh><SortTh view={view} k="department">Previous Department</SortTh><th>Skills</th><th>Work Experience</th><th>Qualifications</th>
                                        <SortTh view={view} k="applied">Previous Application Date</SortTh><SortTh view={view} k="reason">Rejection Reason</SortTh><SortTh view={view} k="pref">Future Opportunity Preference</SortTh>
                                        <SortTh view={view} k="status">Talent Pool Status</SortTh><SortTh view={view} k="contacted">Last Contacted</SortTh><th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {!rows.length ? <EmptyRow colSpan={matches ? 14 : 13}>{list.length ? 'No records found. Try other filters or clear them.' : 'The Talent Pool is empty. Rejected applicants join it when they agree to be contacted about future opportunities.'}</EmptyRow>
                                        : rows.map(a => {
                                            const m = matches?.[a.id];
                                            return (
                                                <tr className="hover-row" key={a.id} data-id={a.id}>
                                                    <td><strong>{a.full_name}</strong></td>
                                                    <td style={{ whiteSpace: 'nowrap' }}>{a.applicant_no}</td>
                                                    {matches && <td style={{ minWidth: 150 }}>{m?.match_score !== null && m?.match_score !== undefined ? <><strong style={{ fontSize: '1rem' }}>{m.match_score}%</strong>
                                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{m.match_summary}</div></> : <span style={{ color: 'var(--text-muted)' }}>No AI profile</span>}
                                                        {m?.invitation_status && <div><Badge variant="badge-info">Invited: {m.invitation_status}</Badge></div>}</td>}
                                                    <td>{a.position}</td>
                                                    <td>{a.department ?? '—'}</td>
                                                    <td style={{ maxWidth: 200, fontSize: '0.8rem' }} title={a.skills}>{strimwidth(a.skills, 70) || '—'}</td>
                                                    <td style={{ maxWidth: 180, fontSize: '0.8rem' }}>{a.experience || '—'}</td>
                                                    <td style={{ maxWidth: 180, fontSize: '0.8rem' }}>{a.qualifications || '—'}</td>
                                                    <td style={{ whiteSpace: 'nowrap' }}>{phpMjY(a.applied_at)}</td>
                                                    <td style={{ maxWidth: 200, fontSize: '0.8rem' }} title={a.rejection_reason ?? ''}><strong>{a.rejection_category ?? ''}</strong> {strimwidth(a.rejection_reason, 50)}</td>
                                                    <td>{a.future_pref && <Badge variant={PREF_BADGE[a.future_pref]}>{a.future_pref}</Badge>}</td>
                                                    <td><Badge variant={talentBadge(a.display_status)}>{a.talent_pool_status}</Badge>
                                                        {a.last_opportunity && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{a.last_opportunity.opportunity_no} · {a.last_opportunity.status}</div>}</td>
                                                    <td style={{ whiteSpace: 'nowrap' }}>{a.last_contacted_at ? phpMjY(a.last_contacted_at) : '—'}</td>
                                                    <td style={{ whiteSpace: 'nowrap' }}>
                                                        <button className="table-action-btn" title="View" onClick={() => setViewId(a.id)}><Icon as={Eye} /></button>
                                                        <button className="table-action-btn" title="View Resume" disabled={!a.resume_path} onClick={() => setResume(resumeTarget(a))}><Icon as={FileText} /></button>
                                                        <button className="table-action-btn" title="View Application History" onClick={() => setHistoryOf(a.id)}><Icon as={History} /></button>
                                                        <button className="table-action-btn" title="View Feedback" onClick={() => setFeedbackOf(a)}><Icon as={MessageSquare} /></button>
                                                        <button className="table-action-btn btn-tp-consider" title={a.talent_pool_status === 'Active' ? 'Consider for Job / Contact Applicant' : 'Already contacted'} disabled={a.talent_pool_status !== 'Active'}
                                                            style={{ color: 'var(--accent)' }} onClick={() => void openConsider(a)}><Icon as={Send} /></button>
                                                        <button className="table-action-btn btn-tp-remove" title="Remove from Talent Pool" disabled={a.talent_pool_status !== 'Active'} onClick={() => void remove(a)}><Icon as={UserMinus} /></button>
                                                        <button className="table-action-btn" title="Archive" disabled={a.talent_pool_status !== 'Active'} onClick={() => void archiveApplicant(a, () => void reload())}><Icon as={Archive} /></button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            <Modal open={!!consider} onClose={() => setConsider(null)} size="lg" title={<><Icon as={Send} /> Consider for Job · {consider?.row.full_name}</>}
                footer={<>
                    <button className="btn btn-outline" onClick={() => setConsider(null)}>Cancel</button>
                    <button className="btn btn-primary" id="tpContactBtn" disabled={busy || !consider?.posting || !!consider?.match?.applied_for_posting} onClick={() => void contact()}><Icon as={Send} /> Contact Applicant</button>
                </>}>
                {consider && data && (
                    <>
                        <div className="form-group">
                            <label htmlFor="tpConsiderPosting">Job Posting (published)</label>
                            <select className="form-input" id="tpConsiderPosting" value={consider.posting} onChange={e => void changeConsiderPosting(e.target.value)}>
                                <option value="">Choose a job posting&hellip;</option>
                                {data.postings.map(p => <option key={p.id} value={p.id}>{p.posting_no} · {p.title} ({p.department})</option>)}
                            </select>
                        </div>
                        {consider.posting && (
                            <div className="modal-section" id="tpConsiderMatch">
                                <h4 className="modal-section-title"><Icon as={Sparkles} /> AI Job Matching</h4>
                                {consider.match ? (
                                    <div className="modal-info-grid">
                                        <InfoItem label="Match Score">{consider.match.match_score !== null ? `${consider.match.match_score}%` : 'No AI profile available'}</InfoItem>
                                        <InfoItem label="Summary">{consider.match.match_summary}</InfoItem>
                                        <InfoItem label="Matched Skills">{consider.match.skills_matched.join(', ') || '—'}</InfoItem>
                                        <InfoItem label="Missing Skills">{consider.match.skills_missing.join(', ') || '—'}</InfoItem>
                                        {consider.match.applied_for_posting && <InfoItem label="Note" full><span style={{ color: 'var(--danger)' }}>This applicant already has an application for this posting.</span></InfoItem>}
                                    </div>
                                ) : <p style={{ color: 'var(--text-secondary)' }}>No match information.</p>}
                            </div>
                        )}
                        <div className="form-group">
                            <label htmlFor="tpMessage">Message to the applicant (optional)</label>
                            <textarea className="form-input" id="tpMessage" maxLength={1000} style={{ minHeight: 80, resize: 'vertical' }} value={consider.message}
                                onChange={e => setConsider({ ...consider, message: e.target.value })} placeholder="e.g., Your sales experience fits this new role well." />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>The applicant receives "We have a new position that may match your skills and experience" with Accept / Decline Opportunity. This is not a job offer.</span>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>Previous application: {consider.row.position} · rejected {consider.row.rejected_at ? phpMjYgiA(consider.row.rejected_at) : ''} ({consider.row.rejection_category ?? 'n/a'})</p>
                    </>
                )}
            </Modal>
            <ApplicantViewModal applicantId={viewId} stage="Validation" onClose={() => setViewId(null)} onRejected={() => void reload()} />
            <ApplicationHistoryModal applicantId={historyOf} onClose={() => setHistoryOf(null)} />
            <FeedbackModal applicantId={feedbackOf?.id ?? null} name={feedbackOf?.full_name} onClose={() => setFeedbackOf(null)} />
            <ResumeModal target={resume} onClose={() => setResume(null)} />
        </Page>
    );
}
