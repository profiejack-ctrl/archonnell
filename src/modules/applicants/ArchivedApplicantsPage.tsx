import { useState } from 'react';
import { ArchiveRestore, Eye, FileText, History } from 'lucide-react';
import Icon from '../../components/Icon';
import { Badge, EmptyRow, Page, PageHeader, PageState, SearchBox } from '../../components/ui';
import { usePageData } from '../../hooks/usePageData';
import { talentBadge, talentService } from '../../services/talentService';
import { ArchonAlert, confirmDialog } from '../../utils/alerts';
import { phpMjY } from '../../utils/format';
import { ApplicantViewModal } from './ApplicantActions';
import ResumeModal, { type ResumeTarget } from './ResumeModal';
import { ClearFilters, DateRangeFilter, FilterCount, FilterSelect, SortTh, distinct, inDateRange, is, matchesText, useFilters, useTableView } from '../../components/TableControls';
import { resumeTarget } from './RejectedApplicantsPage';
import { ApplicationHistoryModal } from './TalentModals';

/**
 * Applicant Management > Archived Applicants: applications no longer in the
 * recruitment workflow. Kept with their full history; Restore brings one back.
 */
export default function ArchivedApplicantsPage() {
    const { data, loading, error, retry, reload } = usePageData(talentService.archivedPage);
    const filters = useFilters({ search: '', position: '', department: '', status: '', from: '', to: '' });
    const fv = filters.values;
    const [viewId, setViewId] = useState<number | null>(null);
    const [historyOf, setHistoryOf] = useState<number | null>(null);
    const [resume, setResume] = useState<ResumeTarget | null>(null);
    const list = data?.applicants ?? [];
    const view = useTableView(list, a => matchesText(fv.search, a.applicant_no, a.full_name, a.position, a.department, a.archive_reason, a.archived_by_name)
        && is(fv.position, a.position) && is(fv.department, a.department) && is(fv.status, a.final_status) && inDateRange(a.archived_at, fv.from, fv.to), {
        name: a => a.full_name, position: a => a.position, department: a => a.department, applied: a => a.applied_at, status: a => a.final_status,
        archived: a => a.archived_at, by: a => a.archived_by_name, reason: a => a.archive_reason,
    }, { key: 'archived', dir: 'desc' });
    const rows = view.rows;

    const restore = async (id: number, name: string) => {
        const ok = await confirmDialog({ title: 'Restore Applicant', paragraphs: [`Restore ${name}? The application returns to Rejected Applicants (and the Talent Pool if they were in it).`], icon: 'question', confirmText: 'Restore' });
        if (!ok) return;
        try {
            const res = await talentService.restore(id);
            await ArchonAlert.success(res.message, { timer: 1600 });
            await reload();
        } catch (e) {
            await ArchonAlert.error(e instanceof Error ? e.message : 'The applicant could not be restored.');
        }
    };

    return (
        <Page id="archived-applicants">
            <PageHeader title="Archived Applicants" subtitle="Applications no longer in the recruitment workflow. Records and history are kept." />
            <PageState loading={loading} error={error} onRetry={retry} />
            {data && (
                <>
                    <div className="page-toolbar"><div className="toolbar-left">
                        <SearchBox value={fv.search} onChange={filters.set('search')} placeholder="Search name, applicant ID, reason..." id="arSearch" />
                        <FilterSelect id="arPositionFilter" label="Positions" value={fv.position} onChange={filters.set('position')} options={distinct(list, a => a.position)} />
                        <FilterSelect id="arDepartmentFilter" label="Departments" value={fv.department} onChange={filters.set('department')} options={distinct(list, a => a.department)} />
                        <FilterSelect id="arStatusFilter" label="Final Statuses" value={fv.status} onChange={filters.set('status')} options={distinct(list, a => a.final_status)} />
                        <DateRangeFilter id="arDate" label="Archived" from={fv.from} to={fv.to} onFrom={filters.set('from')} onTo={filters.set('to')} />
                        <ClearFilters id="arClear" active={filters.active} onClear={filters.clear} />
                        <FilterCount shown={rows.length} total={list.length} />
                    </div></div>
                    <div className="card hover-card">
                        <div className="card-body no-padding">
                            <table className="data-table" id="archivedApplicantsTable">
                                <thead><tr><SortTh view={view} k="name">Applicant Name</SortTh><SortTh view={view} k="position">Previous Position</SortTh><SortTh view={view} k="department">Department</SortTh>
                                    <SortTh view={view} k="applied">Application Date</SortTh><SortTh view={view} k="status">Final Status</SortTh><SortTh view={view} k="archived">Archive Date</SortTh>
                                    <SortTh view={view} k="by">Archived By</SortTh><SortTh view={view} k="reason">Archive Reason</SortTh><th>Actions</th></tr></thead>
                                <tbody>
                                    {!rows.length ? <EmptyRow colSpan={9}>{list.length ? 'No records found. Try other filters or clear them.' : 'No archived applicants.'}</EmptyRow> : rows.map(a => (
                                        <tr className="hover-row" key={a.id} data-id={a.id}>
                                            <td><strong>{a.full_name}</strong><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{a.applicant_no}</div></td>
                                            <td>{a.position}</td>
                                            <td>{a.department ?? '—'}</td>
                                            <td style={{ whiteSpace: 'nowrap' }}>{phpMjY(a.applied_at)}</td>
                                            <td><Badge variant={talentBadge(a.final_status)}>{a.final_status}</Badge></td>
                                            <td style={{ whiteSpace: 'nowrap' }}>{a.archived_at ? phpMjY(a.archived_at) : '—'}</td>
                                            <td>{a.archived_by_name ?? '—'}</td>
                                            <td style={{ maxWidth: 240 }}>{a.archive_reason ?? '—'}</td>
                                            <td style={{ whiteSpace: 'nowrap' }}>
                                                <button className="table-action-btn" title="View" onClick={() => setViewId(a.id)}><Icon as={Eye} /></button>
                                                <button className="table-action-btn" title="View Resume" disabled={!a.resume_path} onClick={() => setResume(resumeTarget(a))}><Icon as={FileText} /></button>
                                                <button className="table-action-btn" title="Application History" onClick={() => setHistoryOf(a.id)}><Icon as={History} /></button>
                                                <button className="table-action-btn btn-ar-restore" title="Restore" style={{ color: 'var(--success)' }} onClick={() => void restore(a.id, a.full_name)}><Icon as={ArchiveRestore} /></button>
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
            <ResumeModal target={resume} onClose={() => setResume(null)} />
        </Page>
    );
}
