import { useEffect, useState, type FormEvent } from 'react';
import { Save } from 'lucide-react';
import Icon from '../../components/Icon';
import { Badge, Page, PageHeader, PageState } from '../../components/ui';
import { usePageData } from '../../hooks/usePageData';
import { SortTh, useTableView } from '../../components/TableControls';
import { userService } from '../../services/userService';
import { ArchonAlert } from '../../utils/alerts';

/** Administration > Roles & Permissions (role list + role-permission matrix). */
export default function RolesPage() {
    const { data, loading, error, retry, reload } = usePageData(userService.rolesPage);
    const [checked, setChecked] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);
    const rv = useTableView(data?.roles, () => true, { role: r => r.role_name, description: r => r.description, users: r => Number(r.user_count) });

    useEffect(() => {
        if (data) setChecked(new Set(data.grants.map(([r, p]) => `${r}_${p}`)));
    }, [data]);

    const toggle = (key: string, on: boolean) => setChecked(s => {
        const next = new Set(s);
        if (on) next.add(key); else next.delete(key);
        return next;
    });

    const save = async (e: FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await userService.saveRoleMatrix([...checked]);
            await ArchonAlert.success(res.message);
        } catch (err) {
            await ArchonAlert.error(err instanceof Error ? err.message : 'Failed to update the permission matrix.');
        } finally {
            setSaving(false);
            await reload();
        }
    };

    return (
        <Page id="roles">
            <PageHeader title="Roles & Permissions" subtitle="Default roles are seeded by the database and used to gate every module" />
            <PageState loading={loading} error={error} onRetry={retry} />
            {data && (
                <>
                    <div className="card hover-card" style={{ marginBottom: '1.5rem' }}>
                        <div className="card-header">
                            <div>
                                <h3 className="card-title">System Roles</h3>
                                <p className="card-subtitle">Roles available for user accounts and how many users hold each</p>
                            </div>
                        </div>
                        <div className="card-body no-padding">
                            <table className="data-table">
                                <thead><tr><SortTh view={rv} k="role">Role</SortTh><SortTh view={rv} k="description">Description</SortTh><SortTh view={rv} k="users">Users</SortTh></tr></thead>
                                <tbody>
                                    {rv.rows.map(r => (
                                        <tr className="hover-row" key={r.id}>
                                            <td><Badge variant="badge-info">{r.role_name}</Badge></td>
                                            <td>{r.description ?? ''}</td>
                                            <td><strong>{r.user_count}</strong></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <form onSubmit={e => void save(e)}>
                        <div className="card hover-card">
                            <div className="card-header">
                                <div>
                                    <h3 className="card-title">Permission Matrix</h3>
                                    <p className="card-subtitle">Check which permissions each role grants. Super Admin always has full access and is not editable here</p>
                                </div>
                                <button type="submit" className="btn btn-primary" disabled={saving}><Icon as={Save} /> Save Permission Matrix</button>
                            </div>
                            <div className="card-body no-padding" style={{ overflowX: 'auto' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Permission</th>
                                            {data.roles.map(r => <th style={{ textAlign: 'center' }} key={r.id}>{r.role_name}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.permissions.map(p => (
                                            <tr className="hover-row" key={p.id}>
                                                <td><strong>{p.permission_name}</strong></td>
                                                {data.roles.map(r => {
                                                    const key = `${r.id}_${p.id}`;
                                                    const isSuper = r.role_name === 'Super Admin' || r.id === 1;
                                                    return (
                                                        <td style={{ textAlign: 'center' }} key={r.id}>
                                                            <input type="checkbox" style={{ width: '1.1rem', height: '1.1rem' }} name={`perm[${key}]`}
                                                                checked={isSuper || checked.has(key)} disabled={isSuper}
                                                                onChange={e => toggle(key, e.target.checked)} />
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </form>
                </>
            )}
        </Page>
    );
}
