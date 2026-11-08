import { useMemo, useState } from 'react';
import { Ban, CalendarCheck, CheckCircle2, Clock, Eye, ListChecks, Pencil, Plus, Save, Scale, Tags, XCircle } from 'lucide-react';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import { Badge, EmptyRow, PageState, SearchBox, StatCard, StatsGrid } from '../../components/ui';
import { usePageData } from '../../hooks/usePageData';
import { leaveService, type LeaveBalance, type LeaveManagementPage as PageData, type LeaveRequest, type LeaveStatus, type LeaveTypeForm } from '../../services/leaveService';
import { ArchonAlert, confirmDialog, esc, promptText } from '../../utils/alerts';
import { phpMjY } from '../../utils/format';
import { rejectionReasonError } from '../applicants/ApplicantActions';
import { ClearFilters, DateRangeFilter, FilterCount, FilterSelect, SortTh, distinct, inDateRange, is, matchesText, useFilters, useTableView } from '../../components/TableControls';
import { Tabs, fmtDay } from '../attendance/shared';
import LeaveDetails, { LEAVE_BADGE, dayCount } from './LeaveDetails';

const req = <span style={{ color: 'var(--danger)' }}>*</span>;
const hint = { fontSize: '0.75rem', color: 'var(--text-muted)' } as const;

/** A cancellation reason: 10-500 characters, no < or >. */
export function cancelReasonError(value: string): string {
    const r = value.replace(/\s+/g, ' ').trim();
    if (r.length < 10) return 'Please enter the reason for cancellation (at least 10 characters).';
    if (r.length > 500) return 'The reason must be 500 characters or fewer.';
    if (/[<>]/.test(r)) return 'The reason cannot contain < or > characters.';
    return '';
}

/**
 * Leave Management: employees' leave requests (view, approve, reject,
 * cancel), leave types and the per-employee entitlements of credit-based types.
 */
