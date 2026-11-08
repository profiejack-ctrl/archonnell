import { useEffect, useMemo, useState } from 'react';
import { Copy, Eye, Flag, Megaphone, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import { Badge, EmptyRow, Page, PageHeader, PageState, SearchBox } from '../../components/ui';
import { ClearFilters, DateRangeFilter, FilterCount, FilterSelect, SortTh, distinct, inDateRange, is, matchesText, useFilters, useTableView } from '../../components/TableControls';
import { usePageData } from '../../hooks/usePageData';
import { announcementService } from '../../services/announcementService';
import { backendUrl } from '../../services/http';
import { ArchonAlert, confirmDialog } from '../../utils/alerts';
import { annFormatDateTime, phpMjY, phpMjYgiA, strimwidth } from '../../utils/format';
import { AnnouncementFormModal, PreviewModal, scopeText, type PreviewData } from './AnnouncementForm';
import type { Announcement } from '../../types';

const STATUS_BADGE: Record<string, string> = {
    Draft: 'badge-secondary', Scheduled: 'badge-info', 'Not Started': 'badge-info', Active: 'badge-success',
    Published: 'badge-success', Withdrawn: 'badge-danger', Ended: 'badge-warning',
};
const canEdit = (s: string) => s !== 'Withdrawn' && s !== 'Ended';
const canPublish = (s: string) => s === 'Draft' || s === 'Scheduled' || s === 'Not Started';
const canDelete = canPublish;
const canWithdraw = (s: string) => s === 'Active' || s === 'Published';
const disabledStyle = { opacity: 0.35, cursor: 'not-allowed' } as const;
const OPEN_EDIT_KEY = 'open_edit_ann_id';

function toPreview(a: Announcement): PreviewData {
    return {
        title: a.title, summary: a.summary ?? '', body: a.body, publishedAt: a.published_at,
        coverImage: a.cover_image ? backendUrl(a.cover_image) : '', scopeAll: a.scope_all, departments: a.scope_departments ?? [],
        createdBy: a.created_by_name || '—',
    };
}

/** Administration > Announcement. */
export default function AnnouncementsPage() {
    const { data, loading, error, retry, reload } = usePageData(announcementService.page);
    const [selected, setSelected] = useState<number[]>([]);
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<Announcement | null>(null);
    const [preview, setPreview] = useState<PreviewData | null>(null);
    const [details, setDetails] = useState<Announcement | null>(null);
    const [busy, setBusy] = useState(false);

    const list = useMemo(() => data?.announcements ?? [], [data]);
    const byId = (id: number) => list.find(a => a.id === id) ?? null;

    // After "Copy", the new draft opens straight in the editor (as before).
    useEffect(() => {
        if (!data) return;
        let autoEdit: string | null = null;
        try { autoEdit = sessionStorage.getItem(OPEN_EDIT_KEY); sessionStorage.removeItem(OPEN_EDIT_KEY); } catch { /* ignore */ }
        const a = autoEdit ? data.announcements.find(x => x.id === Number(autoEdit)) : null;
        if (a) window.setTimeout(() => openEdit(a), 100);
    }, [data]);

    // Selection only keeps rows that still exist after a reload.
    const filters = useFilters({ search: '', status: '', creator: '', audience: '', from: '', to: '' });
    const f = filters.values;
    const ALL = 'All Employees';
    const view = useTableView(list, a => matchesText(f.search, a.title, a.summary) && is(f.status, a.status) && is(f.creator, a.created_by_name)
        && (!f.audience || (f.audience === ALL ? a.scope_all : !a.scope_all && (a.scope_departments ?? []).includes(f.audience)))
        && inDateRange(a.published_at, f.from, f.to), {
        title: a => a.title, summary: a => a.summary, published: a => a.published_at, end: a => a.end_at, status: a => a.status,
        creator: a => a.created_by_name, created: a => a.created_at, audience: a => scopeText(a.scope_all, a.scope_departments ?? []),
    });
    const audiences = useMemo(() => [ALL, ...distinct(list.flatMap(a => (a.scope_all ? [] : a.scope_departments ?? [])), d => d)], [list]);
    // Only shown rows stay selected, so Delete / Publish never act on rows a filter hides.
    const shownIds = view.rows.map(a => a.id).join(',');
    useEffect(() => { setSelected(s => s.filter(id => view.rows.some(a => a.id === id))); }, [shownIds]); // eslint-disable-line react-hooks/exhaustive-deps

    const after = async (message: string) => {
        await ArchonAlert.success(message, { timer: 1800 });
        setSelected([]);
        await reload();
    };

    const openCreate = () => { setEditing(null); setFormOpen(true); };
    const openEdit = (a: Announcement) => { setDetails(null); setEditing(a); setFormOpen(true); };

    const publish = async (id: number) => {
        const ok = await confirmDialog({
            title: 'Confirm Publish',
            paragraphs: ['Are you sure you want to publish this announcement? It will immediately become visible to employees on their dashboard and notification area.'],
            icon: 'question', confirmText: 'Publish',
        });
        if (!ok) return;
        setBusy(true);
        try {
            await announcementService.publish(id);
            await after('Announcement published successfully.');
        } catch (err) {
            await ArchonAlert.error('Could not publish: ' + (err instanceof Error ? err.message : ''));
        } finally {
            setBusy(false);
        }
    };

    const withdraw = async (id: number) => {
        const ok = await confirmDialog({
            title: 'Confirm Withdraw',
            paragraphs: ['Are you sure you want to withdraw this announcement? It will stop appearing on the Employee Dashboard immediately. The record itself will not be deleted.'],
            icon: 'warning', confirmText: 'Withdraw', danger: true,
        });
        if (!ok) return;
        setBusy(true);
        try {
            await announcementService.withdraw(id);
            await after('Announcement withdrawn successfully.');
        } catch (err) {
            await ArchonAlert.error('Could not withdraw: ' + (err instanceof Error ? err.message : ''));
        } finally {
            setBusy(false);
        }
    };

    const remove = async (ids: number[]) => {
        const ok = await confirmDialog({
            title: 'Confirm Delete',
            paragraphs: [ids.length === 1 ? 'Are you sure you want to delete this announcement?' : `Are you sure you want to delete these ${ids.length} announcements?`],
            icon: 'warning', confirmText: 'Delete', danger: true,
        });
        if (!ok) return;
        setBusy(true);
        try {
            if (ids.length === 1) {
                await announcementService.remove(ids[0]);
            } else {
                const res = await announcementService.bulkRemove(ids);
                const skipped = Object.keys(res.skipped || {}).length;
                if (skipped) {
                    await ArchonAlert.warning(`${res.deleted.length} announcement(s) deleted. ${skipped} could not be deleted because they are published, withdrawn, or ended.`);
                    setSelected([]);
                    await reload();
                    return;
                }
            }
            await after(ids.length === 1 ? 'Announcement deleted successfully.' : 'Announcements deleted successfully.');
        } catch (err) {
            await ArchonAlert.error('Could not delete: ' + (err instanceof Error ? err.message : ''));
        } finally {
            setBusy(false);
        }
    };

    const copy = async (id: number) => {
        const ok = await ArchonAlert.confirm({
            title: 'Copy Announcement',
            text: 'Create a copy of this announcement? The copied announcement will become a new Draft that you can edit before publishing.',
            icon: 'question', confirmText: 'Copy',
        });
        if (!ok) return;
        setBusy(true);
        try {
            const res = await announcementService.copy(id);
            try { sessionStorage.setItem(OPEN_EDIT_KEY, String(res.id)); } catch { /* ignore */ }
            await after('Announcement copied as a new Draft.');
        } catch (err) {
            await ArchonAlert.error('Could not copy announcement: ' + (err instanceof Error ? err.message : ''));
        } finally {
            setBusy(false);
        }
    };

    // Command bar state (same rules as updateAnnouncementCommandBar()).
    const one = selected.length === 1 ? byId(selected[0]) : null;
    const st = one?.status ?? '';
    const bar = {
        preview: !!one, copy: !!one,
        edit: !!one && canEdit(st),
        publish: !!one && canPublish(st),
        withdraw: !!one && canWithdraw(st),
        remove: selected.length === 1 ? canDelete(st) : selected.length > 1 && selected.every(id => canDelete(byId(id)?.status ?? '')),
    };
    const allChecked = view.rows.length > 0 && view.rows.every(a => selected.includes(a.id));

    return (
        <Page id="announcements">
            <PageHeader title="Announcement" subtitle="Create and manage announcements shared with employees" />
            <PageState loading={loading} error={error} onRetry={retry} />
            {data && (
                <>
                    <div className="page-toolbar">
                        <div className="toolbar-left" id="announcementCommandBar">
                            <button className="btn btn-primary" id="annBtnCreate" onClick={openCreate}><Icon as={Plus} /> Create</button>
                            <button className="btn btn-outline" id="annBtnPreview" disabled={!bar.preview || busy} onClick={() => one && setPreview(toPreview(one))}><Icon as={Eye} /> Preview</button>
                            <button className="btn btn-outline" id="annBtnEdit" disabled={!bar.edit || busy} onClick={() => one && openEdit(one)}><Icon as={Pencil} /> Edit</button>
                            <button className="btn btn-outline" id="annBtnPublish" disabled={!bar.publish || busy} onClick={() => one && void publish(one.id)}><Icon as={Send} /> Publish</button>
                            <button className="btn btn-outline" id="annBtnWithdraw" disabled={!bar.withdraw || busy} onClick={() => one && void withdraw(one.id)}><Icon as={Flag} /> Withdraw</button>
                            <button className="btn btn-outline" id="annBtnCopy" disabled={!bar.copy || busy} onClick={() => one && void copy(one.id)}><Icon as={Copy} /> Copy</button>
                            <button className="btn btn-outline" id="annBtnDelete" disabled={!bar.remove || busy} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                                onClick={() => selected.length && void remove(selected)}><Icon as={Trash2} /> Delete</button>
                        </div>
                    </div>
                    <div className="page-toolbar">
                        <div className="toolbar-left">
                            <SearchBox id="annSearch" value={f.search} onChange={filters.set('search')} placeholder="Search title or summary..." />
                            <FilterSelect id="annStatusFilter" label="Statuses" value={f.status} onChange={filters.set('status')} options={distinct(list, a => a.status)} />
                            <FilterSelect id="annCreatorFilter" label="Creators" value={f.creator} onChange={filters.set('creator')} options={distinct(list, a => a.created_by_name)} />
                            <FilterSelect id="annAudienceFilter" label="Audiences" value={f.audience} onChange={filters.set('audience')} options={audiences} />
                            <DateRangeFilter id="annPublished" label="Published" from={f.from} to={f.to} onFrom={filters.set('from')} onTo={filters.set('to')} />
                            <ClearFilters id="annClear" active={filters.active} onClear={filters.clear} />
                            <FilterCount shown={view.rows.length} total={list.length} />
                        </div>
                    </div>
                    <div className="card hover-card">
                        <div className="card-body no-padding">
                            <table className="data-table" id="announcementTable">
                                <thead>
                                    <tr>
                                        <th style={{ width: 36 }}>
                                            <input type="checkbox" id="annSelectAll" checked={allChecked}
                                                onChange={e => setSelected(e.target.checked ? view.rows.map(a => a.id) : [])} />
                                        </th>
                                        <SortTh view={view} k="title">Announcement Name</SortTh><SortTh view={view} k="summary">Summary</SortTh><SortTh view={view} k="published">Published Time</SortTh><SortTh view={view} k="end">End Time</SortTh><SortTh view={view} k="status">Status</SortTh>
                                        <SortTh view={view} k="creator">Created By</SortTh><SortTh view={view} k="created">Created Date</SortTh><SortTh view={view} k="audience">Applied To</SortTh><th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {!list.length ? (
                                        <EmptyRow colSpan={10}>No announcements yet. Click <strong>Create</strong> to publish your first announcement.</EmptyRow>
                                    ) : !view.rows.length ? (
                                        <EmptyRow colSpan={10}>No records found. Try other filters or clear them.</EmptyRow>
                                    ) : view.rows.map(a => (
                                        <tr className="hover-row ann-row" key={a.id} data-id={a.id} data-status={a.status}>
                                            <td>
                                                <input type="checkbox" className="ann-row-checkbox" value={a.id} checked={selected.includes(a.id)}
                                                    onChange={e => setSelected(s => (e.target.checked ? [...s, a.id] : s.filter(x => x !== a.id)))} />
                                            </td>
                                            <td>
                                                <div className="table-cell-flex">
                                                    <div className="cell-avatar" style={{ background: '#ede9fe', overflow: 'hidden' }}>
                                                        {a.cover_image
                                                            ? <img src={backendUrl(a.cover_image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            : <Icon as={Megaphone} style={{ color: '#8b5cf6' }} />}
                                                    </div>
                                                    <span style={{ fontWeight: 600 }}>{a.title}</span>
                                                </div>
                                            </td>
                                            <td style={{ maxWidth: 220 }}>{strimwidth(a.summary, 80)}</td>
                                            <td>{phpMjYgiA(a.published_at)}</td>
                                            <td>{a.end_at ? phpMjYgiA(a.end_at) : '—'}</td>
                                            <td><Badge variant={STATUS_BADGE[a.status] ?? 'badge-info'}>{a.status}</Badge></td>
                                            <td>{a.created_by_name || '—'}</td>
                                            <td>{phpMjY(a.created_at)}</td>
                                            <td>{scopeText(a.scope_all, a.scope_departments ?? [])}</td>
                                            <td>
                                                <button className="table-action-btn btn-view-announcement" title="View Details" onClick={() => setDetails(a)}><Icon as={Eye} /></button>
                                                <button className="table-action-btn btn-edit-announcement" title="Edit" disabled={!canEdit(a.status)}
                                                    style={canEdit(a.status) ? undefined : disabledStyle} onClick={() => openEdit(a)}><Icon as={Pencil} /></button>
                                                <button className="table-action-btn btn-publish-row-announcement" title="Publish" disabled={!canPublish(a.status)}
                                                    style={canPublish(a.status) ? undefined : disabledStyle} onClick={() => void publish(a.id)}><Icon as={Send} /></button>
                                                <button className="table-action-btn btn-delete-announcement" title="Delete" disabled={!canDelete(a.status)}
                                                    style={canDelete(a.status) ? undefined : disabledStyle} onClick={() => void remove([a.id])}><Icon as={Trash2} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            <AnnouncementFormModal open={formOpen} editing={editing} departments={data?.departments ?? []}
                onClose={() => setFormOpen(false)}
                onSaved={msg => { setFormOpen(false); void after(msg); }}
                onPreview={setPreview} />

            <PreviewModal data={preview} onClose={() => setPreview(null)} />

            <Modal open={!!details} onClose={() => setDetails(null)} size="lg" title={<><Icon as={Megaphone} /> Announcement Details</>}
                footer={details && <>
                    <button className="btn btn-outline" onClick={() => setDetails(null)}>Close</button>
                    <button type="button" className="btn btn-outline" id="annDetailsBtnPreview" onClick={() => setPreview(toPreview(details))}><Icon as={Eye} /> Preview</button>
                    <button type="button" className="btn btn-primary" id="annDetailsBtnEdit" disabled={!canEdit(details.status)} onClick={() => openEdit(details)}><Icon as={Pencil} /> Edit</button>
                    {canPublish(details.status) && (
                        <button type="button" className="btn btn-primary" id="annDetailsBtnPublish" onClick={() => { const id = details.id; setDetails(null); void publish(id); }}><Icon as={Send} /> Publish</button>
                    )}
                    {canWithdraw(details.status) && (
                        <button type="button" className="btn btn-primary" style={{ background: 'var(--danger)' }} id="annDetailsBtnWithdraw"
                            onClick={() => { const id = details.id; setDetails(null); void withdraw(id); }}><Icon as={Flag} /> Withdraw</button>
                    )}
                </>}>
                {details && (
                    <div className="modal-info-grid">
                        <div className="info-item full-width">
                            <div className="info-label">Announcement Name</div>
                            <div className="info-value" id="annDetailsTitle" style={{ fontWeight: 700 }}>{details.title}</div>
                        </div>
                        <div className="info-item"><div className="info-label">Status</div><div className="info-value" id="annDetailsStatus"><Badge variant={STATUS_BADGE[details.status] ?? 'badge-info'}>{details.status}</Badge></div></div>
                        <div className="info-item"><div className="info-label">Applied To</div><div className="info-value" id="annDetailsScope">{scopeText(details.scope_all, details.scope_departments ?? [])}</div></div>
                        <div className="info-item"><div className="info-label">Published Time</div><div className="info-value" id="annDetailsPublished">{annFormatDateTime(details.published_at)}</div></div>
                        <div className="info-item"><div className="info-label">End Time</div><div className="info-value" id="annDetailsEnd">{details.end_at ? annFormatDateTime(details.end_at) : '—'}</div></div>
                        <div className="info-item"><div className="info-label">Created By</div><div className="info-value" id="annDetailsCreatedBy">{details.created_by_name || '—'}</div></div>
                        <div className="info-item"><div className="info-label">Created Date</div><div className="info-value" id="annDetailsCreatedAt">{annFormatDateTime(details.created_at)}</div></div>
                        <div className="info-item"><div className="info-label">Updated By</div><div className="info-value" id="annDetailsUpdatedBy">{details.updated_by_name || '—'}</div></div>
                        <div className="info-item"><div className="info-label">Updated Date</div><div className="info-value" id="annDetailsUpdatedAt">{annFormatDateTime(details.updated_at)}</div></div>
                        {details.withdrawn_at && (
                            <div className="info-item" id="annDetailsWithdrawnWrap"><div className="info-label">Withdrawn Date</div><div className="info-value" id="annDetailsWithdrawnAt">{annFormatDateTime(details.withdrawn_at)}</div></div>
                        )}
                        <div className="info-item full-width"><div className="info-label">Summary</div><div className="info-value" id="annDetailsSummary">{details.summary || '—'}</div></div>
                    </div>
                )}
            </Modal>
        </Page>
    );
}
