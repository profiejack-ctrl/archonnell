import { useMemo, useState } from 'react';
import { Archive, Clock, Eye, FileText, History, MessageSquare, UserMinus, UserPlus, Users, XCircle } from 'lucide-react';
import Icon from '../../components/Icon';
import { Badge, EmptyRow, Page, PageHeader, PageState, SearchBox, StatCard, StatsGrid } from '../../components/ui';
import { usePageData } from '../../hooks/usePageData';
import { PREF_BADGE, talentBadge, talentService, type TalentRow } from '../../services/talentService';
import { ArchonAlert, confirmDialog, esc, promptText } from '../../utils/alerts';
import { phpMjY, strimwidth } from '../../utils/format';
import { ApplicantViewModal } from './ApplicantActions';
import ResumeModal, { type ResumeTarget } from './ResumeModal';
import { ClearFilters, DateRangeFilter, FilterCount, FilterSelect, SortTh, distinct, inDateRange, is, matchesText, useFilters, useTableView } from '../../components/TableControls';
import { ApplicationHistoryModal, FeedbackModal } from './TalentModals';

/** Archive reason: 5-500 characters, no < or >. */
export const archiveReasonError = (v: string) => {
    const t = v.replace(/\s+/g, ' ').trim();
    if (t.length < 5) return 'Please enter the reason for archiving (at least 5 characters).';
    return /[<>]/.test(t) ? 'Please do not use < or > characters.' : '';
};

export async function archiveApplicant(a: TalentRow, done: () => void) {
    const reason = await promptText({
        title: 'Archive Applicant',
        html: `<p>Archive <strong>${esc(a.full_name)}</strong> (${esc(a.applicant_no ?? '')}, ${esc(a.position)})?</p><p>The record and its full history are kept in Archived Applicants and can be restored. Nothing is deleted.</p>`,
        label: 'Archive Reason', placeholder: 'e.g., Application closed; no further recruitment activity.', confirmText: 'Archive', validate: archiveReasonError,
    });
    if (reason === null) return;
    try {
        const res = await talentService.archive(a.id, reason);
        await ArchonAlert.success(res.message, { timer: 2000 });
        done();
    } catch (e) {
        await ArchonAlert.error(e instanceof Error ? e.message : 'The applicant could not be archived.');
    }
}

export const resumeTarget = (a: TalentRow): ResumeTarget => ({
    dbId: a.id, applicantNo: a.applicant_no ?? '', name: a.full_name, position: a.position, email: a.email ?? '', resumePath: a.resume_path ?? '',
});

/**
 * Applicant Management > Rejected Applicants: applications not selected for
 * their position. The record stays complete; the applicant can be invited to
 * future opportunities (they decide) or archived.
 */
