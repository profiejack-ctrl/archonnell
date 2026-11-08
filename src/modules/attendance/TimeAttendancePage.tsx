import { useEffect, useMemo, useState } from 'react';
import {
    CalendarCheck, CalendarDays, CalendarX2, Clock, Coffee, Eye, FileSpreadsheet, Info, Pencil, Save, UserCheck, UserX, Users,
} from 'lucide-react';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import { EmptyRow, InfoItem, PageState, SearchBox, StatCard, StatsGrid } from '../../components/ui';
import { usePageData } from '../../hooks/usePageData';
import { attendanceService, type AttendanceDay, type AttendanceForm, type AttendanceStatus, type MonthlyReportRow } from '../../services/attendanceService';
import { backendUrl } from '../../services/http';
import { ArchonAlert, confirmDialog } from '../../utils/alerts';
import { isoDateFromToday, phpMjYgiA } from '../../utils/format';
import { ClearFilters, SortTh, matchesText, useTableView } from '../../components/TableControls';
import {
    ATTENDANCE_STATUSES, MonthPicker, StatusBadge, Tabs, addDays, fmtClock, fmtDay, fmtHours, fmtMinutes, monthRange, shiftTimes, weekRange,
} from './shared';

type Period = 'today' | 'yesterday' | 'week' | 'month' | 'pick-month' | 'date' | 'range';
const PER_PAGE = 50;
const req = <span style={{ color: 'var(--danger)' }}>*</span>;

function periodRange(p: Period, date: string, from: string, to: string, ym: [number, number]): [string, string] {
    const today = isoDateFromToday();
    switch (p) {
        case 'today': return [today, today];
        case 'yesterday': return [addDays(today, -1), addDays(today, -1)];
        case 'week': return weekRange(today);
        case 'month': { const d = new Date(); return monthRange(d.getFullYear(), d.getMonth() + 1); }
        case 'pick-month': return monthRange(ym[0], ym[1]);
        case 'date': return [date, date];
        default: return [from, to <= from ? from : to];
    }
}

/** "2026-10-01T08:00" for a datetime-local input. */
const localDT = (date: string, hhmm: string | null) => (hhmm ? `${date}T${hhmm}` : '');

/**
 * Time & Attendance: who has attendance for a day (or period), with the
 * schedule, time in / out, late, undertime, overtime and status of every
 * employee, plus the Monthly Attendance Report.
 */
