import { useEffect, useMemo, useState } from 'react';
import { Archive, Building2, CheckCircle2, Crown, Eye, Pencil, SquarePen, UserMinus, Users, XCircle } from 'lucide-react';
import { InfoChangeRequestModal, InfoRequestsTable } from '../../components/LockedInfo';
import { useAuth } from '../../hooks/AuthContext';
import { rejectionReasonError } from '../applicants/ApplicantActions';
import type { InfoChangeRequest } from '../../types';
import Icon from '../../components/Icon';
import { assignmentError } from '../../components/assignment';
import { Badge, Card, EmptyRow, Page, PageHeader, PageState, PersonCell, SearchBox, StatCard, StatsGrid } from '../../components/ui';
import { BarColumns, Donut, Legend } from '../../components/charts';
import { usePageData } from '../../hooks/usePageData';
import { employeeService } from '../../services/employeeService';
import { ArchonAlert, confirmDialog, esc, promptText } from '../../utils/alerts';
import { deptAbbrev, isoDateFromToday, num, phpMjY } from '../../utils/format';
import { ClearFilters, DateRangeFilter, FilterCount, FilterSelect, SortSelect, SortTh, distinct, inDateRange, is, matchesText, useFilters, useTableView } from '../../components/TableControls';
import { toEmployeeView, UpdateEmployeeModal, ViewEmployeeModal, type EmployeeForm, type EmployeeView } from './EmployeeModals';

export const STATUS_BADGE: Record<string, string> = { Active: 'badge-success', 'On Leave': 'badge-warning', Inactive: 'badge-danger' };