export default function RejectedApplicantsPage() {
    const { data, loading, error, retry, reload } = usePageData(talentService.rejectedPage);
    const filters = useFilters({ search: '', stage: '', pref: '', position: '', department: '', from: '', to: '' });
    const { search, stage, pref } = filters.values;
    const [viewId, setViewId] = useState<number | null>(null);
    const [historyOf, setHistoryOf] = useState<number | null>(null);
    const [feedbackOf, setFeedbackOf] = useState<TalentRow | null>(null);
    const [resume, setResume] = useState<ResumeTarget | null>(null);
    const [busy, setBusy] = useState(false);

    const list = useMemo(() => data?.applicants ?? [], [data]);
    const view = useTableView(list, a => (!stage || a.rejection_stage === stage) && (!pref || (pref === 'none' ? !a.future_pref : a.future_pref === pref))
        && is(filters.values.position, a.position) && is(filters.values.department, a.department) && inDateRange(a.rejected_at, filters.values.from, filters.values.to)
        && matchesText(search, a.applicant_no, a.full_name, a.position, a.department, a.rejection_category, a.rejection_reason, a.job_posting_no), {
        name: a => a.full_name, position: a => a.position, department: a => a.department, applied: a => a.applied_at, rejected: a => a.rejected_at,
        stage: a => a.rejection_stage, reason: a => a.rejection_category ?? a.rejection_reason, pref: a => a.future_pref ?? '', feedback: a => a.feedback_status,
    }, { key: 'rejected', dir: 'desc' });
    const rows = view.rows;
    const count = (f: (a: TalentRow) => boolean) => list.filter(f).length;
    const canAdd = (a: TalentRow) => a.future_pref === null || (a.future_pref === 'Agreed' && (a.talent_pool_status === 'Removed' || a.talent_pool_status === null));

    const addToPool = async (a: TalentRow) => {
        const invite = a.future_pref === null;
        const ok = await confirmDialog({
            title: 'Add to Talent Pool',
            paragraphs: [invite
                ? `${a.full_name} has not been asked yet. An e-mail invites them to be considered for future opportunities; they join the Talent Pool only if they answer Yes.`
                : `${a.full_name} agreed to future contact before. Add them back to the Talent Pool?`],
            icon: 'question', confirmText: invite ? 'Send Invitation' : 'Add to Talent Pool',
        });
        if (!ok) return;
        setBusy(true);
        try {
            const res = await talentService.addToPool(a.id);
            await ArchonAlert.success(res.message, { timer: 2400 });
            await reload();
        } catch (e) {
            await ArchonAlert.error(e instanceof Error ? e.message : 'The applicant could not be added.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Page id="rejected-applicants">
            <PageHeader title="Rejected Applicants" subtitle="Applications not selected for their position, with the reason, feedback and future opportunity preference" />
            <PageState loading={loading} error={error} onRetry={retry} />
            {data && (
                <>
                    <StatsGrid>
                        <StatCard icon={XCircle} gradient={['#f87171', '#ef4444']} value={list.length} label="Rejected Applications" />
                        <StatCard icon={Clock} gradient={['#fbbf24', '#f59e0b']} value={count(a => a.future_pref === 'Pending Response')} label="Awaiting Future Opportunity Answer" />
                        <StatCard icon={Users} gradient={['#34d399', '#10b981']} value={count(a => a.future_pref === 'Agreed')} label="Agreed (Talent Pool)" />
                        <StatCard icon={UserMinus} gradient={['#94a3b8', '#64748b']} value={count(a => a.future_pref === 'Declined')} label="No Future Contact" />
                    </StatsGrid>
                    <div className="page-toolbar">
                        <div className="toolbar-left">
                            <SearchBox value={search} onChange={filters.set('search')} placeholder="Search name, position, reason..." id="rjSearch" />
                            <select className="form-select" id="rjStageFilter" value={stage} onChange={e => filters.set('stage')(e.target.value)}>
                                <option value="">All Stages</option>
                                {['Applicant Validation', 'Pre-Interview', 'Final Interview'].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <select className="form-select" id="rjPrefFilter" value={pref} onChange={e => filters.set('pref')(e.target.value)}>
                                <option value="">All Preferences</option>
                                <option value="none">Not invited</option>
                                <option value="Pending Response">Pending Response</option>
                                <option value="Agreed">Agreed</option>
                                <option value="Declined">Declined</option>
                            </select>
                            <FilterSelect id="rjPositionFilter" label="Positions" value={filters.values.position} onChange={filters.set('position')} options={distinct(list, a => a.position)} />
                            <FilterSelect id="rjDepartmentFilter" label="Departments" value={filters.values.department} onChange={filters.set('department')} options={distinct(list, a => a.department)} />
                            <DateRangeFilter id="rjDate" label="Rejected" from={filters.values.from} to={filters.values.to} onFrom={filters.set('from')} onTo={filters.set('to')} />
                            <ClearFilters id="rjClear" active={filters.active} onClear={filters.clear} />
                            <FilterCount shown={rows.length} total={list.length} />
                        </div>
                    </div>
                    <div className="card hover-card">
                        <div className="card-body no-padding">
                            <table className="data-table" id="rejectedApplicantsTable">
                                <thead>
                                    <tr><SortTh view={view} k="name">Applicant Name</SortTh><SortTh view={view} k="position">Applied Position</SortTh><SortTh view={view} k="department">Department</SortTh>
                                        <SortTh view={view} k="applied">Application Date</SortTh><SortTh view={view} k="rejected">Rejection Date</SortTh>
                                        <SortTh view={view} k="stage">Recruitment Stage</SortTh><SortTh view={view} k="reason">Rejection Reason</SortTh>
                                        <SortTh view={view} k="pref">Future Opportunity Preference</SortTh><SortTh view={view} k="feedback">Feedback Status</SortTh><th>Actions</th></tr>
                                </thead>
                                <tbody>
                                    {!rows.length ? <EmptyRow colSpan={10}>{list.length ? 'No records found. Try other filters or clear them.' : 'No rejected applicants.'}</EmptyRow> : rows.map(a => (
                                        <tr className="hover-row" key={a.id} data-id={a.id}>
                                            <td><strong>{a.full_name}</strong><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{a.applicant_no}</div></td>
                                            <td>{a.position}{a.job_posting_no && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{a.job_posting_no}</div>}</td>
                                            <td>{a.department ?? '—'}</td>
                                            <td style={{ whiteSpace: 'nowrap' }}>{phpMjY(a.applied_at)}</td>
                                            <td style={{ whiteSpace: 'nowrap' }}>{a.rejected_at ? phpMjY(a.rejected_at) : '—'}</td>
                                            <td>{a.rejection_stage ?? '—'}</td>
                                            <td style={{ maxWidth: 240 }} title={a.rejection_reason ?? ''}>{a.rejection_category && <strong style={{ display: 'block' }}>{a.rejection_category}</strong>}
                                                <span style={{ fontSize: '0.8rem' }}>{strimwidth(a.rejection_reason, 80) || '—'}</span></td>
                                            <td>{a.future_pref ? <Badge variant={PREF_BADGE[a.future_pref]}>{a.future_pref}</Badge> : <span style={{ color: 'var(--text-muted)' }}>Not invited</span>}
                                                {a.talent_pool_status && <div style={{ marginTop: 4 }}><Badge variant={talentBadge(a.display_status)}>{a.display_status}</Badge></div>}</td>
                                            <td style={{ fontSize: '0.8rem' }}>{a.feedback_status}</td>
                                            <td style={{ whiteSpace: 'nowrap' }}>
                                                <button className="table-action-btn btn-rj-view" title="View (incl. rejection reason)" onClick={() => setViewId(a.id)}><Icon as={Eye} /></button>
                                                <button className="table-action-btn" title="View Resume" disabled={!a.resume_path} onClick={() => setResume(resumeTarget(a))}><Icon as={FileText} /></button>
                                                <button className="table-action-btn btn-rj-history" title="Application History" onClick={() => setHistoryOf(a.id)}><Icon as={History} /></button>
                                                <button className="table-action-btn btn-rj-feedback" title="View Feedback" onClick={() => setFeedbackOf(a)}><Icon as={MessageSquare} /></button>
                                                {canAdd(a) && <button className="table-action-btn btn-rj-pool" title="Add to Talent Pool (with the applicant's consent)" disabled={busy} style={{ color: 'var(--success)' }} onClick={() => void addToPool(a)}><Icon as={UserPlus} /></button>}
                                                <button className="table-action-btn btn-rj-archive" title="Archive" onClick={() => void archiveApplicant(a, () => void reload())}><Icon as={Archive} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
            <ApplicantViewModal applicantId={viewId} stage="Validation" onClose={() => setViewId(null)} onRejected={() => void reload()} />
            <ApplicationHistoryModal applicantId={historyOf} onClose={() => setHistoryOf(null)} />
            <FeedbackModal applicantId={feedbackOf?.id ?? null} name={feedbackOf?.full_name} onClose={() => setFeedbackOf(null)} onChanged={() => void reload()} />
            <ResumeModal target={resume} onClose={() => setResume(null)} />
        </Page>
    );
}