export default function TimeAttendancePage() {
    const [tab, setTab] = useState<'daily' | 'monthly'>('daily');
    const [period, setPeriod] = useState<Period>('today');
    const [oneDate, setOneDate] = useState(isoDateFromToday());
    const [rangeFrom, setRangeFrom] = useState(addDays(isoDateFromToday(), -6));
    const [rangeTo, setRangeTo] = useState(isoDateFromToday());
    const [ym, setYm] = useState<[number, number]>(() => [new Date().getFullYear(), new Date().getMonth() + 1]);
    const [from, to] = periodRange(period, oneDate, rangeFrom, rangeTo, ym);
    const { data, loading, error, retry, reload } = usePageData(() => attendanceService.page(from, to), [from, to]);

    const [dept, setDept] = useState('');
    const [position, setPosition] = useState('');
    const [employee, setEmployee] = useState('');
    const [status, setStatus] = useState<'' | AttendanceStatus>('');
    const [shift, setShift] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [viewing, setViewing] = useState<AttendanceDay | null>(null);
    const [form, setForm] = useState<(AttendanceForm & { row: AttendanceDay }) | null>(null);
    const [busy, setBusy] = useState(false);

    const all = useMemo(() => data?.rows ?? [], [data]);
    const deptId = data?.departments.find(d => d.name === dept)?.id;
    const positions = (data?.positions ?? []).filter(p => !dept || p.department_id === deptId);
    const employees = useMemo(() => {
        const m = new Map<number, AttendanceDay>();
        all.forEach(r => { if (!m.has(r.employee_id)) m.set(r.employee_id, r); });
        return [...m.values()].sort((a, b) => a.full_name.localeCompare(b.full_name));
    }, [all]);

    // Everything except the status filter: the summary cards count within it.
    const scoped = useMemo(() => all.filter(r => (!dept || r.department === dept) && (!position || r.position === position)
        && (!employee || String(r.employee_id) === employee)
        && (!shift || (shift === 'none' ? r.shift_id === null : String(r.shift_id) === shift))
        && matchesText(search, r.employee_no, r.full_name, r.department, r.position, r.shift_name, r.status, r.remarks)), [all, dept, position, employee, shift, search]);
    const rows = useMemo(() => scoped.filter(r => !status || r.status === status), [scoped, status]);
    // Sorted before paging, so a sort covers every page, not just the one shown.
    const view = useTableView(rows, () => true, {
        no: r => r.employee_no, name: r => r.full_name, department: r => r.department, position: r => r.position, date: r => r.date,
        shift: r => r.shift_name, scheduled: r => r.start_time, in: r => r.time_in, out: r => r.time_out, hours: r => r.worked_minutes,
        late: r => r.late_minutes, undertime: r => r.undertime_minutes, overtime: r => r.overtime_minutes, status: r => r.status,
    });
    useEffect(() => { setPage(1); }, [from, to, dept, position, employee, status, shift, search, view.sort]);
    const filtersActive = !!(dept || position || employee || status || shift || search);
    const clearFilters = () => { setDept(''); setPosition(''); setEmployee(''); setStatus(''); setShift(''); setSearch(''); };

    const count = (s: AttendanceStatus) => scoped.filter(r => r.status === s).length;
    const people = new Set(scoped.map(r => r.employee_id)).size;
    const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
    const shown = view.rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);
    const today = data?.today ?? isoDateFromToday();
    const single = from === to;
    const title = single ? `${from === today ? "Today's Attendance" : 'Attendance'} · ${fmtDay(from)}` : `Attendance · ${fmtDay(from)} to ${fmtDay(to)}`;

    const openEdit = (r: AttendanceDay) => {
        const endDate = r.overnight ? addDays(r.date, 1) : r.date;
        setViewing(null);
        setForm({
            row: r, employee_id: r.employee_id, work_date: r.date,
            time_in: r.time_in ? r.time_in.slice(0, 16).replace(' ', 'T') : localDT(r.date, r.start_time),
            time_out: r.time_out ? r.time_out.slice(0, 16).replace(' ', 'T') : (r.time_in ? '' : localDT(endDate, r.end_time)),
            remarks: r.remarks ?? '', reason: '',
        });
    };

    const save = async () => {
        if (!form) return;
        const f = form;
        let invalid = '';
        if (!f.time_in) invalid = 'Time In is required.';
        else if (f.time_out && f.time_out <= f.time_in) invalid = 'Time Out must be later than Time In.';
        else if (f.reason.trim().length < 5) invalid = 'Please enter the reason for this change (at least 5 characters).';
        else if (/[<>]/.test(f.reason + f.remarks)) invalid = 'Please do not use < or > characters.';
        if (invalid) { await ArchonAlert.warning(invalid, { title: 'Check the Attendance' }); return; }
        const ok = await confirmDialog({
            title: f.row.record_id ? 'Modify Attendance' : 'Record Attendance',
            paragraphs: [`${f.row.record_id ? 'Update' : 'Record'} the attendance of ${f.row.full_name} for ${fmtDay(f.work_date)}? The change is saved in the Audit Logs.`],
            details: [
                { label: 'Time In', value: f.time_in.replace('T', ' ') },
                { label: 'Time Out', value: f.time_out ? f.time_out.replace('T', ' ') : 'None' },
            ],
            icon: 'question', confirmText: 'Save',
        });
        if (!ok) return;
        setBusy(true);
        try {
            const { row: _row, ...payload } = f;
            const res = await attendanceService.saveRecord(payload);
            setForm(null);
            await ArchonAlert.success(res.message, { timer: 1800 });
            await reload();
        } catch (err) {
            await ArchonAlert.error(err instanceof Error ? err.message : 'The attendance could not be saved.');
        } finally {
            setBusy(false);
        }
    };

    const setF = (k: keyof AttendanceForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm(f => (f ? { ...f, [k]: e.target.value } : f));

    return (
        <>
            <Tabs id="attTabs" active={tab} onChange={setTab} tabs={[
                { key: 'daily', label: <><Icon as={CalendarCheck} /> Daily Attendance</> },
                ...(data?.can_report ? [{ key: 'monthly' as const, label: <><Icon as={FileSpreadsheet} /> Monthly Report</> }] : []),
            ]} />

            {tab === 'daily' && (
                <>
                    <div className="att-filters" id="attPeriodBar">
                        <div className="att-field">
                            <label htmlFor="attPeriod">Period</label>
                            <select className="form-select" id="attPeriod" value={period} onChange={e => setPeriod(e.target.value as Period)}>
                                <option value="today">Today</option>
                                <option value="yesterday">Yesterday</option>
                                <option value="week">This Week</option>
                                <option value="month">This Month</option>
                                <option value="pick-month">Select Month</option>
                                <option value="date">Specific Date</option>
                                <option value="range">Custom Date Range</option>
                            </select>
                        </div>
                        {period === 'pick-month' && (
                            <div className="att-field"><label>Month / Year</label><div style={{ display: 'flex', gap: '0.5rem' }}>
                                <MonthPicker year={ym[0]} month={ym[1]} idPrefix="att" onChange={(y, m) => setYm([y, m])} />
                            </div></div>
                        )}
                        {period === 'date' && (
                            <div className="att-field">
                                <label htmlFor="attDate">Date</label>
                                <input type="date" className="form-input" id="attDate" value={oneDate} onChange={e => e.target.value && setOneDate(e.target.value)} />
                            </div>
                        )}
                        {period === 'range' && (
                            <>
                                <div className="att-field">
                                    <label htmlFor="attFrom">From</label>
                                    <input type="date" className="form-input" id="attFrom" value={rangeFrom} onChange={e => e.target.value && setRangeFrom(e.target.value)} />
                                </div>
                                <div className="att-field">
                                    <label htmlFor="attTo">To</label>
                                    <input type="date" className="form-input" id="attTo" min={rangeFrom} value={rangeTo} onChange={e => e.target.value && setRangeTo(e.target.value)} />
                                </div>
                            </>
                        )}
                        <div className="att-field">
                            <label htmlFor="attDept">Department</label>
                            <select className="form-select" id="attDept" value={dept} onChange={e => { setDept(e.target.value); setPosition(''); }}>
                                <option value="">All Departments</option>
                                {data?.departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                            </select>
                        </div>
                        <div className="att-field">
                            <label htmlFor="attPosition">Position</label>
                            <select className="form-select" id="attPosition" value={position} onChange={e => setPosition(e.target.value)}>
                                <option value="">All Positions</option>
                                {positions.map(p => <option key={p.id} value={p.title}>{p.title}</option>)}
                            </select>
                        </div>
                        <div className="att-field">
                            <label htmlFor="attEmployee">Employee</label>
                            <select className="form-select" id="attEmployee" value={employee} onChange={e => setEmployee(e.target.value)}>
                                <option value="">All Employees</option>
                                {employees.filter(r => (!dept || r.department === dept) && (!position || r.position === position))
                                    .map(r => <option key={r.employee_id} value={r.employee_id}>{r.full_name} ({r.employee_no})</option>)}
                            </select>
                        </div>
                        <div className="att-field">
                            <label htmlFor="attStatus">Attendance Status</label>
                            <select className="form-select" id="attStatus" value={status} onChange={e => setStatus(e.target.value as '' | AttendanceStatus)}>
                                <option value="">All Statuses</option>
                                {ATTENDANCE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="att-field">
                            <label htmlFor="attShift">Shift</label>
                            <select className="form-select" id="attShift" value={shift} onChange={e => setShift(e.target.value)}>
                                <option value="">All Shifts</option>
                                {data?.shifts.map(s => <option key={s.id} value={s.id}>{s.shift_name}</option>)}
                                <option value="none">No shift (rest day / unscheduled)</option>
                            </select>
                        </div>
                    </div>

                    <PageState loading={loading} error={error} onRetry={retry} />
                    {data && (
                        <>
                            <h2 className="att-period-title" id="attPeriodTitle">{title}</h2>
                            <StatsGrid>
                                <StatCard icon={Users} gradient={['#60a5fa', '#3b82f6']} value={people} label="Total Employees" />
                                <StatCard icon={UserCheck} gradient={['#34d399', '#10b981']} value={count('Present')} label="Present" />
                                <StatCard icon={Clock} gradient={['#fbbf24', '#f59e0b']} value={count('Late')} label="Late" />
                                <StatCard icon={UserX} gradient={['#f87171', '#ef4444']} value={count('Absent')} label="Absent" />
                                <StatCard icon={CalendarX2} gradient={['#a78bfa', '#7c3aed']} value={count('On Leave')} label="On Leave" />
                                <StatCard icon={Coffee} gradient={['#94a3b8', '#64748b']} value={count('Rest Day')} label="Rest Day" />
                                <StatCard icon={Info} gradient={['#fb7185', '#e11d48']} value={count('Incomplete')} label="Incomplete Attendance" />
                            </StatsGrid>
                            <p className="att-note" id="attOtherCounts">
                                {!single && <>Counts are employee-days in the period. </>}
                                Half Day: {count('Half Day')} · Holiday: {count('Holiday')} · Scheduled (no time in yet / upcoming): {count('Scheduled')} · No schedule assigned: {count('No Schedule')}
                            </p>
                            <div className="page-toolbar">
                                <div className="toolbar-left">
                                    <SearchBox value={search} onChange={setSearch} placeholder="Search employee, shift, remarks..." id="attSearch" />
                                    <ClearFilters id="attClear" active={filtersActive} onClear={clearFilters} />
                                </div>
                            </div>
                            <div className="card hover-card">
                                <div className="card-body no-padding">
                                    <table className="data-table" id="attendanceTable">
                                        <thead>
                                            <tr>
                                                <SortTh view={view} k="no">Employee ID</SortTh><SortTh view={view} k="name">Employee Name</SortTh><SortTh view={view} k="department">Department</SortTh><SortTh view={view} k="position">Position</SortTh><SortTh view={view} k="date">Date</SortTh><SortTh view={view} k="shift">Shift</SortTh><SortTh view={view} k="scheduled">Scheduled Time</SortTh>
                                                <SortTh view={view} k="in">Time In</SortTh><SortTh view={view} k="out">Time Out</SortTh><SortTh view={view} k="hours">Total Hours</SortTh><SortTh view={view} k="late">Late</SortTh><SortTh view={view} k="undertime">Undertime</SortTh><SortTh view={view} k="overtime">Overtime</SortTh>
                                                <SortTh view={view} k="status">Attendance Status</SortTh><th>Remarks</th><th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {!shown.length ? (
                                                <EmptyRow colSpan={16}>{all.length ? 'No records found. Try other filters or clear them.' : 'No active employees yet.'}</EmptyRow>
                                            ) : shown.map(r => (
                                                <tr className="hover-row" key={`${r.employee_id}-${r.date}`} data-employee={r.employee_id} data-date={r.date} data-status={r.status}>
                                                    <td className="att-nowrap">{r.employee_no}</td>
                                                    <td><strong>{r.full_name}</strong></td>
                                                    <td>{r.department}</td>
                                                    <td>{r.position}</td>
                                                    <td className="att-nowrap">{fmtDay(r.date)}</td>
                                                    <td>{r.shift_name ?? <span className="att-muted">{r.day_type === 'Rest Day' ? 'Rest Day' : 'No schedule'}</span>}</td>
                                                    <td className="att-nowrap">{r.shift_name ? shiftTimes(r.start_time, r.end_time, r.overnight) : '—'}</td>
                                                    <td className="att-nowrap">{fmtClock(r.time_in, r.date)}</td>
                                                    <td className="att-nowrap">{fmtClock(r.time_out, r.date)}</td>
                                                    <td className="att-nowrap">{fmtMinutes(r.worked_minutes, '0m')}</td>
                                                    <td className="att-nowrap" style={r.late_minutes ? { color: 'var(--warning)', fontWeight: 600 } : undefined}>{fmtMinutes(r.late_minutes)}</td>
                                                    <td className="att-nowrap">{fmtMinutes(r.undertime_minutes)}</td>
                                                    <td className="att-nowrap">{fmtMinutes(r.overtime_minutes)}</td>
                                                    <td><StatusBadge status={r.status} /></td>
                                                    <td style={{ minWidth: 140 }}>
                                                        {[r.holiday ? `Holiday: ${r.holiday.name}` : '', r.leave ? `${r.leave.leave_type} (${r.leave.request_no})` : '', r.remarks ?? '', ...r.notes]
                                                            .filter(Boolean).join(' · ') || <span className="att-muted">—</span>}
                                                    </td>
                                                    <td className="att-nowrap">
                                                        <button className="table-action-btn btn-att-view" title="View" onClick={() => setViewing(r)}><Icon as={Eye} /></button>
                                                        {r.date <= today && (
                                                            <button className="table-action-btn btn-att-edit" title={r.record_id ? 'Modify Attendance' : 'Record Attendance'} onClick={() => openEdit(r)}><Icon as={Pencil} /></button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {rows.length > PER_PAGE && (
                                        <div className="att-pager">
                                            <span>Showing {(page - 1) * PER_PAGE + 1}-{Math.min(page * PER_PAGE, rows.length)} of {rows.length}</span>
                                            <div className="att-pager-btns">
                                                <button className="btn btn-sm btn-outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                                                <button className="btn btn-sm btn-outline" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}

            {tab === 'monthly' && data?.can_report && <MonthlyReport departments={data.departments.map(d => d.name)} employees={employees} />}

            {/* Attendance details */}
            <Modal open={!!viewing} onClose={() => setViewing(null)} size="lg" title={<><Icon as={CalendarCheck} /> Attendance Details</>}
                footer={viewing && <>
                    <button className="btn btn-outline" onClick={() => setViewing(null)}>Close</button>
                    {viewing.date <= today && <button className="btn btn-primary" id="attViewEdit" onClick={() => openEdit(viewing)}><Icon as={Pencil} /> {viewing.record_id ? 'Modify Attendance' : 'Record Attendance'}</button>}
                </>}>
                {viewing && <AttendanceDetails r={viewing} />}
            </Modal>

            {/* Record / modify attendance */}
            <Modal open={!!form} onClose={() => setForm(null)} size="lg" title={<><Icon as={Pencil} /> {form?.row.record_id ? 'Modify Attendance' : 'Record Attendance'}</>}
                footer={<>
                    <button className="btn btn-outline" onClick={() => setForm(null)}>Cancel</button>
                    <button type="button" className="btn btn-primary" id="attSaveBtn" disabled={busy} onClick={() => void save()}><Icon as={Save} /> Save</button>
                </>}>
                {form && (
                    <form id="attendanceForm" className="modal-form-grid" onSubmit={e => e.preventDefault()}>
                        <div className="form-group">
                            <label>Employee</label>
                            <input type="text" className="form-input" readOnly value={`${form.row.full_name} (${form.row.employee_no})`} style={{ background: 'var(--bg-secondary)' }} />
                        </div>
                        <div className="form-group">
                            <label>Work Date</label>
                            <input type="text" className="form-input" readOnly value={fmtDay(form.work_date)} style={{ background: 'var(--bg-secondary)' }} />
                        </div>
                        <div className="form-group full-width">
                            <label>Scheduled Shift</label>
                            <input type="text" className="form-input" readOnly style={{ background: 'var(--bg-secondary)' }}
                                value={form.row.shift_name ? `${form.row.shift_name}: ${shiftTimes(form.row.start_time, form.row.end_time, form.row.overnight)}` : (form.row.day_type === 'Rest Day' ? 'Rest day (all hours count as overtime)' : 'No shift scheduled')} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="attTimeIn">Time In {req}</label>
                            <input type="datetime-local" className="form-input" id="attTimeIn" value={form.time_in} onChange={setF('time_in')} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="attTimeOut">Time Out</label>
                            <input type="datetime-local" className="form-input" id="attTimeOut" value={form.time_out} onChange={setF('time_out')} />
                        </div>
                        <div className="form-group full-width">
                            <label htmlFor="attRemarks">Remarks</label>
                            <input type="text" className="form-input" id="attRemarks" maxLength={500} value={form.remarks} onChange={setF('remarks')} placeholder="Shown in the attendance table (optional)" />
                        </div>
                        <div className="form-group full-width">
                            <label htmlFor="attReason">Reason for the Change {req}</label>
                            <textarea className="form-input" id="attReason" maxLength={300} style={{ minHeight: 70, resize: 'vertical' }} value={form.reason} onChange={setF('reason')}
                                placeholder="e.g., Biometric failure; time in confirmed by the supervisor." />
                        </div>
                    </form>
                )}
            </Modal>
        </>
    );
}

/** Employee, schedule and attendance of one day (View). */
export function AttendanceDetails({ r, showEmployee = true }: { r: AttendanceDay; showEmployee?: boolean }) {
    return (
        <>
            {showEmployee && (
                <div className="modal-section">
                    <h4 className="modal-section-title"><Icon as={Users} /> Employee</h4>
                    <div className="modal-info-grid">
                        <InfoItem label="Employee ID">{r.employee_no}</InfoItem>
                        <InfoItem label="Employee Name">{r.full_name}</InfoItem>
                        <InfoItem label="Department">{r.department}</InfoItem>
                        <InfoItem label="Position">{r.position}</InfoItem>
                    </div>
                </div>
            )}
            <div className="modal-section">
                <h4 className="modal-section-title"><Icon as={CalendarDays} /> Schedule · {fmtDay(r.date)}</h4>
                <div className="modal-info-grid">
                    <InfoItem label="Assigned Shift">{r.shift_name ? `${r.shift_name}${r.shift_code ? ` (${r.shift_code})` : ''}` : (r.day_type === 'Rest Day' ? 'Rest Day' : 'No schedule assigned')}</InfoItem>
                    <InfoItem label="Scheduled Time">{shiftTimes(r.start_time, r.end_time, r.overnight)}</InfoItem>
                    <InfoItem label="Break">{r.break_start ? shiftTimes(r.break_start, r.break_end) : '—'}</InfoItem>
                    <InfoItem label="Grace Period">{r.grace_minutes !== null ? `${r.grace_minutes} min` : '—'}</InfoItem>
                    <InfoItem label="Scheduled Working Hours">{fmtMinutes(r.scheduled_minutes)}</InfoItem>
                    {r.holiday && <InfoItem label="Holiday">{r.holiday.name} ({r.holiday.holiday_type})</InfoItem>}
                    {r.leave && <InfoItem label="Approved Leave">{r.leave.leave_type} ({r.leave.request_no})</InfoItem>}
                </div>
            </div>
            <div className="modal-section">
                <h4 className="modal-section-title"><Icon as={Clock} /> Attendance</h4>
                <div className="modal-info-grid">
                    <InfoItem label="Attendance Status"><StatusBadge status={r.status} /></InfoItem>
                    <InfoItem label="Actual Time In">{r.time_in ? phpMjYgiA(r.time_in) : '—'}</InfoItem>
                    <InfoItem label="Actual Time Out">{r.time_out ? phpMjYgiA(r.time_out) : '—'}</InfoItem>
                    <InfoItem label="Total Working Hours">{fmtMinutes(r.worked_minutes, '0m')}</InfoItem>
                    <InfoItem label="Late">{fmtMinutes(r.late_minutes, 'None')}</InfoItem>
                    <InfoItem label="Undertime">{fmtMinutes(r.undertime_minutes, 'None')}</InfoItem>
                    <InfoItem label="Overtime">{fmtMinutes(r.overtime_minutes, 'None')}</InfoItem>
                    <InfoItem label="Recorded By">{r.source === 'HR' ? `HR${r.record_updated_by ? ` (${r.record_updated_by})` : ''}` : r.source === 'Employee' ? 'Employee time clock' : '—'}</InfoItem>
                    <InfoItem label="Remarks" full>{[r.remarks ?? '', ...r.notes].filter(Boolean).join(' · ') || '—'}</InfoItem>
                </div>
            </div>
        </>
    );
}

/** Monthly Attendance Report (reports permission) with the existing .xlsx export. */
function MonthlyReport({ departments, employees }: { departments: string[]; employees: AttendanceDay[] }) {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [dept, setDept] = useState('');
    const [employee, setEmployee] = useState('');
    const { data, loading, error, retry } = usePageData(() => attendanceService.monthlyReport(year, month, dept, employee), [year, month, dept, employee]);
    const rows: MonthlyReportRow[] = data?.rows ?? [];
    const total = (k: keyof MonthlyReportRow) => rows.reduce((s, r) => s + Number(r[k]), 0);
    const rv = useTableView(rows, () => true, {
        name: r => r.full_name, department: r => r.department, working_days: r => r.working_days, present: r => r.present, late: r => r.late,
        half_day: r => r.half_day, absent: r => r.absent, on_leave: r => r.on_leave, rest_days: r => r.rest_days, incomplete: r => r.incomplete,
        worked: r => r.worked_minutes, overtime: r => r.overtime_minutes, undertime: r => r.undertime_minutes,
    });
    const exportUrl = backendUrl(`export-attendance.php?${new URLSearchParams({ year: String(year), month: String(month), department: dept, employee_id: employee })}`);

    return (
        <>
            <div className="att-filters" id="attReportBar">
                <div className="att-field"><label>Month / Year</label><div style={{ display: 'flex', gap: '0.5rem' }}>
                    <MonthPicker year={year} month={month} idPrefix="rpt" onChange={(y, m) => { setYear(y); setMonth(m); }} />
                </div></div>
                <div className="att-field">
                    <label htmlFor="rptDept">Department</label>
                    <select className="form-select" id="rptDept" value={dept} onChange={e => { setDept(e.target.value); setEmployee(''); }}>
                        <option value="">All Departments</option>
                        {departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>
                <div className="att-field">
                    <label htmlFor="rptEmployee">Employee</label>
                    <select className="form-select" id="rptEmployee" value={employee} onChange={e => setEmployee(e.target.value)}>
                        <option value="">All Employees</option>
                        {employees.filter(r => !dept || r.department === dept).map(r => <option key={r.employee_id} value={r.employee_id}>{r.full_name} ({r.employee_no})</option>)}
                    </select>
                </div>
                <div className="att-actions">
                    <button className="btn btn-primary" id="rptExport" onClick={() => { window.location.href = exportUrl; }}><Icon as={FileSpreadsheet} /> Export</button>
                </div>
            </div>
            <PageState loading={loading} error={error} onRetry={retry} />
            {data && (
                <div className="card hover-card">
                    <div className="card-body no-padding">
                        <table className="data-table" id="attendanceReportTable">
                            <thead>
                                <tr>
                                    <SortTh view={rv} k="name">Employee</SortTh><SortTh view={rv} k="department">Department</SortTh><SortTh view={rv} k="working_days" className="att-num">Total Working Days</SortTh><SortTh view={rv} k="present" className="att-num">Present</SortTh>
                                    <SortTh view={rv} k="late" className="att-num">Late</SortTh><SortTh view={rv} k="half_day" className="att-num">Half Day</SortTh><SortTh view={rv} k="absent" className="att-num">Absent</SortTh><SortTh view={rv} k="on_leave" className="att-num">On Leave</SortTh>
                                    <SortTh view={rv} k="rest_days" className="att-num">Rest Days</SortTh><SortTh view={rv} k="incomplete" className="att-num">Incomplete</SortTh><SortTh view={rv} k="worked" className="att-num">Total Hours</SortTh>
                                    <SortTh view={rv} k="overtime" className="att-num">Total Overtime</SortTh><SortTh view={rv} k="undertime" className="att-num">Total Undertime</SortTh>
                                </tr>
                            </thead>
                            <tbody>
                                {!rows.length ? <EmptyRow colSpan={13}>No records found. Try other filters or clear them.</EmptyRow> : rv.rows.map(r => (
                                    <tr className="hover-row" key={r.employee_id} data-employee={r.employee_id}>
                                        <td style={{ minWidth: 180 }}><strong>{r.full_name}</strong><div className="att-muted">{r.employee_no} · {r.position}</div></td>
                                        <td>{r.department}</td>
                                        <td className="att-num">{r.working_days}</td>
                                        <td className="att-num">{r.present}</td>
                                        <td className="att-num">{r.late}</td>
                                        <td className="att-num">{r.half_day}</td>
                                        <td className="att-num">{r.absent}</td>
                                        <td className="att-num">{r.on_leave}</td>
                                        <td className="att-num">{r.rest_days}</td>
                                        <td className="att-num">{r.incomplete}</td>
                                        <td className="att-num">{fmtHours(r.worked_minutes)}</td>
                                        <td className="att-num">{fmtHours(r.overtime_minutes)}</td>
                                        <td className="att-num">{fmtHours(r.undertime_minutes)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            {rows.length > 1 && (
                                <tfoot>
                                    <tr style={{ fontWeight: 700 }}>
                                        <td colSpan={2}>Total ({rows.length} employees)</td>
                                        {(['working_days', 'present', 'late', 'half_day', 'absent', 'on_leave', 'rest_days', 'incomplete'] as const).map(k => <td className="att-num" key={k}>{total(k)}</td>)}
                                        <td className="att-num">{fmtHours(total('worked_minutes'))}</td>
                                        <td className="att-num">{fmtHours(total('overtime_minutes'))}</td>
                                        <td className="att-num">{fmtHours(total('undertime_minutes'))}</td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            )}
            <p className="att-note" style={{ marginTop: '0.75rem' }}>Hours are in decimal hours. Working days are scheduled work days that are not holidays; days not yet reached count only once they pass.</p>
        </>
    );
}