/** Core HCM - Employee Directory (Human Capital). */
export default function EmployeeDirectoryPage() {
    const { session } = useAuth();
    const { data, loading, error, retry, reload, setData } = usePageData(employeeService.hcmPage);
    const filters = useFilters({ search: '', department: '', position: '', status: '', contract: '', from: '', to: '' });
    const f = filters.values;
    const icrFilters = useFilters({ search: '', field: '', from: '', to: '' });
    const [viewing, setViewing] = useState<EmployeeView | null>(null);
    const [updating, setUpdating] = useState<EmployeeView | null>(null);
    const [saving, setSaving] = useState(false);
    const [requestFor, setRequestFor] = useState<EmployeeView | null>(null);
    const [icrStatus, setIcrStatus] = useState('Pending');

    // Nobody reviews a request they filed or one about their own record.
    const ownRequest = (r: InfoChangeRequest) => r.requested_by === session?.user.id || (data?.my_employee_id ?? -1) === r.employee_id;
    const reviewRequest = async (r: InfoChangeRequest, decision: 'approve' | 'reject') => {
        let remarks = '';
        if (decision === 'approve') {
            const ok = await confirmDialog({
                title: 'Approve Information Change',
                paragraphs: [`Approve ${r.request_no}? ${r.full_name}'s ${r.field_label.toLowerCase()} will be updated in the employee record and everywhere it is shown, and the change is recorded in the Audit Logs.`],
                details: [
                    { label: 'Employee', value: `${r.full_name} (${r.employee_no})` },
                    { label: 'Information', value: r.field_label },
                    { label: 'Current Value', value: r.current_label },
                    { label: 'Requested Value', value: r.requested_label },
                    { label: 'Reason', value: r.reason },
                    { label: 'Requested By', value: `${r.requested_by_name ?? '—'} on ${phpMjY(r.created_at)}` },
                ],
                icon: 'question', confirmText: 'Approve',
            });
            if (!ok) return;
        } else {
            const reason = await promptText({
                title: 'Reject Information Change',
                html: `<p>Reject <strong>${esc(r.request_no)}</strong>: ${esc(r.field_label)} ${esc(r.current_label)} &rarr; ${esc(r.requested_label)} for ${esc(r.full_name)}?</p><p>The information stays unchanged; the employee sees this reason.</p>`,
                label: 'Reason for Rejection', placeholder: 'e.g., The birth certificate submitted shows the recorded date.',
                confirmText: 'Reject Request', danger: true, validate: rejectionReasonError,
            });
            if (reason === null) return;
            remarks = reason;
        }
        setSaving(true);
        try {
            const res = decision === 'approve' ? await employeeService.approveInfoChange(r.id) : await employeeService.rejectInfoChange(r.id, remarks);
            await ArchonAlert.success(res.message, { timer: 2200 });
            await reload();
        } catch (err) {
            await ArchonAlert.error(err instanceof Error ? err.message : 'The request could not be reviewed.');
            await reload();
        } finally {
            setSaving(false);
        }
    };

    // Keep the Human Capital figures current while the page is open (automatic refresh: not user activity).
    useEffect(() => {
        const t = window.setInterval(() => {
            if (document.visibilityState !== 'visible') return;
            employeeService.hcmStats(true)
                .then(({ stats }) => setData(d => (d ? { ...d, workforce: stats } : d)))
                .catch(err => console.warn('HCM stats:', err instanceof Error ? err.message : err));
        }, 30000);
        return () => window.clearInterval(t);
    }, [setData]);

    // The official departments (from the database), then any other value still stored on an
    // employee record so those employees can be found too.
    const official = useMemo(() => (data?.departments ?? []).map(d => d.name), [data]);
    const deptOptions = useMemo(() => {
        const lower = new Set(official.map(n => n.toLowerCase()));
        const other = Array.from(new Set((data?.employees ?? []).map(e => (e.department ?? '').trim()).filter(n => n && !lower.has(n.toLowerCase()))))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        return [...official, ...other];
    }, [data, official]);

    const view = useTableView(data?.employees, e => matchesText(f.search, e.employee_no, e.full_name, e.department, e.position, e.employment_status)
        && (!f.department || (e.department ?? '').trim() === f.department) && is(f.position, e.position) && is(f.status, e.employment_status)
        && is(f.contract, e.contract_type) && inDateRange(e.date_hired, f.from, f.to), {
        no: e => e.employee_no, name: e => e.full_name, status: e => e.employment_status, department: e => e.department, position: e => e.position,
        hired: e => e.date_hired, contract: e => e.contract_type,
    });
    const icr = icrFilters.values;
    const icrRows = (data?.info_requests ?? []).filter(r => (!icrStatus || r.status === icrStatus) && is(icr.field, r.field_label)
        && inDateRange(r.created_at, icr.from, icr.to) && matchesText(icr.search, r.request_no, r.full_name, r.employee_no, r.department, r.requested_by_name, r.reason));

    const save = async (f: EmployeeForm) => {
        if (!updating?.dbId) { await ArchonAlert.error('Cannot identify this employee record.'); return; }
        if (f.dob && f.dob > isoDateFromToday()) {
            await ArchonAlert.warning('Date of birth cannot be in the future.', { title: 'Invalid Date of Birth' });
            return;
        }
        const invalid = assignmentError(data?.departments ?? [], data?.positions ?? [], f.department, f.position,
            { department: updating.department, position: updating.position });
        if (invalid) { await ArchonAlert.warning(invalid, { title: 'Invalid Department / Position' }); return; }
        setSaving(true);
        try {
            await employeeService.update({
                employee_id: updating.dbId,
                full_name: f.name.trim(),
                position: f.position.trim(),
                department: f.department.trim(),
                contract_type: f.contract,
                employment_status: f.status,
                email: f.email.trim(),
                mobile_number: f.phone.trim(),
                date_hired: f.joinDate,
                gender: f.gender,
                date_of_birth: f.dob,
                address: f.address.trim(),
            });
            setUpdating(null);
            await ArchonAlert.success('Employee record updated successfully.', { timer: 1800 });
            await reload();
        } catch (err) {
            await ArchonAlert.error('Could not update employee: ' + (err instanceof Error ? err.message : ''));
        } finally {
            setSaving(false);
        }
    };

    const archive = async (e: EmployeeView) => {
        const ok = await confirmDialog({
            title: 'Archive Employee',
            paragraphs: ['Are you sure you want to archive this employee?', 'This will mark the employee as archived. They will no longer appear in active lists but can be restored later.'],
            details: [{ label: 'Employee Name', value: e.name || '-' }],
            icon: 'warning', confirmText: 'Archive', danger: true,
        });
        if (!ok) return;
        try {
            await employeeService.archive(e.dbId);
            await ArchonAlert.success('Employee archived successfully.', { timer: 1800 });
            await reload();
        } catch (err) {
            await ArchonAlert.error('Could not archive employee: ' + (err instanceof Error ? err.message : ''));
        }
    };

    const w = data?.workforce;
    const dist = data?.dept_distribution;
    const hcMax = dist && dist.items.length ? Math.max(...dist.items.map(d => d.count)) : 1;

    return (
        <Page id="employee-directory">
            <PageHeader title="Core HCM - Employee Directory" subtitle="Complete workforce directory and organization" />
            <PageState loading={loading} error={error} onRetry={retry} />
            {data && w && dist && (
                <>
                    <StatsGrid>
                        <StatCard icon={Users} gradient={['#2563eb', '#1e40af']} value={<span id="hcmStatTotal">{num(w.total)}</span>} label="Total Employees" />
                        <StatCard icon={Crown} gradient={['#10b981', '#059669']} value={<span id="hcmStatActive">{num(w.active)}</span>} label="Active" />
                        <StatCard icon={UserMinus} gradient={['#f59e0b', '#d97706']} value={<span id="hcmStatOnLeave">{num(w.on_leave)}</span>} label="On Leave" />
                        <StatCard icon={Building2} gradient={['#8b5cf6', '#7c3aed']} value={<span id="hcmStatDepts">{num(w.depts)}</span>} label="Departments" />
                    </StatsGrid>
                    <div className="analytics-grid">
                        <Card className="analytics-card" title="Headcount by Department" subtitle="Workforce distribution">
                            {!dist.items.length ? (
                                <div className="chart-container">
                                    <div className="chart-bars" id="headcountChart">
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '0.5rem 0' }}>No employees yet.</p>
                                    </div>
                                </div>
                            ) : (
                                <BarColumns id="headcountChart" max={hcMax} items={dist.items.map(d => ({ label: deptAbbrev(d.name), value: d.count, title: d.name }))} />
                            )}
                        </Card>
                        <Card className="analytics-card" title="Employee Status" subtitle="Workforce status distribution">
                            <Donut id="statusDonut" segments={w.total > 0 ? w.statuses : []} value={w.total} label="Employees" totalId="statusDonutTotal" />
                            <Legend id="statusLegend" items={w.statuses.map(s => ({ name: s.name, pct: s.pct_label, count: s.count, color: s.color }))} />
                        </Card>
                    </div>
                    <div className="page-toolbar">
                        <div className="toolbar-left">
                            <SearchBox value={f.search} onChange={filters.set('search')} placeholder="Search name, employee ID..." />
                            <select className="form-select" id="hcmDeptFilter" aria-label="Department" value={f.department} onChange={e => filters.set('department')(e.target.value)}>
                                <option value="">All Departments</option>
                                {deptOptions.map(d => <option value={d} key={d}>{official.includes(d) ? d : `${d} (no longer available)`}</option>)}
                            </select>
                            <FilterSelect id="hcmPositionFilter" label="Positions" value={f.position} onChange={filters.set('position')} options={distinct(data.employees, e => e.position)} />
                            <FilterSelect id="hcmStatusFilter" label="Employment Statuses" value={f.status} onChange={filters.set('status')} options={distinct(data.employees, e => e.employment_status)} />
                            <FilterSelect id="hcmContractFilter" label="Contracts" value={f.contract} onChange={filters.set('contract')} options={distinct(data.employees, e => e.contract_type)} />
                            <DateRangeFilter id="hcmHired" label="Hired" from={f.from} to={f.to} onFrom={filters.set('from')} onTo={filters.set('to')} />
                            <SortSelect view={view} id="hcmSort" options={[{ key: 'name', label: 'Name' }, { key: 'no', label: 'Employee ID' }, { key: 'department', label: 'Department' },
                                { key: 'position', label: 'Position' }, { key: 'hired', label: 'Date Hired' }, { key: 'status', label: 'Status' }]} />
                            <ClearFilters id="hcmClear" active={filters.active} onClear={filters.clear} />
                            <FilterCount shown={view.rows.length} total={view.total} />
                        </div>
                    </div>
                    <div className="card hover-card">
                        <div className="card-body no-padding">
                            <table className="data-table" id="hcmEmployeeTable">
                                <thead><tr><SortTh view={view} k="no">Employee ID</SortTh><SortTh view={view} k="name">Name</SortTh><SortTh view={view} k="status">Status</SortTh><th>Actions</th></tr></thead>
                                <tbody>
                                    {!data.employees.length ? (
                                        <EmptyRow colSpan={4}>No employees yet. Employee records are created automatically when an applicant is hired.</EmptyRow>
                                    ) : !view.rows.length ? (
                                        <EmptyRow colSpan={4}>No records found. Try other filters or clear them.</EmptyRow>
                                    ) : view.rows.map((e, i) => {
                                        const ev = toEmployeeView(e);
                                        return (
                                            <tr className="hover-row" key={e.id}>
                                                <td><strong>{e.employee_no}</strong></td>
                                                <td><PersonCell index={i} name={e.full_name} /></td>
                                                <td><Badge variant={STATUS_BADGE[e.employment_status] ?? 'badge-info'}>{e.employment_status}</Badge></td>
                                                <td>
                                                    <button className="table-action-btn btn-view-employee" title="View" onClick={() => setViewing(ev)}><Icon as={Eye} /></button>
                                                    <button className="table-action-btn btn-edit-employee" title="Update" onClick={() => setUpdating(ev)}><Icon as={Pencil} /></button>
                                                    <button className="table-action-btn btn-archive-employee" title="Archive" onClick={() => void archive(ev)}><Icon as={Archive} /></button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Locked information: corrections requested by employees (or by HR on their behalf). */}
                    <div className="card hover-card" id="infoRequestsCard" style={{ marginTop: '1.5rem' }}>
                        <div className="card-header">
                            <div>
                                <h3 className="card-title"><Icon as={SquarePen} /> Information Change Requests</h3>
                                <p className="card-subtitle">Corrections to verified employee information (name, date of birth, gender, date hired). Approving updates the record everywhere it is used.</p>
                            </div>
                        </div>
                        <div className="card-body" style={{ paddingBottom: 0 }}>
                            <div className="toolbar-left" style={{ marginBottom: '1rem' }}>
                                <SearchBox id="icrSearch" value={icr.search} onChange={icrFilters.set('search')} placeholder="Search request no., employee..." />
                                <select className="form-select" id="icrStatusFilter" aria-label="Status" value={icrStatus} onChange={e => setIcrStatus(e.target.value)}>
                                    <option value="">All Statuses</option>
                                    {['Pending', 'Approved', 'Rejected', 'Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <FilterSelect id="icrFieldFilter" label="Information" allLabel="All Information" value={icr.field} onChange={icrFilters.set('field')} options={distinct(data.info_requests, r => r.field_label)} />
                                <DateRangeFilter id="icrDate" label="Requested" from={icr.from} to={icr.to} onFrom={icrFilters.set('from')} onTo={icrFilters.set('to')} />
                                <ClearFilters id="icrClear" active={icrFilters.active} onClear={icrFilters.clear} />
                            </div>
                        </div>
                        <div className="card-body no-padding">
                            <InfoRequestsTable id="infoRequestsTable" rows={icrRows}
                                empty={data.info_requests?.length ? 'No records found. Try other filters or clear them.' : 'No information change requests yet.'}
                                actions={r => r.status === 'Pending' ? (
                                    ownRequest(r)
                                        ? <span className="locked-muted">Another reviewer</span>
                                        : <>
                                            <button className="table-action-btn btn-icr-approve" title="Approve" style={{ color: 'var(--success)' }} disabled={saving} onClick={() => void reviewRequest(r, 'approve')}><Icon as={CheckCircle2} /></button>
                                            <button className="table-action-btn btn-icr-reject" title="Reject" style={{ color: 'var(--danger)' }} disabled={saving} onClick={() => void reviewRequest(r, 'reject')}><Icon as={XCircle} /></button>
                                        </>
                                ) : <span className="locked-muted">{r.reviewed_at ? phpMjY(r.reviewed_at) : '—'}</span>} />
                        </div>
                    </div>
                </>
            )}
            <ViewEmployeeModal employee={viewing} onClose={() => setViewing(null)} onRequestChange={e => { setViewing(null); setRequestFor(e); }} />
            <UpdateEmployeeModal employee={updating} departments={data?.departments ?? []} positions={data?.positions ?? []} onClose={() => setUpdating(null)} onSave={f => void save(f)} saving={saving} />
            {requestFor && (() => {
                const e = data?.employees.find(x => x.id === requestFor.dbId);
                return (
                    <InfoChangeRequestModal open={!!requestFor} onClose={() => setRequestFor(null)} onDone={() => void reload()}
                        employeeId={requestFor.dbId} employeeName={requestFor.name}
                        current={{ first_name: e?.first_name, middle_name: e?.middle_name, last_name: e?.last_name, date_of_birth: e?.date_of_birth, gender: e?.gender, date_hired: e?.date_hired }} />
                );
            })()}
        </Page>
    );
}
