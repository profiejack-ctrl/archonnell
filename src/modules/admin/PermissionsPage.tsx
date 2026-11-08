import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import Icon from '../../components/Icon';
import { Badge, EmptyRow, Page, PageHeader, PageState, SearchBox } from '../../components/ui';
import { ClearFilters, FilterSelect, SortTh, matchesText, useFilters, useTableView } from '../../components/TableControls';
import { usePageData } from '../../hooks/usePageData';
import { userService } from '../../services/userService';
import { ArchonAlert } from '../../utils/alerts';

/** Administration > Permissions (list + add). */
export default function PermissionsPage() {
    const { data, loading, error, retry, reload } = usePageData(userService.permissionsPage);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [busy, setBusy] = useState(false);
    const pf = useFilters({ search: '', assigned: '' });
    const pv = useTableView(data?.permissions, p => matchesText(pf.values.search, p.permission_name, p.description)
        && (!pf.values.assigned || (pf.values.assigned === 'yes') === Number(p.role_count) > 0), {
        name: p => p.permission_name, description: p => p.description, roles: p => Number(p.role_count),
    });

    const create = async (e: FormEvent) => {
        e.preventDefault();
        setBusy(true);
        try {
            const res = await userService.createPermission(name, description);
            setName('');
            setDescription('');
            await ArchonAlert.success(res.message);
            await reload();
        } catch (err) {
            await ArchonAlert.error(err instanceof Error ? err.message : 'Request failed');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Page id="permissions">
            <PageHeader title="Permissions" subtitle="These slugs gate modules across the dashboard, sidebar, and admin pages" />
            <PageState loading={loading} error={error} onRetry={retry} />
            {data && (
                <>
                    <div className="card hover-card" style={{ marginBottom: '1.5rem' }}>
                        <div className="card-header">
                            <div>
                                <h3 className="card-title">System Permissions</h3>
                                <p className="card-subtitle">Every permission and how many roles it is assigned to</p>
                            </div>
                        </div>
                        <div className="card-body" style={{ paddingBottom: 0 }}>
                            <div className="toolbar-left" style={{ marginBottom: '1rem' }}>
                                <SearchBox id="permSearch" value={pf.values.search} onChange={pf.set('search')} placeholder="Search permission or description..." />
                                <FilterSelect id="permAssignedFilter" label="Assignment" allLabel="Assigned and unassigned" value={pf.values.assigned} onChange={pf.set('assigned')}
                                    options={[{ value: 'yes', label: 'Assigned to a role' }, { value: 'no', label: 'Not assigned' }]} />
                                <ClearFilters id="permClear" active={pf.active} onClear={pf.clear} />
                            </div>
                        </div>
                        <div className="card-body no-padding" style={{ overflowX: 'auto' }}>
                            <table className="data-table" id="permissionsTable">
                                <thead><tr><SortTh view={pv} k="name">Permission</SortTh><SortTh view={pv} k="description">Description</SortTh><SortTh view={pv} k="roles">Assigned to Roles</SortTh></tr></thead>
                                <tbody>
                                    {!data.permissions.length && <EmptyRow colSpan={3}>No permissions found.</EmptyRow>}
                                    {!!data.permissions.length && !pv.rows.length && <EmptyRow colSpan={3}>No records found. Try other filters or clear them.</EmptyRow>}
                                    {pv.rows.map(p => (
                                        <tr className="hover-row" key={p.id}>
                                            <td><strong>{p.permission_name}</strong></td>
                                            <td>{p.description ?? ''}</td>
                                            <td><Badge variant="badge-info">{p.role_count}</Badge></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="card hover-card" style={{ maxWidth: 520 }}>
                        <div className="card-header">
                            <div>
                                <h3 className="card-title">Add Permission</h3>
                                <p className="card-subtitle">New permissions start unassigned — grant them to roles from the matrix</p>
                            </div>
                        </div>
                        <div className="card-body">
                            <form onSubmit={e => void create(e)}>
                                <div className="form-group">
                                    <label htmlFor="permission_name">Permission Name</label>
                                    <input type="text" id="permission_name" name="permission_name" className="form-input" placeholder="e.g. payroll_management" required
                                        value={name} onChange={e => setName(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="description">Description</label>
                                    <input type="text" id="description" name="description" className="form-input" placeholder="What does this permission allow?"
                                        value={description} onChange={e => setDescription(e.target.value)} />
                                </div>
                                <button type="submit" className="btn btn-primary" disabled={busy}><Icon as={Plus} /> Add Permission</button>
                            </form>
                        </div>
                    </div>
                </>
            )}
        </Page>
    );
}