export default function LeaveManagementPage() {
    const [tab, setTab] = useState<'requests' | 'types' | 'entitlements'>('requests');
    const [year, setYear] = useState(new Date().getFullYear());
    const { data, loading, error, retry, reload } = usePageData(() => leaveService.page(year), [year]);
    const filters = useFilters({ search: '', status: '', type: '', department: '', position: '', from: '', to: '' });
    const f = filters.values;
    const [viewing, setViewing] = useState<LeaveRequest | null>(null);
    const [busy, setBusy] = useState(false);

    const list = useMemo(() => data?.requests ?? [], [data]);
    const view = useTableView(list, r => is(f.status, r.status) && (!f.type || String(r.leave_type_id) === f.type) && is(f.department, r.department)
        && is(f.position, r.position) && inDateRange(r.start_date, f.from, f.to)
        && matchesText(f.search, r.request_no, r.employee_no, r.full_name, r.department, r.position, r.leave_type, r.reason), {
        no: r => r.request_no, employee_no: r => r.employee_no, name: r => r.full_name, department: r => r.department, position: r => r.position,
        type: r => r.leave_type, start: r => r.start_date, end: r => r.end_date, days: r => Number(r.days), reason: r => r.reason,
        requested: r => r.created_at, status: r => r.status,
    });
    const rows = view.rows;
    const count = (s: LeaveStatus) => list.filter(r => r.status === s).length;
    const today = data?.today ?? '';
    const own = (r: LeaveRequest) => data?.my_employee_id === r.employee_id;
    const canCancel = (r: LeaveRequest) => r.status === 'Pending' || (r.status === 'Approved' && r.end_date >= today);

    const done = async (message: string) => {
        setViewing(null);
        await ArchonAlert.success(message, { timer: 1800 });
        await reload();
    };
    const run = async (fn: () => Promise<{ message: string }>, fail: string) => {
        setBusy(true);
        try {
            await done((await fn()).message);
        } catch (err) {
            await ArchonAlert.error(err instanceof Error ? err.message : fail);
            await reload();
        } finally {
            setBusy(false);
        }
    };

    const approve = async (r: LeaveRequest) => {
        const ok = await confirmDialog({
            title: 'Approve Leave Request',
            paragraphs: [`Approve ${r.request_no} of ${r.full_name}? These dates will show as On Leave in Time & Attendance, and the employee will be notified.`],
            details: [
                { label: 'Leave Type', value: r.leave_type },
                { label: 'Dates', value: `${phpMjY(r.start_date)} - ${phpMjY(r.end_date)}` },
                { label: 'Days', value: dayCount(r.days) },
            ],
            icon: 'question', confirmText: 'Approve',
        });
        if (ok) await run(() => leaveService.approve(r.id), 'The leave request could not be approved.');
    };
    const reject = async (r: LeaveRequest) => {
        const reason = await promptText({
            title: 'Reject Leave Request',
            html: `<p>Reject <strong>${esc(r.request_no)}</strong> (${esc(r.leave_type)}, ${esc(phpMjY(r.start_date))} - ${esc(phpMjY(r.end_date))}) of ${esc(r.full_name)}?</p><p>The employee will see this reason.</p>`,
            label: 'Reason for Rejection', placeholder: 'e.g., The team is short-staffed on these dates; please choose other dates.',
            confirmText: 'Reject Request', danger: true, validate: rejectionReasonError,
        });
        if (reason !== null) await run(() => leaveService.reject(r.id, reason), 'The leave request could not be rejected.');
    };
    const cancel = async (r: LeaveRequest) => {
        const reason = await promptText({
            title: 'Cancel Leave Request',
            html: `<p>Cancel <strong>${esc(r.request_no)}</strong> (${esc(r.status)}) of ${esc(r.full_name)}?${r.status === 'Approved' ? ' The dates return to normal work days.' : ''}</p><p>The employee will see this reason.</p>`,
            label: 'Reason for Cancellation', placeholder: 'e.g., Filed by mistake; the employee will file again with the correct dates.',
            confirmText: 'Cancel Request', danger: true, validate: cancelReasonError,
        });
        if (reason !== null) await run(() => leaveService.cancel(r.id, reason), 'The leave request could not be cancelled.');
    };

    const actions = (r: LeaveRequest) => (
        <>
            <button className="table-action-btn btn-lv-view" title="View" onClick={() => setViewing(r)}><Icon as={Eye} /></button>
            {r.status === 'Pending' && !own(r) && <>
                <button className="table-action-btn btn-lv-approve" title="Approve" disabled={busy} style={{ color: 'var(--success)' }} onClick={() => void approve(r)}><Icon as={CheckCircle2} /></button>
                <button className="table-action-btn btn-lv-reject" title="Reject" disabled={busy} style={{ color: 'var(--danger)' }} onClick={() => void reject(r)}><Icon as={XCircle} /></button>
            </>}
            {canCancel(r) && <button className="table-action-btn btn-lv-cancel" title="Cancel" disabled={busy} onClick={() => void cancel(r)}><Icon as={Ban} /></button>}
        </>
    );

    return (
        <>
            <Tabs id="lvTabs" active={tab} onChange={setTab} tabs={[
                { key: 'requests', label: <><Icon as={ListChecks} /> Leave Requests</> },
                { key: 'types', label: <><Icon as={Tags} /> Leave Types</> },
                { key: 'entitlements', label: <><Icon as={Scale} /> Entitlements</> },
            ]} />
            <PageState loading={loading} error={error} onRetry={retry} />
            {data && tab === 'requests' && (
                <>
                    <StatsGrid>
                        <StatCard icon={Clock} gradient={['#fbbf24', '#f59e0b']} value={count('Pending')} label="Pending" />
                        <StatCard icon={CheckCircle2} gradient={['#34d399', '#10b981']} value={count('Approved')} label="Approved" />
                        <StatCard icon={XCircle} gradient={['#f87171', '#ef4444']} value={count('Rejected')} label="Rejected" />
                        <StatCard icon={Ban} gradient={['#94a3b8', '#64748b']} value={count('Cancelled')} label="Cancelled" />
                    </StatsGrid>
                    <div className="page-toolbar">
                        <div className="toolbar-left">
                            <SearchBox value={f.search} onChange={filters.set('search')} placeholder="Search request ID, employee, reason..." id="lvSearch" />
                            <select className="form-select" id="lvStatusFilter" aria-label="Status" value={f.status} onChange={e => filters.set('status')(e.target.value)}>
                                <option value="">All Statuses</option>
                                {(['Pending', 'Approved', 'Rejected', 'Cancelled'] as LeaveStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <select className="form-select" id="lvTypeFilter" aria-label="Leave type" value={f.type} onChange={e => filters.set('type')(e.target.value)}>
                                <option value="">All Leave Types</option>
                                {data.types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                            <select className="form-select" id="lvDeptFilter" aria-label="Department" value={f.department} onChange={e => filters.set('department')(e.target.value)}>
                                <option value="">All Departments</option>
                                {data.departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                            </select>
                            <FilterSelect id="lvPositionFilter" label="Positions" value={f.position} onChange={filters.set('position')} options={distinct(list, r => r.position)} />
                            <DateRangeFilter id="lvDate" label="Leave Date" from={f.from} to={f.to} onFrom={filters.set('from')} onTo={filters.set('to')} />
                            <ClearFilters id="lvClear" active={filters.active} onClear={filters.clear} />
                            <FilterCount shown={rows.length} total={list.length} />
                        </div>
                    </div>
                    <div className="card hover-card">
                        <div className="card-body no-padding">
                            <table className="data-table" id="leaveRequestsTable">
                                <thead>
                                    <tr><SortTh view={view} k="no">Request ID</SortTh><SortTh view={view} k="employee_no">Employee ID</SortTh><SortTh view={view} k="name">Employee Name</SortTh><SortTh view={view} k="department">Department</SortTh><SortTh view={view} k="position">Position</SortTh><SortTh view={view} k="type">Leave Type</SortTh>
                                        <SortTh view={view} k="start">Start Date</SortTh><SortTh view={view} k="end">End Date</SortTh><SortTh view={view} k="days">No. of Days</SortTh><SortTh view={view} k="reason">Reason</SortTh><SortTh view={view} k="requested">Date Requested</SortTh><SortTh view={view} k="status">Status</SortTh><th>Actions</th></tr>
                                </thead>
                                <tbody>
                                    {!rows.length ? <EmptyRow colSpan={13}>{list.length ? 'No records found. Try other filters or clear them.' : 'No leave requests yet. Employees file them from Profile > My Leave.'}</EmptyRow>
                                        : rows.map(r => (
                                            <tr className="hover-row" key={r.id} data-id={r.id} data-status={r.status}>
                                                <td className="att-nowrap"><strong>{r.request_no}</strong></td>
                                                <td className="att-nowrap">{r.employee_no}</td>
                                                <td>{r.full_name}</td>
                                                <td>{r.department}</td>
                                                <td>{r.position}</td>
                                                <td>{r.leave_type}</td>
                                                <td className="att-nowrap">{phpMjY(r.start_date)}</td>
                                                <td className="att-nowrap">{phpMjY(r.end_date)}</td>
                                                <td>{r.days}</td>
                                                <td style={{ maxWidth: 220 }} title={r.reason}><span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.reason}</span></td>
                                                <td className="att-nowrap">{phpMjY(r.created_at)}</td>
                                                <td><Badge variant={LEAVE_BADGE[r.status]}>{r.status}</Badge></td>
                                                <td className="att-nowrap">{actions(r)}</td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
            {data && tab === 'types' && <LeaveTypesView data={data} reload={reload} />}
            {data && tab === 'entitlements' && <EntitlementsView data={data} year={year} setYear={setYear} reload={reload} />}

            <Modal open={!!viewing} onClose={() => setViewing(null)} size="lg" title={<><Icon as={CalendarCheck} /> Leave Request {viewing?.request_no}</>}
                footer={viewing && <>
                    <button className="btn btn-outline" onClick={() => setViewing(null)}>Close</button>
                    {canCancel(viewing) && <button className="btn btn-outline" id="lvViewCancel" disabled={busy} onClick={() => void cancel(viewing)}><Icon as={Ban} /> Cancel Request</button>}
                    {viewing.status === 'Pending' && !own(viewing) && <>
                        <button className="btn btn-danger" id="lvViewReject" disabled={busy} onClick={() => void reject(viewing)}><Icon as={XCircle} /> Reject</button>
                        <button className="btn btn-success" id="lvViewApprove" disabled={busy} onClick={() => void approve(viewing)}><Icon as={CheckCircle2} /> Approve</button>
                    </>}
                </>}>
                {viewing && <>
                    {viewing.status === 'Pending' && own(viewing) && <p className="att-note" style={{ margin: '0 0 1rem' }}>This is your own leave request: another authorized user must approve or reject it.</p>}
                    <LeaveDetails request={viewing} />
                </>}
            </Modal>
        </>
    );
}

function LeaveTypesView({ data, reload }: { data: PageData; reload: () => Promise<unknown> }) {
    const [form, setForm] = useState<LeaveTypeForm | null>(null);
    const tf = useFilters({ search: '', status: '', credits: '', paid: '' });
    const yesNo = (want: string, v: boolean) => !want || (want === 'yes') === v;
    const typeView = useTableView(data.types, t => matchesText(tf.values.search, t.name, t.code, t.description) && is(tf.values.status, t.status)
        && yesNo(tf.values.credits, t.with_credits) && yesNo(tf.values.paid, t.is_paid), {
        name: t => t.name, code: t => t.code, credits: t => t.with_credits, paid: t => t.is_paid, document: t => t.requires_document,
        requests: t => Number(t.request_count), status: t => t.status,
    });
    const [busy, setBusy] = useState(false);
    const save = async () => {
        if (!form) return;
        if (!/^[A-Za-z0-9]{1,10}$/.test(form.code.trim()) || form.name.trim().length < 2) {
            await ArchonAlert.warning('Enter a code (1-10 letters or digits) and a name.', { title: 'Missing Information' });
            return;
        }
        setBusy(true);
        try {
            const res = await leaveService.saveType(form);
            setForm(null);
            await ArchonAlert.success(res.message, { timer: 1600 });
            await reload();
        } catch (err) {
            await ArchonAlert.error(err instanceof Error ? err.message : 'The leave type could not be saved.');
        } finally {
            setBusy(false);
        }
    };
    const flag = (k: 'with_credits' | 'is_paid' | 'requires_document', label: string, help: string) => form && (
        <div className="form-group full-width">
            <label className="checkbox-label" style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontWeight: 400 }}>
                <input type="checkbox" id={`lt_${k}`} checked={form[k]} onChange={e => setForm({ ...form, [k]: e.target.checked })} style={{ marginTop: 3 }} />
                <span><strong>{label}</strong><br /><span style={hint}>{help}</span></span>
            </label>
        </div>
    );
    return (
        <>
            <div className="page-toolbar">
                <div className="toolbar-left">
                    <button className="btn btn-primary" id="ltBtnNew" onClick={() => setForm({ code: '', name: '', description: '', with_credits: true, is_paid: true, requires_document: false, status: 'Active' })}><Icon as={Plus} /> New Leave Type</button>
                </div>
            </div>
            <p className="att-note">A type <strong>with credits</strong> can only be used by employees you give an entitlement (Entitlements tab); nobody is entitled by default.</p>
            <div className="toolbar-left" style={{ marginBottom: '1rem' }}>
                <SearchBox value={tf.values.search} onChange={tf.set('search')} placeholder="Search leave type or code..." id="ltSearch" />
                <FilterSelect id="ltStatusFilter" label="Statuses" value={tf.values.status} onChange={tf.set('status')} options={['Active', 'Inactive']} />
                <FilterSelect id="ltCreditsFilter" label="Credit Rules" value={tf.values.credits} onChange={tf.set('credits')} options={[{ value: 'yes', label: 'Entitlement required' }, { value: 'no', label: 'No credits' }]} />
                <FilterSelect id="ltPaidFilter" label="Paid / Unpaid" allLabel="Paid and Unpaid" value={tf.values.paid} onChange={tf.set('paid')} options={[{ value: 'yes', label: 'Paid' }, { value: 'no', label: 'Unpaid' }]} />
                <ClearFilters id="ltClear" active={tf.active} onClear={tf.clear} />
            </div>
            <div className="card hover-card">
                <div className="card-body no-padding">
                    <table className="data-table" id="leaveTypesTable">
                        <thead><tr><SortTh view={typeView} k="name">Leave Type</SortTh><SortTh view={typeView} k="code">Code</SortTh><SortTh view={typeView} k="credits">Credits</SortTh><SortTh view={typeView} k="paid">Paid</SortTh><SortTh view={typeView} k="document">Supporting Document</SortTh><SortTh view={typeView} k="requests">Requests</SortTh><SortTh view={typeView} k="status">Status</SortTh><th>Actions</th></tr></thead>
                        <tbody>
                            {typeView.rows.map(t => (
                                <tr className="hover-row" key={t.id}>
                                    <td><strong>{t.name}</strong>{t.description && <div className="att-muted">{t.description}</div>}</td>
                                    <td>{t.code}</td>
                                    <td>{t.with_credits ? 'Entitlement required' : 'No credits'}</td>
                                    <td>{t.is_paid ? 'Paid' : 'Unpaid'}</td>
                                    <td>{t.requires_document ? 'Required' : 'Optional'}</td>
                                    <td>{t.request_count}</td>
                                    <td><Badge variant={t.status === 'Active' ? 'badge-success' : 'badge-secondary'}>{t.status}</Badge></td>
                                    <td><button className="table-action-btn" title="Edit" onClick={() => setForm({
                                        id: t.id, code: t.code, name: t.name, description: t.description ?? '', with_credits: t.with_credits,
                                        is_paid: t.is_paid, requires_document: t.requires_document, status: t.status,
                                    })}><Icon as={Pencil} /></button></td>
                                </tr>
                            ))}
                            {!data.types.length ? <EmptyRow colSpan={8}>No leave types yet.</EmptyRow> : !typeView.rows.length && <EmptyRow colSpan={8}>No records found. Try other filters or clear them.</EmptyRow>}
                        </tbody>
                    </table>
                </div>
            </div>
            <Modal open={!!form} onClose={() => setForm(null)} title={<><Icon as={Tags} /> {form?.id ? 'Edit Leave Type' : 'New Leave Type'}</>}
                footer={<>
                    <button className="btn btn-outline" onClick={() => setForm(null)}>Cancel</button>
                    <button className="btn btn-primary" id="ltSaveBtn" disabled={busy} onClick={() => void save()}><Icon as={Save} /> Save</button>
                </>}>
                {form && (
                    <form className="modal-form-grid" onSubmit={e => e.preventDefault()}>
                        <div className="form-group">
                            <label htmlFor="ltName">Name {req}</label>
                            <input type="text" className="form-input" id="ltName" maxLength={60} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="ltCode">Code {req}</label>
                            <input type="text" className="form-input" id="ltCode" maxLength={10} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} style={{ textTransform: 'uppercase' }} />
                        </div>
                        <div className="form-group full-width">
                            <label htmlFor="ltDesc">Description</label>
                            <input type="text" className="form-input" id="ltDesc" maxLength={255} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                        </div>
                        {flag('with_credits', 'Uses leave credits', 'Employees need an entitlement for the year, and requests cannot exceed the remaining days.')}
                        {flag('is_paid', 'Paid leave', 'For information (payroll).')}
                        {flag('requires_document', 'Supporting document required', 'The employee must attach a document (PDF, JPG, PNG, DOC, DOCX; max 5 MB).')}
                        <div className="form-group">
                            <label htmlFor="ltStatus">Status</label>
                            <select className="form-input" id="ltStatus" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </div>
                    </form>
                )}
            </Modal>
        </>
    );
}

function EntitlementsView({ data, year, setYear, reload }: { data: PageData; year: number; setYear: (y: number) => void; reload: () => Promise<unknown> }) {
    const [form, setForm] = useState<{ employee_id: string; leave_type_id: string; year: string; days: string } | null>(null);
    const ef = useFilters({ search: '', department: '', type: '' });
    const [busy, setBusy] = useState(false);
    const thisYear = new Date().getFullYear();
    const creditTypes = data.types.filter(t => t.with_credits && t.status === 'Active');
    const view = useTableView(data.balances, (b: LeaveBalance) => matchesText(ef.values.search, b.employee_no, b.full_name, b.department, b.leave_type)
        && is(ef.values.department, b.department) && is(ef.values.type, b.leave_type), {
        name: b => b.full_name, department: b => b.department, type: b => b.leave_type, year: b => b.year, days: b => Number(b.days),
        used: b => Number(b.used), pending: b => Number(b.pending), remaining: b => Number(b.remaining),
    });
    const rows = view.rows;
    const save = async () => {
        if (!form) return;
        if (!form.employee_id || !form.leave_type_id || !/^\d{1,3}(\.[05])?$/.test(form.days)) {
            await ArchonAlert.warning('Select the employee and leave type, and enter the days (whole or half days, 0-365).', { title: 'Missing Information' });
            return;
        }
        setBusy(true);
        try {
            const res = await leaveService.saveEntitlement(form);
            setForm(null);
            await ArchonAlert.success(res.message, { timer: 1600 });
            if (Number(form.year) !== year) setYear(Number(form.year)); else await reload();
        } catch (err) {
            await ArchonAlert.error(err instanceof Error ? err.message : 'The entitlement could not be saved.');
        } finally {
            setBusy(false);
        }
    };
    return (
        <>
            <div className="page-toolbar">
                <div className="toolbar-left">
                    <button className="btn btn-primary" id="leBtnNew" onClick={() => setForm({ employee_id: '', leave_type_id: '', year: String(year), days: '' })}><Icon as={Plus} /> Set Entitlement</button>
                    <SearchBox value={ef.values.search} onChange={ef.set('search')} placeholder="Search employee or type..." id="leSearch" />
                    <select className="form-select" id="leYear" value={year} onChange={e => setYear(Number(e.target.value))}>
                        {[thisYear - 1, thisYear, thisYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <FilterSelect id="leDeptFilter" label="Departments" value={ef.values.department} onChange={ef.set('department')} options={distinct(data.balances, b => b.department)} />
                    <FilterSelect id="leTypeFilter" label="Leave Types" value={ef.values.type} onChange={ef.set('type')} options={distinct(data.balances, b => b.leave_type)} />
                    <ClearFilters id="leClear" active={ef.active} onClear={ef.clear} />
                    <FilterCount shown={rows.length} total={data.balances.length} />
                </div>
            </div>
            <div className="card hover-card">
                <div className="card-body no-padding">
                    <table className="data-table" id="entitlementsTable">
                        <thead><tr><SortTh view={view} k="name">Employee</SortTh><SortTh view={view} k="department">Department</SortTh><SortTh view={view} k="type">Leave Type</SortTh><SortTh view={view} k="year">Year</SortTh><SortTh view={view} k="days" className="att-num">Entitled</SortTh>
                            <SortTh view={view} k="used" className="att-num">Used</SortTh><SortTh view={view} k="pending" className="att-num">Pending</SortTh><SortTh view={view} k="remaining" className="att-num">Remaining</SortTh><th>Actions</th></tr></thead>
                        <tbody>
                            {!rows.length ? <EmptyRow colSpan={9}>{data.balances.length ? 'No records found. Try other filters or clear them.' : <>No entitlements for {year}. Employees can only use credit-based leave types after you set one.</>}</EmptyRow> : rows.map(b => (
                                <tr className="hover-row" key={b.id}>
                                    <td><strong>{b.full_name}</strong><div className="att-muted">{b.employee_no}</div></td>
                                    <td>{b.department}</td>
                                    <td>{b.leave_type}</td>
                                    <td>{b.year}</td>
                                    <td className="att-num">{b.days}</td>
                                    <td className="att-num">{b.used}</td>
                                    <td className="att-num">{b.pending}</td>
                                    <td className="att-num"><strong>{b.remaining}</strong></td>
                                    <td><button className="table-action-btn" title="Edit" onClick={() => setForm({ employee_id: String(b.employee_id), leave_type_id: String(b.leave_type_id), year: String(b.year), days: String(b.days) })}><Icon as={Pencil} /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <Modal open={!!form} onClose={() => setForm(null)} title={<><Icon as={Scale} /> Set Leave Entitlement</>}
                footer={<>
                    <button className="btn btn-outline" onClick={() => setForm(null)}>Cancel</button>
                    <button className="btn btn-primary" id="leSaveBtn" disabled={busy} onClick={() => void save()}><Icon as={Save} /> Save</button>
                </>}>
                {form && (
                    <form className="modal-form-grid" onSubmit={e => e.preventDefault()}>
                        <div className="form-group full-width">
                            <label htmlFor="leEmployee">Employee {req}</label>
                            <select className="form-input" id="leEmployee" value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })}>
                                <option value="">Select employee&hellip;</option>
                                {data.employees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_no}) - {e.department}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="leType">Leave Type {req}</label>
                            <select className="form-input" id="leType" value={form.leave_type_id} onChange={e => setForm({ ...form, leave_type_id: e.target.value })}>
                                <option value="">Select type&hellip;</option>
                                {creditTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="leYearInput">Year {req}</label>
                            <select className="form-input" id="leYearInput" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })}>
                                {[thisYear - 1, thisYear, thisYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="leDays">Days Entitled {req}</label>
                            <input type="number" className="form-input" id="leDays" min={0} max={365} step={0.5} value={form.days} onChange={e => setForm({ ...form, days: e.target.value })} />
                            <span style={hint}>Cannot be lower than the days already approved or pending.</span>
                        </div>
                    </form>
                )}
            </Modal>
            <p className="att-note" style={{ marginTop: '0.75rem' }}>Dates shown on requests: {fmtDay(`${year}-01-01`)} to {fmtDay(`${year}-12-31`)} count toward {year}.</p>
        </>
    );
}
