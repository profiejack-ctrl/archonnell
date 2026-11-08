import { useState } from 'react';
import { Archive, Briefcase, Building2, Eye, Pencil, Save, ShieldCheck, ToggleLeft, UserRound, UserX, Users } from 'lucide-react';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import { assignmentError, DepartmentOptions, positionAfterDepartmentChange, PositionOptions } from '../../components/assignment';
import { Badge, EmptyRow, Page, PageHeader, PageState, ROW_PALETTE, SearchBox, StatCard, StatsGrid } from '../../components/ui';
import { ClearFilters, DateRangeFilter, FilterCount, FilterSelect, SortSelect, SortTh, distinct, inDateRange, is, matchesText, useFilters, useTableView } from '../../components/TableControls';
import { usePageData } from '../../hooks/usePageData';
import { userService } from '../../services/userService';
import { ArchonAlert, confirmDialog } from '../../utils/alerts';
import { num } from '../../utils/format';
import type { DirectoryUser } from '../../types';

interface ViewData {
    name: string; email: string; username: string; employeeNo: string; mobile: string; dateHired: string;
    department: string; position: string; roleName: string; status: string; lastLogin: string;
}

const fullName = (u: DirectoryUser) => `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim();

/** User Management > User Directory. */
export default function UserDirectoryPage() {
    const { data, loading, error, retry, reload } = usePageData(userService.directoryPage);
    const filters = useFilters({ search: '', role: '', department: '', position: '', status: '', from: '', to: '' });
    const f = filters.values;
    const [view, setView] = useState<ViewData | null>(null);
    const [editing, setEditing] = useState<DirectoryUser | null>(null);
    const [form, setForm] = useState({ first: '', last: '', middle: '', email: '', mobile: '', department: '', position: '', role: '' });
    const [saving, setSaving] = useState(false);
    const [busyId, setBusyId] = useState<number | null>(null);

    const tv = useTableView(data?.users, u => matchesText(f.search, fullName(u), u.email, u.employee_no, u.username)
        && is(f.role, u.role_name) && is(f.department, u.department) && is(f.position, u.position) && is(f.status, u.status)
        && inDateRange(u.created_at, f.from, f.to), {
        name: u => fullName(u) || u.username, no: u => u.employee_no, department: u => u.department, role: u => u.role_name, status: u => u.status,
        created: u => u.created_at, login: u => u.last_login,
    });

    const openView = async (u: DirectoryUser) => {
        let v: ViewData;
        try {
            const { user } = await userService.view(u.id);
            v = {
                name: `${user.first_name || ''} ${user.last_name || ''}`.trim(), email: user.email, username: user.username,
                employeeNo: user.employee_no || '-', mobile: user.mobile_number || '-', dateHired: user.date_hired || '-',
                department: user.department || '-', position: user.position || '-', roleName: user.role_name, status: user.status,
                lastLogin: user.last_login || 'Never',
            };
        } catch {
            v = {
                name: fullName(u), email: u.email, username: u.username, employeeNo: u.employee_no || '-', mobile: u.mobile_number || '-',
                dateHired: u.date_hired || '-', department: u.department || '-', position: u.position || '-', roleName: u.role_name,
                status: u.status, lastLogin: u.last_login || 'Never',
            };
        }
        setView(v);
    };

    const openEdit = (u: DirectoryUser) => {
        setForm({
            first: u.first_name ?? '', last: u.last_name ?? '', middle: u.middle_name ?? '', email: u.email ?? '', mobile: u.mobile_number ?? '',
            department: u.department ?? '', position: u.position ?? '', role: String(u.role_id),
        });
        setEditing(u);
    };

    const saveEdit = async () => {
        if (!editing) return;
        // Department / position belong to the linked employee record; accounts without one have neither.
        const invalid = editing.employee_id ? assignmentError(data?.departments ?? [], data?.positions ?? [], form.department, form.position,
            { department: editing.department ?? '', position: editing.position ?? '' }) : '';
        if (invalid) { await ArchonAlert.warning(invalid, { title: 'Invalid Department / Position' }); return; }
        setSaving(true);
        try {
            await userService.update(editing.id, {
                first_name: form.first.trim(), last_name: form.last.trim(), middle_name: form.middle.trim(), email: form.email.trim(),
                mobile_number: form.mobile.trim(), department: form.department, position: form.position, role_id: form.role,
            });
            setEditing(null);
            await ArchonAlert.success('User updated successfully.', { timer: 1800 });
            await reload();
        } catch (err) {
            await ArchonAlert.error(err instanceof Error ? err.message : '', { title: 'Could Not Update User' });
        } finally {
            setSaving(false);
        }
    };

    const toggleStatus = async (u: DirectoryUser) => {
        const name = fullName(u) || u.username;
        const verb = u.status === 'Active' ? 'Deactivate' : 'Activate';
        const ok = await ArchonAlert.confirm({ title: `${verb} Account`, text: `${verb} the account for ${name}?`, icon: 'warning', confirmText: verb, danger: verb === 'Deactivate' });
        if (!ok) return;
        setBusyId(u.id);
        try {
            await userService.toggleStatus(u.id);
            await ArchonAlert.success(`The account for ${name} has been ${verb.toLowerCase()}d.`, { timer: 1800 });
            await reload();
        } catch (err) {
            await ArchonAlert.error('Could not update status: ' + (err instanceof Error ? err.message : ''));
        } finally {
            setBusyId(null);
        }
    };

    const archive = async (u: DirectoryUser) => {
        const ok = await confirmDialog({
            title: 'Archive System User',
            paragraphs: ['Are you sure you want to archive this system user account?', 'An archived account can no longer sign in and is removed from the User Directory and the account statistics.'],
            details: [{ label: 'User', value: fullName(u) || u.username || '-' }],
            icon: 'warning', confirmText: 'Archive', danger: true,
        });
        if (!ok) return;
        setBusyId(u.id);
        try {
            await userService.archive(u.id);
            await ArchonAlert.success('User archived successfully.', { timer: 1800 });
            await reload();
        } catch (err) {
            await ArchonAlert.error('Could not archive user: ' + (err instanceof Error ? err.message : ''));
        } finally {
            setBusyId(null);
        }
    };

    const setF = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });
    const ro = { background: 'var(--bg-secondary)' };

    return (
        <Page id="user-directory">
            <PageHeader title="User Directory" subtitle="System user accounts, statistics and management" />
            <PageState loading={loading} error={error} onRetry={retry} />
            {data && (
                <>
                    <StatsGrid>
                        <StatCard icon={Users} gradient={['#60a5fa', '#3b82f6']} value={<span id="udTotalUsers">{num(data.cards.total_users)}</span>} label="Total Users" />
                        <StatCard icon={ShieldCheck} gradient={['#34d399', '#10b981']} value={<span id="udActiveAccounts">{num(data.cards.active_accounts)}</span>} label="Active Accounts" />
                        <StatCard icon={UserX} gradient={['#f87171', '#ef4444']} value={<span id="udDeactivatedAccounts">{num(data.cards.deactivated_accounts)}</span>} label="Deactivated Accounts" />
                        <StatCard icon={Building2} gradient={['#a78bfa', '#8b5cf6']} value={<span id="udActiveDepartments">{num(data.cards.active_departments)}</span>} label="Active Departments" />
                    </StatsGrid>
                    <div className="page-toolbar">
                        <div className="toolbar-left">
                            <SearchBox id="udSearch" value={f.search} onChange={filters.set('search')} placeholder="Search by name, email or Employee ID..." />
                            <select className="form-select" id="udRoleFilter" aria-label="Role" value={f.role} onChange={e => filters.set('role')(e.target.value)}>
                                <option value="">All Roles</option>
                                {data.roles.map(r => <option value={r.role_name} key={r.id}>{r.role_name}</option>)}
                            </select>
                            <select className="form-select" id="udDeptFilter" aria-label="Department" value={f.department} onChange={e => filters.set('department')(e.target.value)}>
                                <option value="">All Departments</option>
                                {data.departments.map(d => <option value={d.name} key={d.id}>{d.name}</option>)}
                            </select>
                            <FilterSelect id="udPositionFilter" label="Positions" value={f.position} onChange={filters.set('position')} options={distinct(data.users, u => u.position)} />
                            <FilterSelect id="udStatusFilter" label="Account Statuses" value={f.status} onChange={filters.set('status')} options={distinct(data.users, u => u.status)} />
                            <DateRangeFilter id="udCreated" label="Created" from={f.from} to={f.to} onFrom={filters.set('from')} onTo={filters.set('to')} />
                            <SortSelect view={tv} id="udSort" options={[{ key: 'created', label: 'Date Created' }, { key: 'login', label: 'Last Login' }]} />
                            <ClearFilters id="udClear" active={filters.active} onClear={filters.clear} />
                            <FilterCount shown={tv.rows.length} total={tv.total} />
                        </div>
                    </div>
                    <div className="card hover-card">
                        <div className="card-body no-padding">
                            <table className="data-table" id="userDirectoryTable">
                                <thead>
                                    <tr><SortTh view={tv} k="name">User Details</SortTh><SortTh view={tv} k="no">Employee ID</SortTh><SortTh view={tv} k="department">Department &amp; Position</SortTh><SortTh view={tv} k="role">Role</SortTh><SortTh view={tv} k="status">Status</SortTh><th>Actions</th></tr>
                                </thead>
                                <tbody>
                                    {!data.users.length ? (
                                        <EmptyRow colSpan={6}>No system users yet. Create accounts from <strong>Register New System User</strong>.</EmptyRow>
                                    ) : !tv.rows.length ? (
                                        <EmptyRow colSpan={6}>No records found. Try other filters or clear them.</EmptyRow>
                                    ) : tv.rows.map((u, i) => {
                                        const c = ROW_PALETTE[i % ROW_PALETTE.length];
                                        const name = fullName(u);
                                        const ini = ((u.first_name || 'U').charAt(0) + (u.last_name || '').charAt(0)).toUpperCase();
                                        const deptPos = `${u.department ?? ''}${u.department && u.position ? ' · ' : ''}${u.position ?? ''}`.trim() || '—';
                                        return (
                                            <tr className="hover-row user-row" key={u.id}>
                                                <td>
                                                    <div className="table-cell-flex">
                                                        <div className="cell-avatar" style={{ background: c[0], color: c[1], fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{ini}</div>
                                                        <div>
                                                            <div style={{ fontWeight: 600 }}>{name !== '' ? name : u.username}</div>
                                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{u.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td><strong>{u.employee_no ?? '—'}</strong></td>
                                                <td>{deptPos}</td>
                                                <td><Badge variant="badge-info">{u.role_name}</Badge></td>
                                                <td><Badge variant={u.status === 'Active' ? 'badge-success' : 'badge-warning'}>{u.status}</Badge></td>
                                                <td>
                                                    <button className="table-action-btn btn-view-user" title="View" onClick={() => void openView(u)}><Icon as={Eye} /></button>
                                                    <button className="table-action-btn btn-edit-user" title="Edit" onClick={() => openEdit(u)}><Icon as={Pencil} /></button>
                                                    <button className="table-action-btn btn-toggle-user" title={u.status === 'Active' ? 'Deactivate' : 'Activate'} disabled={busyId === u.id} onClick={() => void toggleStatus(u)}><Icon as={ToggleLeft} /></button>
                                                    <button className="table-action-btn btn-archive-user" title="Archive" disabled={busyId === u.id} onClick={() => void archive(u)}><Icon as={Archive} /></button>
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

            <Modal open={!!view} onClose={() => setView(null)} size="lg" title={<><Icon as={Eye} /> View System User</>}
                footer={<button className="btn btn-outline" onClick={() => setView(null)}>Close</button>}>
                <div className="modal-section">
                    <h4 className="modal-section-title"><Icon as={UserRound} /> User Details</h4>
                    <div className="info-grid">
                        <div className="info-item"><label>Full Name</label><div className="info-value" id="vuName">{view?.name || '-'}</div></div>
                        <div className="info-item"><label>Professional Email</label><div className="info-value" id="vuEmail">{view?.email || '-'}</div></div>
                        <div className="info-item"><label>Username</label><div className="info-value"><strong id="vuUsername">{view?.username || '-'}</strong></div></div>
                        <div className="info-item"><label>Employee ID</label><div className="info-value"><strong id="vuEmployeeNo">{view?.employeeNo || '-'}</strong></div></div>
                        <div className="info-item"><label>Mobile Contact</label><div className="info-value" id="vuMobile">{view?.mobile || '-'}</div></div>
                        <div className="info-item"><label>Date Hired</label><div className="info-value" id="vuDateHired">{view?.dateHired || '-'}</div></div>
                    </div>
                </div>
                <div className="modal-section">
                    <h4 className="modal-section-title"><Icon as={Briefcase} /> Assignment &amp; Role</h4>
                    <div className="info-grid">
                        <div className="info-item"><label>Department</label><div className="info-value" id="vuDepartment">{view?.department || '-'}</div></div>
                        <div className="info-item"><label>Designation / Position</label><div className="info-value" id="vuPosition">{view?.position || '-'}</div></div>
                        <div className="info-item"><label>System Access Role</label><div className="info-value" id="vuRole">{view?.roleName || '-'}</div></div>
                        <div className="info-item"><label>Account Status</label><div className="info-value" id="vuStatus">{view?.status || '-'}</div></div>
                        <div className="info-item"><label>Last Login</label><div className="info-value" id="vuLastLogin">{view?.lastLogin || '-'}</div></div>
                    </div>
                </div>
            </Modal>

            <Modal open={!!editing} onClose={() => setEditing(null)} size="lg" title={<><Icon as={Pencil} /> Edit System User</>}
                footer={<>
                    <button className="btn btn-outline" onClick={() => setEditing(null)}>Cancel</button>
                    <button className="btn btn-primary" id="saveUserChanges" disabled={saving} onClick={() => void saveEdit()}><Icon as={Save} /> Save Changes</button>
                </>}>
                <form id="editUserForm" onSubmit={e => e.preventDefault()}>
                    <div className="modal-section">
                        <h4 className="modal-section-title"><Icon as={UserRound} /> User Details</h4>
                        <div className="info-grid">
                            <div className="info-item"><label>First Name</label><input type="text" className="form-input" id="euFirstName" required value={form.first} onChange={setF('first')} /></div>
                            <div className="info-item"><label>Last Name</label><input type="text" className="form-input" id="euLastName" required value={form.last} onChange={setF('last')} /></div>
                            <div className="info-item"><label>Middle Name</label><input type="text" className="form-input" id="euMiddleName" value={form.middle} onChange={setF('middle')} /></div>
                            <div className="info-item"><label>Professional Email</label><input type="email" className="form-input" id="euEmail" required value={form.email} onChange={setF('email')} /></div>
                            <div className="info-item"><label>Mobile Contact Number</label><input type="tel" className="form-input" id="euMobile" value={form.mobile} onChange={setF('mobile')} /></div>
                            <div className="info-item"><label>Username (Employee ID)</label><input type="text" className="form-input" id="euUsername" readOnly style={ro} value={editing?.username ?? ''} /></div>
                        </div>
                    </div>
                    <div className="modal-section">
                        <h4 className="modal-section-title"><Icon as={Briefcase} /> Assignment &amp; Role</h4>
                        <div className="info-grid">
                            <div className="info-item">
                                <label>Department</label>
                                <select className="form-input" id="euDepartment" value={form.department}
                                    onChange={e => setForm({ ...form, department: e.target.value, position: positionAfterDepartmentChange(data?.departments ?? [], data?.positions ?? [], e.target.value, form.position) })}>
                                    <option value="">Select department...</option>
                                    <DepartmentOptions departments={data?.departments ?? []} value={form.department} />
                                </select>
                            </div>
                            <div className="info-item">
                                <label>Designation / Position</label>
                                <select className="form-input" id="euPosition" value={form.position} onChange={setF('position')}>
                                    <option value="">{form.department ? 'Select designation...' : 'Select a department first...'}</option>
                                    <PositionOptions departments={data?.departments ?? []} positions={data?.positions ?? []} department={form.department} value={form.position} />
                                </select>
                            </div>
                            <div className="info-item">
                                <label>System Access Role</label>
                                <select className="form-input" id="euRole" required value={form.role} onChange={setF('role')}>
                                    {(data?.roles ?? []).map(r => <option value={r.id} key={r.id}>{r.role_name}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                    <div id="euError" style={{ color: 'var(--danger)', fontSize: '0.85rem' }}></div>
                </form>
            </Modal>
        </Page>
    );
}
