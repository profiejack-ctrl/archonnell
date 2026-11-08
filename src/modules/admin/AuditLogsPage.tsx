import { useEffect, useState } from 'react';
import { Badge, EmptyRow, Page, PageHeader, PageState, SearchBox } from '../../components/ui';
import { ClearFilters, DateRangeFilter, FilterSelect, SortSelect, SortTh, useFilters, useSort } from '../../components/TableControls';
import { usePageData } from '../../hooks/usePageData';
import { auditLogService } from '../../services/auditLogService';

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
    if (totalPages <= 1) return null;
    return (
        <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <a href="#" key={p} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-outline'}`}
                    onClick={e => { e.preventDefault(); onPage(p); }}>{p}</a>
            ))}
        </div>
    );
}

const FILTERS = { action: '', module: '', status: '', search: '', from: '', to: '' };

/**
 * Administration > Audit Logs (25 per page). The log grows without limit, so
 * filtering, sorting and paging are all done by the database query.
 */
export default function AuditLogsPage() {
    const filters = useFilters(FILTERS);
    const f = filters.values;
    const sort = useSort({ key: 'date', dir: 'desc' });
    // The search box queries the server once typing pauses.
    const [search, setSearch] = useState('');
    useEffect(() => {
        const t = window.setTimeout(() => filters.set('search')(search), 350);
        return () => window.clearTimeout(t);
    }, [search]); // eslint-disable-line react-hooks/exhaustive-deps
    const query = { ...f, sort: sort.sort?.key ?? '', dir: sort.sort?.dir ?? '' } as const;
    // The page belongs to one filter + sort combination: any change starts again at page 1 (one request, no race).
    const key = JSON.stringify(query);
    const [paging, setPaging] = useState({ key, page: 1 });
    const page = paging.key === key ? paging.page : 1;
    const setPage = (p: number) => setPaging({ key, page: p });
    const { data, loading, error, retry } = usePageData(() => auditLogService.page(page, query), [page, key]);
    const clear = () => { setSearch(''); filters.clear(); };

    return (
        <Page id="audit-logs">
            <PageHeader title="Audit Logs" subtitle="Login attempts, logouts, and administrative changes across the system" />
            <div className="page-toolbar">
                <div className="toolbar-left">
                    <SearchBox id="auditSearch" value={search} onChange={setSearch} placeholder="Search user, employee ID, description, IP..." />
                    <FilterSelect id="auditActionFilter" label="Actions" allLabel="All actions" value={f.action} onChange={filters.set('action')} options={data?.actions ?? []} />
                    <FilterSelect id="auditModuleFilter" label="Modules" value={f.module} onChange={filters.set('module')} options={data?.modules ?? []} />
                    <FilterSelect id="auditStatusFilter" label="Statuses" value={f.status} onChange={filters.set('status')} options={data?.statuses ?? []} />
                    <DateRangeFilter id="auditDate" label="Date" from={f.from} to={f.to} onFrom={filters.set('from')} onTo={filters.set('to')} />
                    <SortSelect view={sort} id="auditSort" options={[{ key: 'module', label: 'Module' }, { key: 'status', label: 'Status' }]} />
                    <ClearFilters id="auditClear" active={filters.active || search !== ''} onClear={clear} />
                    {data && <span className="filter-count">{data.total} entr{data.total === 1 ? 'y' : 'ies'}</span>}
                </div>
            </div>
            <PageState loading={loading && !data} error={error} onRetry={retry} />
            {data && (
                <>
                    <div className="card hover-card">
                        <div className="card-body no-padding" style={{ overflowX: 'auto' }}>
                            <table className="data-table" id="auditLogsTable">
                                <thead><tr><SortTh view={sort} k="date">Date/Time</SortTh><SortTh view={sort} k="user">User</SortTh><SortTh view={sort} k="action">Action</SortTh><th>Description</th><SortTh view={sort} k="ip">IP Address</SortTh></tr></thead>
                                <tbody>
                                    {!data.logs.length && <EmptyRow colSpan={5}>{filters.active || search ? 'No records found. Try other filters or clear them.' : 'No audit entries found.'}</EmptyRow>}
                                    {data.logs.map(log => (
                                        <tr className="hover-row" key={log.id}>
                                            <td>{log.created_at}</td>
                                            <td><strong>{log.username ?? 'System'}</strong></td>
                                            <td><Badge variant="badge-info">{log.action}</Badge></td>
                                            <td>{log.description ?? ''}</td>
                                            <td>{log.ip_address ?? ''}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <Pagination page={data.page} totalPages={data.total_pages} onPage={setPage} />
                </>
            )}
        </Page>
    );
}
