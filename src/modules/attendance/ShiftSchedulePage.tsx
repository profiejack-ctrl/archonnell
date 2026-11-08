import { useEffect, useState } from 'react';
import { CalendarDays, CalendarPlus, Clock, Eye, List, Pencil, Plus, Save, Sun, Trash2, UserCog } from 'lucide-react';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import { Badge, EmptyRow, InfoItem, PageState, SearchBox } from '../../components/ui';
import { usePageData } from '../../hooks/usePageData';
import {
    attendanceService, type EmployeeSchedule, type ScheduleDay, type ScheduleForm, type ScheduleStatus, type Shift, type ShiftForm, type ShiftSchedulePage as PageData,
} from '../../services/attendanceService';
import { ArchonAlert, confirmDialog } from '../../utils/alerts';
import { isoDateFromToday, phpMjY, phpMjYgiA } from '../../utils/format';
import { ClearFilters, FilterSelect, SortTh, distinct, is, matchesText, useFilters, useTableView } from '../../components/TableControls';
import {
    MONTHS, MonthPicker, SCHEDULE_BADGE, ScheduleCalendar, Tabs, WEEKDAY_SHORT, addDays, daysLabel, fmtDay, fmtMinutes, fmt12, monthRange, parseIso,
    shiftTimes,
} from './shared';

type TabKey = 'monthly' | 'list' | 'assignments' | 'shifts' | 'holidays';
const req = <span style={{ color: 'var(--danger)' }}>*</span>;
const hint = { fontSize: '0.75rem', color: 'var(--text-muted)' } as const;
const readOnly = { background: 'var(--bg-secondary)' } as const;
const LIST_PER_PAGE = 62;

/** Minutes of work in a shift form (same rule as the server), or null when incomplete / invalid. */
function shiftWorkMinutes(f: ShiftForm): number | null {
    const m = (t: string) => (/^\d{2}:\d{2}$/.test(t) ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : NaN);
    const s = m(f.start_time); const e = m(f.end_time);
    if (Number.isNaN(s) || Number.isNaN(e) || s === e) return null;
    const rel = (t: number) => (t - s + 1440) % 1440;
    let brk = 0;
    if (f.break_start || f.break_end) {
        const bs = rel(m(f.break_start)); const be = rel(m(f.break_end));
        if (Number.isNaN(bs) || Number.isNaN(be) || !(bs > 0 && be > bs && be < rel(e))) return null;
        brk = be - bs;
    }
    return rel(e) - brk;
}

function scheduleIsCurrent(s: EmployeeSchedule, today: string): boolean {
    return s.status === 'Active' && s.effective_date <= today && (!s.end_date || s.end_date >= today);
}

/**
 * Shift & Schedule: the shifts HR configures, which shift each employee works
 * (effective dates, working days and rest days), the monthly calendar, the
 * day-by-day schedule list and company holidays.
 */
export default function ShiftSchedulePage() {
    const [tab, setTab] = useState<TabKey>('monthly');
    const [holidayYear, setHolidayYear] = useState(new Date().getFullYear());
    const { data, loading, error, retry, reload } = usePageData(() => attendanceService.schedulePage(holidayYear), [holidayYear]);
    const [shiftForm, setShiftForm] = useState<ShiftForm | null>(null);
    const [schedForm, setSchedForm] = useState<ScheduleForm | null>(null);
    const [viewSched, setViewSched] = useState<EmployeeSchedule | null>(null);
    const [busy, setBusy] = useState(false);

    const today = data?.today ?? isoDateFromToday();

    const openSchedule = (s: EmployeeSchedule | null, employeeId = '') => {
        setViewSched(null);
        setSchedForm(s ? {
            id: s.id, employee_id: String(s.employee_id), shift_id: String(s.shift_id), effective_date: s.effective_date,
            end_date: s.end_date ?? '', working_days: [...s.working_days], status: s.status, remarks: s.remarks ?? '', close_previous: false,
        } : {
            employee_id: employeeId, shift_id: '', effective_date: today, end_date: '', working_days: [1, 2, 3, 4, 5],
            status: 'Active', remarks: '', close_previous: true,
        });
    };
    const openShift = (s: Shift | null) => setShiftForm(s ? {
        id: s.id, shift_code: s.shift_code, shift_name: s.shift_name, shift_type: s.shift_type, start_time: s.start_time, end_time: s.end_time,
        break_start: s.break_start ?? '', break_end: s.break_end ?? '', grace_minutes: String(s.grace_minutes), status: s.status,
    } : { shift_code: '', shift_name: '', shift_type: 'Day Shift', start_time: '08:00', end_time: '17:00', break_start: '12:00', break_end: '13:00', grace_minutes: '5', status: 'Active' });

    const afterSave = async (message: string) => {
        await ArchonAlert.success(message, { timer: 2200 });
        await reload();
    };

    const saveShift = async () => {
        if (!shiftForm) return;
        const f = shiftForm;
        let invalid = '';
        if (!/^[A-Za-z0-9-]{1,10}$/.test(f.shift_code.trim())) invalid = 'Shift Code must be 1-10 letters, digits or dashes.';
        else if (f.shift_name.trim().length < 2) invalid = 'Please enter the shift name.';
        else if (!f.start_time || !f.end_time) invalid = 'Please enter the start and end time.';
        else if (f.start_time === f.end_time) invalid = 'The start and end time cannot be the same.';
        else if (!!f.break_start !== !!f.break_end) invalid = 'Please enter both the break start and the break end, or leave both empty.';
        else if (shiftWorkMinutes(f) === null) invalid = 'The break must start after the shift starts and end before the shift ends.';
        else if ((shiftWorkMinutes(f) ?? 0) < 60 || (shiftWorkMinutes(f) ?? 0) > 960) invalid = 'A shift must have between 1 and 16 working hours (excluding the break).';
        else if (!/^\d{1,2}$/.test(f.grace_minutes) || Number(f.grace_minutes) > 60) invalid = 'The grace period must be 0 to 60 minutes.';
        if (invalid) { await ArchonAlert.warning(invalid, { title: 'Check the Shift' }); return; }
        const existing = data?.shifts.find(s => s.id === f.id);
        if (existing && existing.active_assignments > 0 && (existing.start_time !== f.start_time || existing.end_time !== f.end_time
            || (existing.break_start ?? '') !== f.break_start || (existing.break_end ?? '') !== f.break_end || String(existing.grace_minutes) !== f.grace_minutes)) {
            const ok = await confirmDialog({
                title: 'Change Shift Times',
                paragraphs: [`${existing.active_assignments} current schedule(s) use the ${existing.shift_name}. The new times apply to their coming days; attendance already recorded keeps the times it was recorded with.`],
                icon: 'warning', confirmText: 'Save Changes',
            });
            if (!ok) return;
        }
        setBusy(true);
        try {
            const res = await attendanceService.saveShift(f);
            setShiftForm(null);
            await afterSave(res.message);
        } catch (err) {
            await ArchonAlert.error(err instanceof Error ? err.message : 'The shift could not be saved.');
        } finally {
            setBusy(false);
        }
    };

    const saveSchedule = async () => {
        if (!schedForm || !data) return;
        const f = schedForm;
        let invalid = '';
        if (!f.employee_id) invalid = 'Please select the employee.';
        else if (!f.shift_id) invalid = 'Please select the shift.';
        else if (!f.effective_date) invalid = 'Please select the effective date.';
        else if (f.end_date && f.end_date < f.effective_date) invalid = 'The end date cannot be earlier than the effective date.';
        else if (!f.working_days.length) invalid = 'Please choose at least one working day.';
        else if (/[<>]/.test(f.remarks)) invalid = 'Please do not use < or > characters.';
        if (invalid) { await ArchonAlert.warning(invalid, { title: 'Check the Schedule' }); return; }
        const emp = data.employees.find(e => String(e.id) === f.employee_id);
        const sh = data.shifts.find(s => String(s.id) === f.shift_id);
        const ok = await confirmDialog({
            title: f.id ? 'Update Schedule' : 'Assign Schedule',
            paragraphs: [`${f.id ? 'Update the schedule of' : 'Assign this schedule to'} ${emp?.full_name ?? 'the employee'}? They will be notified.`],
            details: [
                { label: 'Shift', value: sh ? `${sh.shift_name} (${shiftTimes(sh.start_time, sh.end_time, sh.overnight)})` : '' },
                { label: 'Working Days', value: daysLabel(f.working_days) },
                { label: 'Rest Days', value: daysLabel([1, 2, 3, 4, 5, 6, 7].filter(d => !f.working_days.includes(d))) },
                { label: 'Effective', value: `${phpMjY(f.effective_date)} - ${f.end_date ? phpMjY(f.end_date) : 'open-ended'}` },
            ],
            icon: 'question', confirmText: f.id ? 'Update' : 'Assign',
        });
        if (!ok) return;
        setBusy(true);
        try {
            const res = await attendanceService.saveSchedule(f);
            setSchedForm(null);
            await afterSave(res.message);
        } catch (err) {
            await ArchonAlert.error(err instanceof Error ? err.message : 'The schedule could not be saved.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <Tabs id="schTabs" active={tab} onChange={setTab} tabs={[
                { key: 'monthly', label: <><Icon as={CalendarDays} /> Monthly Schedule</> },
                { key: 'list', label: <><Icon as={List} /> Schedule List</> },
                { key: 'assignments', label: <><Icon as={UserCog} /> Employee Scheduling</> },
                { key: 'shifts', label: <><Icon as={Clock} /> Shifts</> },
                { key: 'holidays', label: <><Icon as={Sun} /> Holidays</> },
            ]} />
            <PageState loading={loading} error={error} onRetry={retry} />
            {data && tab === 'monthly' && <MonthlyView data={data} today={today} />}
            {data && tab === 'list' && <ScheduleListView data={data} today={today} onView={setViewSched} onEdit={s => openSchedule(s)} />}
            {data && tab === 'assignments' && <AssignmentsView data={data} today={today} onView={setViewSched} onEdit={s => openSchedule(s)} onNew={() => openSchedule(null)} />}
            {data && tab === 'shifts' && <ShiftsView shifts={data.shifts} onEdit={openShift} />}
            {data && tab === 'holidays' && <HolidaysView data={data} year={holidayYear} setYear={setHolidayYear} reload={reload} />}

            {/* Assignment details */}
            <Modal open={!!viewSched} onClose={() => setViewSched(null)} size="lg" title={<><Icon as={UserCog} /> Employee Schedule</>}
                footer={viewSched && <>
                    <button className="btn btn-outline" onClick={() => setViewSched(null)}>Close</button>
                    <button className="btn btn-primary" id="schViewEdit" onClick={() => openSchedule(viewSched)}><Icon as={Pencil} /> Edit Schedule</button>
                </>}>
                {viewSched && (
                    <>
                        <div className="modal-section">
                            <h4 className="modal-section-title"><Icon as={UserCog} /> Employee</h4>
                            <div className="modal-info-grid">
                                <InfoItem label="Employee ID">{viewSched.employee_no}</InfoItem>
                                <InfoItem label="Employee Name">{viewSched.full_name}</InfoItem>
                                <InfoItem label="Department">{viewSched.department}</InfoItem>
                                <InfoItem label="Position">{viewSched.position}</InfoItem>
                            </div>
                        </div>
                        <div className="modal-section">
                            <h4 className="modal-section-title"><Icon as={Clock} /> Schedule</h4>
                            <div className="modal-info-grid">
                                <InfoItem label="Shift">{viewSched.shift_name} ({viewSched.shift_code})</InfoItem>
                                <InfoItem label="Time">{shiftTimes(viewSched.start_time, viewSched.end_time, viewSched.overnight)}</InfoItem>
                                <InfoItem label="Break">{viewSched.break_start ? shiftTimes(viewSched.break_start, viewSched.break_end) : 'None'}</InfoItem>
                                <InfoItem label="Working Hours / Grace">{fmtMinutes(viewSched.work_minutes)} · {viewSched.grace_minutes} min grace</InfoItem>
                                <InfoItem label="Working Days">{daysLabel(viewSched.working_days)}</InfoItem>
                                <InfoItem label="Rest Days">{daysLabel(viewSched.rest_days)}</InfoItem>
                                <InfoItem label="Effective Date">{phpMjY(viewSched.effective_date)}</InfoItem>
                                <InfoItem label="End Date">{viewSched.end_date ? phpMjY(viewSched.end_date) : 'Open-ended'}</InfoItem>
                                <InfoItem label="Schedule Status"><Badge variant={viewSched.status === 'Active' ? 'badge-success' : 'badge-secondary'}>{viewSched.status}</Badge></InfoItem>
                                <InfoItem label="Last Updated">{phpMjYgiA(viewSched.updated_at)}{viewSched.updated_by_name ? ` by ${viewSched.updated_by_name}` : ''}</InfoItem>
                                {viewSched.remarks && <InfoItem label="Remarks" full>{viewSched.remarks}</InfoItem>}
                            </div>
                        </div>
                    </>
                )}
            </Modal>

            {/* Assign / edit schedule */}
            <Modal open={!!schedForm} onClose={() => setSchedForm(null)} size="lg" title={<><Icon as={CalendarPlus} /> {schedForm?.id ? 'Edit Employee Schedule' : 'Assign Schedule'}</>}
                footer={<>
                    <button className="btn btn-outline" onClick={() => setSchedForm(null)}>Cancel</button>
                    <button type="button" className="btn btn-primary" id="schSaveBtn" disabled={busy} onClick={() => void saveSchedule()}><Icon as={Save} /> {schedForm?.id ? 'Update Schedule' : 'Assign Schedule'}</button>
                </>}>
                {schedForm && data && <ScheduleFormBody f={schedForm} setF={setSchedForm} data={data} today={today} />}
            </Modal>

            {/* Create / edit shift */}
            <Modal open={!!shiftForm} onClose={() => setShiftForm(null)} size="lg" title={<><Icon as={Clock} /> {shiftForm?.id ? 'Edit Shift' : 'New Shift'}</>}
                footer={<>
                    <button className="btn btn-outline" onClick={() => setShiftForm(null)}>Cancel</button>
                    <button type="button" className="btn btn-primary" id="shiftSaveBtn" disabled={busy} onClick={() => void saveShift()}><Icon as={Save} /> Save Shift</button>
                </>}>
                {shiftForm && data && <ShiftFormBody f={shiftForm} setF={setShiftForm} types={data.shift_types} />}
            </Modal>
        </>
    );
}

/* ---------------------------------------------------------------- Monthly */

function MonthlyView({ data, today }: { data: PageData; today: string }) {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [dept, setDept] = useState('');
    const [position, setPosition] = useState('');
    const [shift, setShift] = useState('');
    const [from, to] = monthRange(year, month);
    const deptId = data.departments.find(d => d.name === dept)?.id;
    const employees = data.employees.filter(e => (!dept || e.department === dept) && (!position || e.position === position)
        && (!shift || data.schedules.some(s => s.employee_id === e.id && String(s.shift_id) === shift && s.status === 'Active'
            && s.effective_date <= to && (!s.end_date || s.end_date >= from))));
    const [employee, setEmployee] = useState<string>(() => (employees[0] ? String(employees[0].id) : 'all'));
    useEffect(() => {
        if (employee !== 'all' && !employees.some(e => String(e.id) === employee)) setEmployee(employees[0] ? String(employees[0].id) : 'all');
    }, [dept, position, shift, year, month]); // eslint-disable-line react-hooks/exhaustive-deps

    const empId = employee === 'all' ? '' : employee;
    const { data: days, loading, error, retry } = usePageData(() => attendanceService.scheduleDays(from, to, empId), [from, to, empId]);
    const emp = data.employees.find(e => String(e.id) === employee);
    const inScope = new Set(employees.map(e => e.id));
    const list = (days?.days ?? []).filter(d => inScope.has(d.employee_id));

    return (
        <>
            <div className="att-filters" id="schMonthlyBar">
                <div className="att-field"><label>Month / Year</label><div style={{ display: 'flex', gap: '0.5rem' }}>
                    <MonthPicker year={year} month={month} idPrefix="schCal" onChange={(y, m) => { setYear(y); setMonth(m); }} />
                </div></div>
                <div className="att-field">
                    <label htmlFor="schCalDept">Department</label>
                    <select className="form-select" id="schCalDept" value={dept} onChange={e => { setDept(e.target.value); setPosition(''); }}>
                        <option value="">All Departments</option>
                        {data.departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                    </select>
                </div>
                <div className="att-field">
                    <label htmlFor="schCalPosition">Position</label>
                    <select className="form-select" id="schCalPosition" value={position} onChange={e => setPosition(e.target.value)}>
                        <option value="">All Positions</option>
                        {data.positions.filter(p => !dept || p.department_id === deptId).map(p => <option key={p.id} value={p.title}>{p.title}</option>)}
                    </select>
                </div>
                <div className="att-field">
                    <label htmlFor="schCalShift">Shift</label>
                    <select className="form-select" id="schCalShift" value={shift} onChange={e => setShift(e.target.value)}>
                        <option value="">All Shifts</option>
                        {data.shifts.map(s => <option key={s.id} value={s.id}>{s.shift_name}</option>)}
                    </select>
                </div>
                <div className="att-field">
                    <label htmlFor="schCalEmployee">Employee</label>
                    <select className="form-select" id="schCalEmployee" value={employee} onChange={e => setEmployee(e.target.value)}>
                        <option value="all">All employees (roster)</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_no})</option>)}
                    </select>
                </div>
            </div>
            <PageState loading={loading} error={error} onRetry={retry} />
            {days && emp && (
                <div className="card hover-card">
                    <div className="card-body">
                        <div className="modal-info-grid" style={{ marginBottom: '1rem' }} id="schCalHeader">
                            <InfoItem label="Employee">{emp.full_name} ({emp.employee_no})</InfoItem>
                            <InfoItem label="Department">{emp.department}</InfoItem>
                            <InfoItem label="Position">{emp.position}</InfoItem>
                            <InfoItem label="Month">{MONTHS[month - 1]} {year}</InfoItem>
                        </div>
                        <ScheduleCalendar year={year} month={month} days={list} today={today} />
                        <div className="att-legend"><span className="lg-work">Work day</span><span className="lg-rest">Rest day</span><span className="lg-holiday">Holiday</span><span className="lg-leave">Approved leave</span></div>
                    </div>
                </div>
            )}
            {days && employee === 'all' && <Roster days={list} from={from} to={to} today={today} />}
        </>
    );
}

/** Employees x days of the month: the shift code, RD (rest day), H (holiday) or L (leave). */
function Roster({ days, from, to, today }: { days: ScheduleDay[]; from: string; to: string; today: string }) {
    const dates: string[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) dates.push(d);
    const byEmp = new Map<number, { name: string; no: string; days: Map<string, ScheduleDay> }>();
    days.forEach(d => {
        if (!byEmp.has(d.employee_id)) byEmp.set(d.employee_id, { name: d.full_name, no: d.employee_no, days: new Map() });
        byEmp.get(d.employee_id)!.days.set(d.date, d);
    });
    const cell = (d: ScheduleDay | undefined) => {
        if (!d) return { t: '', title: 'Not yet hired', c: '' };
        if (d.holiday) return { t: 'H', title: d.holiday.name, c: 'att-badge-holiday' };
        if (d.leave && d.day_type === 'Working') return { t: 'L', title: d.leave.leave_type, c: 'att-badge-leave' };
        if (d.day_type === 'Working') return { t: d.shift_code ?? '', title: `${d.shift_name} ${shiftTimes(d.start_time, d.end_time)}`, c: 'badge-info' };
        if (d.day_type === 'Rest Day') return { t: 'RD', title: 'Rest day', c: 'badge-secondary' };
        return { t: '—', title: 'No schedule', c: '' };
    };
    return (
        <div className="card hover-card">
            <div className="card-body no-padding">
                <table className="data-table" id="scheduleRoster" style={{ fontSize: '0.75rem' }}>
                    <thead>
                        <tr>
                            <th style={{ position: 'sticky', left: 0, background: 'var(--bg-secondary)', zIndex: 1 }}>Employee</th>
                            {dates.map(d => <th key={d} style={{ textAlign: 'center', padding: '0.5rem 0.25rem', ...(d === today ? { color: 'var(--accent)' } : {}) }}>
                                {parseIso(d).getDate()}<div className="att-muted">{WEEKDAY_SHORT[(parseIso(d).getDay() + 6) % 7].slice(0, 2)}</div>
                            </th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {!byEmp.size ? <EmptyRow colSpan={dates.length + 1}>No employees match the filters.</EmptyRow> : [...byEmp.entries()].map(([id, e]) => (
                            <tr key={id}>
                                <td style={{ position: 'sticky', left: 0, background: 'var(--bg-primary)', whiteSpace: 'nowrap' }}><strong>{e.name}</strong><div className="att-muted">{e.no}</div></td>
                                {dates.map(d => { const c = cell(e.days.get(d)); return (
                                    <td key={d} title={c.title} style={{ textAlign: 'center', padding: '0.4rem 0.2rem' }}>{c.t && <span className={`badge ${c.c}`} style={{ padding: '0.1rem 0.35rem', fontSize: '0.65rem' }}>{c.t}</span>}</td>
                                ); })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------ Schedule list */

function ScheduleListView({ data, today, onView, onEdit }: { data: PageData; today: string; onView: (s: EmployeeSchedule) => void; onEdit: (s: EmployeeSchedule) => void }) {
    const [[year, month], setYm] = useState<[number, number]>(() => [parseIso(today).getFullYear(), parseIso(today).getMonth() + 1]);
    const [from, to] = monthRange(year, month);
    const [dept, setDept] = useState('');
    const [position, setPosition] = useState('');
    const [employee, setEmployee] = useState('');
    const [shift, setShift] = useState('');
    const [status, setStatus] = useState<'' | ScheduleStatus>('');
    const [page, setPage] = useState(1);
    const { data: days, loading, error, retry } = usePageData(() => attendanceService.scheduleDays(from, to, employee), [from, to, employee]);
    const deptId = data.departments.find(d => d.name === dept)?.id;
    const positions = data.positions.filter(p => !dept || p.department_id === deptId);
    const rows = (days?.days ?? []).filter(d => (!dept || d.department === dept) && (!position || d.position === position)
        && (!status || d.schedule_status === status) && (!shift || String(d.shift_id) === shift));
    // Sorted before paging, so a sort covers every page.
    const lv = useTableView(rows, () => true, {
        no: d => d.employee_no, name: d => d.full_name, department: d => d.department, position: d => d.position, date: d => d.date,
        shift: d => (d.day_type === 'Working' ? d.shift_name : ''), start: d => (d.day_type === 'Working' ? d.start_time : ''),
        end: d => (d.day_type === 'Working' ? d.end_time : ''), rest: d => d.day_type, status: d => d.schedule_status,
    });
    useEffect(() => { setPage(1); }, [from, to, dept, position, employee, shift, status, lv.sort]);
    const pages = Math.max(1, Math.ceil(rows.length / LIST_PER_PAGE));
    const shown = lv.rows.slice((page - 1) * LIST_PER_PAGE, page * LIST_PER_PAGE);
    const byId = new Map(data.schedules.map(s => [s.id, s]));
    return (
        <>
            <div className="att-filters" id="schListBar">
                <div className="att-field"><label>Month / Year</label><div style={{ display: 'flex', gap: '0.5rem' }}>
                    <MonthPicker year={year} month={month} idPrefix="schList" onChange={(y, m) => setYm([y, m])} />
                </div></div>
                <div className="att-field">
                    <label htmlFor="schListDept">Department</label>
                    <select className="form-select" id="schListDept" value={dept} onChange={e => { setDept(e.target.value); setPosition(''); }}>
                        <option value="">All Departments</option>
                        {data.departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                    </select>
                </div>
                <div className="att-field">
                    <label htmlFor="schListPosition">Position</label>
                    <select className="form-select" id="schListPosition" value={position} onChange={e => setPosition(e.target.value)}>
                        <option value="">All Positions</option>
                        {positions.map(p => <option key={p.id} value={p.title}>{p.title}</option>)}
                    </select>
                </div>
                <div className="att-field">
                    <label htmlFor="schListEmployee">Employee</label>
                    <select className="form-select" id="schListEmployee" value={employee} onChange={e => setEmployee(e.target.value)}>
                        <option value="">All Employees</option>
                        {data.employees.filter(e => (!dept || e.department === dept) && (!position || e.position === position))
                            .map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_no})</option>)}
                    </select>
                </div>
                <div className="att-field">
                    <label htmlFor="schListShift">Shift</label>
                    <select className="form-select" id="schListShift" value={shift} onChange={e => setShift(e.target.value)}>
                        <option value="">All Shifts</option>
                        {data.shifts.map(s => <option key={s.id} value={s.id}>{s.shift_name}</option>)}
                    </select>
                </div>
                <div className="att-field">
                    <label htmlFor="schListStatus">Schedule Status</label>
                    <select className="form-select" id="schListStatus" value={status} onChange={e => setStatus(e.target.value as '' | ScheduleStatus)}>
                        <option value="">All</option>
                        {(['Scheduled', 'Rest Day', 'On Leave', 'Holiday', 'No Schedule'] as ScheduleStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div className="att-actions">
                    <ClearFilters id="schListClear" active={!!(dept || position || employee || shift || status)}
                        onClear={() => { setDept(''); setPosition(''); setEmployee(''); setShift(''); setStatus(''); }} />
                </div>
            </div>
            <PageState loading={loading} error={error} onRetry={retry} />
            {days && (
                <div className="card hover-card">
                    <div className="card-body no-padding">
                        <table className="data-table" id="scheduleListTable">
                            <thead>
                                <tr><SortTh view={lv} k="no">Employee ID</SortTh><SortTh view={lv} k="name">Employee Name</SortTh><SortTh view={lv} k="department">Department</SortTh><SortTh view={lv} k="position">Position</SortTh><SortTh view={lv} k="date">Date</SortTh><SortTh view={lv} k="shift">Shift</SortTh>
                                    <SortTh view={lv} k="start">Start Time</SortTh><SortTh view={lv} k="end">End Time</SortTh><th>Break</th><SortTh view={lv} k="rest">Rest Day</SortTh><SortTh view={lv} k="status">Schedule Status</SortTh><th>Actions</th></tr>
                            </thead>
                            <tbody>
                                {!shown.length ? <EmptyRow colSpan={12}>No records found. Try other filters or clear them.</EmptyRow> : shown.map(d => {
                                    const s = d.schedule_id ? byId.get(d.schedule_id) : undefined;
                                    return (
                                        <tr className="hover-row" key={`${d.employee_id}-${d.date}`} data-date={d.date} data-employee={d.employee_id}>
                                            <td className="att-nowrap">{d.employee_no}</td>
                                            <td><strong>{d.full_name}</strong></td>
                                            <td>{d.department}</td>
                                            <td>{d.position}</td>
                                            <td className="att-nowrap">{fmtDay(d.date)}</td>
                                            <td>{d.day_type === 'Working' ? d.shift_name : '—'}</td>
                                            <td className="att-nowrap">{d.day_type === 'Working' ? fmt12(d.start_time) : '—'}</td>
                                            <td className="att-nowrap">{d.day_type === 'Working' ? `${fmt12(d.end_time)}${d.overnight ? ' (+1)' : ''}` : '—'}</td>
                                            <td className="att-nowrap">{d.day_type === 'Working' && d.break_start ? shiftTimes(d.break_start, d.break_end) : '—'}</td>
                                            <td>{d.day_type === 'Rest Day' ? 'Yes' : d.day_type === 'Working' ? 'No' : '—'}</td>
                                            <td><Badge variant={SCHEDULE_BADGE[d.schedule_status]}>{d.schedule_status}</Badge>
                                                {d.holiday && <div className="att-muted">{d.holiday.name}</div>}
                                                {d.leave && d.day_type === 'Working' && <div className="att-muted">{d.leave.leave_type}</div>}</td>
                                            <td className="att-nowrap">
                                                {s ? <>
                                                    <button className="table-action-btn" title="View Schedule" onClick={() => onView(s)}><Icon as={Eye} /></button>
                                                    <button className="table-action-btn" title="Edit Schedule" onClick={() => onEdit(s)}><Icon as={Pencil} /></button>
                                                </> : <span className="att-muted">—</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {rows.length > LIST_PER_PAGE && (
                            <div className="att-pager">
                                <span>Showing {(page - 1) * LIST_PER_PAGE + 1}-{Math.min(page * LIST_PER_PAGE, rows.length)} of {rows.length}</span>
                                <div className="att-pager-btns">
                                    <button className="btn btn-sm btn-outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                                    <button className="btn btn-sm btn-outline" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

/* ------------------------------------------------------------- Assignments */

function AssignmentsView({ data, today, onView, onEdit, onNew }: {
    data: PageData; today: string; onView: (s: EmployeeSchedule) => void; onEdit: (s: EmployeeSchedule) => void; onNew: () => void;
}) {
    const af = useFilters({ search: '', department: '', position: '', shift: '', status: '' });
    const [which, setWhich] = useState<'current' | 'all'>('current');
    const statusOf = (s: EmployeeSchedule) => (s.status !== 'Active' ? 'Inactive' : scheduleIsCurrent(s, today) ? 'Active' : s.effective_date > today ? 'Upcoming' : 'Ended');
    const av = useTableView(data.schedules, s => is(af.values.department, s.department) && is(af.values.position, s.position)
        && is(af.values.shift, s.shift_name) && is(af.values.status, statusOf(s))
        && (which === 'all' || (s.status === 'Active' && (!s.end_date || s.end_date >= today)))
        && matchesText(af.values.search, s.employee_no, s.full_name, s.department, s.position, s.shift_name), {
        no: s => s.employee_no, name: s => s.full_name, department: s => s.department, position: s => s.position, shift: s => s.shift_name,
        effective: s => s.effective_date, end: s => s.end_date, status: s => statusOf(s),
    });
    const rows = av.rows;
    const unscheduled = data.employees.filter(e => !data.schedules.some(s => s.employee_id === e.id && scheduleIsCurrent(s, today)));
    return (
        <>
            <div className="page-toolbar">
                <div className="toolbar-left">
                    <button className="btn btn-primary" id="schBtnAssign" onClick={onNew}><Icon as={CalendarPlus} /> Assign Schedule</button>
                    <SearchBox value={af.values.search} onChange={af.set('search')} placeholder="Search employee or shift..." id="schAssignSearch" />
                    <select className="form-select" id="schAssignDept" aria-label="Department" value={af.values.department} onChange={e => af.set('department')(e.target.value)}>
                        <option value="">All Departments</option>
                        {data.departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                    </select>
                    <select className="form-select" id="schAssignWhich" value={which} onChange={e => setWhich(e.target.value as 'current' | 'all')}>
                        <option value="current">Current and upcoming</option>
                        <option value="all">All (including ended / inactive)</option>
                    </select>
                    <FilterSelect id="schAssignPosition" label="Positions" value={af.values.position} onChange={af.set('position')} options={distinct(data.schedules, s => s.position)} />
                    <FilterSelect id="schAssignShift" label="Shifts" value={af.values.shift} onChange={af.set('shift')} options={distinct(data.schedules, s => s.shift_name)} />
                    <FilterSelect id="schAssignStatus" label="Statuses" value={af.values.status} onChange={af.set('status')} options={['Active', 'Upcoming', 'Ended', 'Inactive']} />
                    <ClearFilters id="schAssignClear" active={af.active} onClear={af.clear} />
                </div>
            </div>
            {unscheduled.length > 0 && (
                <p className="att-note" id="schUnscheduled">
                    <strong>{unscheduled.length}</strong> active employee(s) have no schedule today: {unscheduled.slice(0, 5).map(e => e.full_name).join(', ')}{unscheduled.length > 5 ? ', ...' : ''}.
                    Their attendance shows as "No Schedule" until a shift is assigned.
                </p>
            )}
            <div className="card hover-card">
                <div className="card-body no-padding">
                    <table className="data-table" id="scheduleAssignmentsTable">
                        <thead>
                            <tr><SortTh view={av} k="no">Employee ID</SortTh><SortTh view={av} k="name">Employee Name</SortTh><SortTh view={av} k="department">Department</SortTh><SortTh view={av} k="position">Position</SortTh><SortTh view={av} k="shift">Shift</SortTh><SortTh view={av} k="effective">Effective</SortTh>
                                <SortTh view={av} k="end">End Date</SortTh><th>Working Days</th><th>Rest Days</th><SortTh view={av} k="status">Status</SortTh><th>Actions</th></tr>
                        </thead>
                        <tbody>
                            {!rows.length ? <EmptyRow colSpan={11}>{data.schedules.length ? 'No records found. Try other filters or clear them.' : <>No schedules yet. Click <strong>Assign Schedule</strong> to give an employee a shift.</>}</EmptyRow>
                                : rows.map(s => (
                                    <tr className="hover-row" key={s.id} data-id={s.id}>
                                        <td className="att-nowrap">{s.employee_no}</td>
                                        <td><strong>{s.full_name}</strong></td>
                                        <td>{s.department}</td>
                                        <td>{s.position}</td>
                                        <td>{s.shift_name}<div className="att-muted att-nowrap">{shiftTimes(s.start_time, s.end_time)}</div></td>
                                        <td className="att-nowrap">{phpMjY(s.effective_date)}</td>
                                        <td className="att-nowrap">{s.end_date ? phpMjY(s.end_date) : <span className="att-muted">Open-ended</span>}</td>
                                        <td>{daysLabel(s.working_days)}</td>
                                        <td>{daysLabel(s.rest_days)}</td>
                                        <td><Badge variant={s.status !== 'Active' ? 'badge-secondary' : scheduleIsCurrent(s, today) ? 'badge-success' : s.effective_date > today ? 'badge-info' : 'badge-secondary'}>
                                            {s.status !== 'Active' ? 'Inactive' : scheduleIsCurrent(s, today) ? 'Active' : s.effective_date > today ? 'Upcoming' : 'Ended'}</Badge></td>
                                        <td className="att-nowrap">
                                            <button className="table-action-btn btn-sch-view" title="View" onClick={() => onView(s)}><Icon as={Eye} /></button>
                                            <button className="table-action-btn btn-sch-edit" title="Edit" onClick={() => onEdit(s)}><Icon as={Pencil} /></button>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}

function ScheduleFormBody({ f, setF, data, today }: { f: ScheduleForm; setF: (u: (f: ScheduleForm | null) => ScheduleForm | null) => void; data: PageData; today: string }) {
    const set = <K extends keyof ScheduleForm>(k: K, v: ScheduleForm[K]) => setF(x => (x ? { ...x, [k]: v } : x));
    const emp = data.employees.find(e => String(e.id) === f.employee_id);
    const shifts = data.shifts.filter(s => s.status === 'Active' || String(s.id) === f.shift_id);
    const sh = data.shifts.find(s => String(s.id) === f.shift_id);
    const toggle = (d: number) => set('working_days', f.working_days.includes(d) ? f.working_days.filter(x => x !== d) : [...f.working_days, d].sort());
    // A running schedule the new one would replace (offered to end the day before).
    const running = !f.id && f.employee_id ? data.schedules.find(s => String(s.employee_id) === f.employee_id && s.status === 'Active'
        && s.effective_date < f.effective_date && (!s.end_date || s.end_date >= f.effective_date)) : undefined;
    return (
        <form id="scheduleForm" className="modal-form-grid" onSubmit={e => e.preventDefault()}>
            <div className="form-group full-width">
                <label htmlFor="schEmployee">Employee {req}</label>
                {f.id ? <input type="text" className="form-input" readOnly style={readOnly} value={emp ? `${emp.full_name} (${emp.employee_no})` : ''} />
                    : (
                        <select className="form-input" id="schEmployee" value={f.employee_id} onChange={e => set('employee_id', e.target.value)}>
                            <option value="">Select employee&hellip;</option>
                            {data.employees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_no}) - {e.department}</option>)}
                        </select>
                    )}
            </div>
            <div className="form-group">
                <label>Department</label>
                <input type="text" className="form-input" id="schDepartment" readOnly style={readOnly} value={emp?.department ?? ''} placeholder="From the employee record" />
            </div>
            <div className="form-group">
                <label>Position</label>
                <input type="text" className="form-input" id="schPosition" readOnly style={readOnly} value={emp?.position ?? ''} placeholder="From the employee record" />
            </div>
            <div className="form-group full-width">
                <label htmlFor="schShift">Shift {req}</label>
                <select className="form-input" id="schShift" value={f.shift_id} onChange={e => set('shift_id', e.target.value)}>
                    <option value="">Select shift&hellip;</option>
                    {shifts.map(s => <option key={s.id} value={s.id}>{s.shift_name} ({s.shift_code}) · {shiftTimes(s.start_time, s.end_time, s.overnight)}{s.status !== 'Active' ? ' - inactive' : ''}</option>)}
                </select>
                {sh && <span style={hint}>Break {sh.break_start ? shiftTimes(sh.break_start, sh.break_end) : 'none'} · {fmtMinutes(sh.work_minutes)} of work · {sh.grace_minutes} min grace period</span>}
            </div>
            <div className="form-group">
                <label htmlFor="schEffective">Effective Date {req}</label>
                <input type="date" className="form-input" id="schEffective" value={f.effective_date} onChange={e => set('effective_date', e.target.value)} />
            </div>
            <div className="form-group">
                <label htmlFor="schEnd">End Date</label>
                <input type="date" className="form-input" id="schEnd" min={f.effective_date} value={f.end_date} onChange={e => set('end_date', e.target.value)} />
                <span style={hint}>Leave empty for an open-ended schedule.</span>
            </div>
            <div className="form-group full-width">
                <label>Working Days {req}</label>
                <div className="att-daypicker" id="schDays">
                    {WEEKDAY_SHORT.map((w, i) => (
                        <button type="button" key={w} data-day={i + 1} className={f.working_days.includes(i + 1) ? 'on' : ''} aria-pressed={f.working_days.includes(i + 1)} onClick={() => toggle(i + 1)}>{w}</button>
                    ))}
                    <button type="button" onClick={() => set('working_days', [1, 2, 3, 4, 5])}>Mon-Fri</button>
                    <button type="button" onClick={() => set('working_days', [1, 2, 3, 4, 5, 6])}>Mon-Sat</button>
                </div>
                <span style={hint}>Rest Days: <strong id="schRestDays">{daysLabel([1, 2, 3, 4, 5, 6, 7].filter(d => !f.working_days.includes(d)))}</strong></span>
            </div>
            <div className="form-group">
                <label htmlFor="schStatus">Schedule Status</label>
                <select className="form-input" id="schStatus" value={f.status} onChange={e => set('status', e.target.value)}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                </select>
            </div>
            <div className="form-group">
                <label htmlFor="schRemarks">Remarks</label>
                <input type="text" className="form-input" id="schRemarks" maxLength={500} value={f.remarks} onChange={e => set('remarks', e.target.value)} />
            </div>
            {running && (
                <div className="form-group full-width">
                    <label className="checkbox-label" style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontWeight: 400 }}>
                        <input type="checkbox" id="schClosePrevious" checked={f.close_previous} onChange={e => set('close_previous', e.target.checked)} style={{ marginTop: 3 }} />
                        <span>End the current {running.shift_name} schedule ({phpMjY(running.effective_date)} - {running.end_date ? phpMjY(running.end_date) : 'open-ended'}) on {phpMjY(addDays(f.effective_date, -1))}, so this schedule replaces it.</span>
                    </label>
                </div>
            )}
            {f.effective_date < today && <p className="full-width" style={{ ...hint, margin: 0 }}>The effective date is in the past: attendance already recorded in those dates is recalculated with this schedule.</p>}
        </form>
    );
}

/* ------------------------------------------------------------------ Shifts */

function ShiftsView({ shifts, onEdit }: { shifts: Shift[]; onEdit: (s: Shift | null) => void }) {
    const sf = useFilters({ search: '', type: '', status: '' });
    const sv = useTableView(shifts, s => matchesText(sf.values.search, s.shift_name, s.shift_code) && is(sf.values.type, s.shift_type) && is(sf.values.status, s.status), {
        name: s => s.shift_name, code: s => s.shift_code, type: s => s.shift_type, start: s => s.start_time, end: s => s.end_time,
        hours: s => s.work_minutes, grace: s => s.grace_minutes, assigned: s => s.active_assignments, status: s => s.status,
    });
    return (
        <>
            <div className="page-toolbar">
                <div className="toolbar-left">
                    <button className="btn btn-primary" id="shiftBtnNew" onClick={() => onEdit(null)}><Icon as={Plus} /> New Shift</button>
                    <SearchBox value={sf.values.search} onChange={sf.set('search')} placeholder="Search shift name or code..." id="shiftSearch" />
                    <FilterSelect id="shiftTypeFilter" label="Types" value={sf.values.type} onChange={sf.set('type')} options={distinct(shifts, s => s.shift_type)} />
                    <FilterSelect id="shiftStatusFilter" label="Statuses" value={sf.values.status} onChange={sf.set('status')} options={distinct(shifts, s => s.status)} />
                    <ClearFilters id="shiftClear" active={sf.active} onClear={sf.clear} />
                </div>
            </div>
            <div className="card hover-card">
                <div className="card-body no-padding">
                    <table className="data-table" id="shiftsTable">
                        <thead>
                            <tr><SortTh view={sv} k="name">Shift Name</SortTh><SortTh view={sv} k="code">Code</SortTh><SortTh view={sv} k="type">Type</SortTh><SortTh view={sv} k="start">Start Time</SortTh><SortTh view={sv} k="end">End Time</SortTh><th>Break</th><SortTh view={sv} k="hours">Working Hours</SortTh>
                                <SortTh view={sv} k="grace">Grace Period</SortTh><SortTh view={sv} k="assigned">Assigned</SortTh><SortTh view={sv} k="status">Status</SortTh><th>Actions</th></tr>
                        </thead>
                        <tbody>
                            {!shifts.length ? <EmptyRow colSpan={11}>No shifts yet. Click <strong>New Shift</strong>.</EmptyRow> : !sv.rows.length ? <EmptyRow colSpan={11}>No records found. Try other filters or clear them.</EmptyRow> : sv.rows.map(s => (
                                <tr className="hover-row" key={s.id} data-id={s.id}>
                                    <td><strong>{s.shift_name}</strong></td>
                                    <td>{s.shift_code}</td>
                                    <td>{s.shift_type}</td>
                                    <td className="att-nowrap">{fmt12(s.start_time)}</td>
                                    <td className="att-nowrap">{fmt12(s.end_time)}{s.overnight && <div className="att-muted">next day</div>}</td>
                                    <td className="att-nowrap">{s.break_start ? shiftTimes(s.break_start, s.break_end) : '—'}</td>
                                    <td>{fmtMinutes(s.work_minutes)}</td>
                                    <td>{s.grace_minutes} min</td>
                                    <td>{s.active_assignments}</td>
                                    <td><Badge variant={s.status === 'Active' ? 'badge-success' : 'badge-secondary'}>{s.status}</Badge></td>
                                    <td><button className="table-action-btn btn-shift-edit" title="Edit" onClick={() => onEdit(s)}><Icon as={Pencil} /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}

function ShiftFormBody({ f, setF, types }: { f: ShiftForm; setF: (u: (f: ShiftForm | null) => ShiftForm | null) => void; types: string[] }) {
    const set = (k: keyof ShiftForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF(x => (x ? { ...x, [k]: e.target.value } : x));
    const work = shiftWorkMinutes(f);
    const overnight = !!f.start_time && !!f.end_time && f.end_time < f.start_time;
    return (
        <form id="shiftForm" className="modal-form-grid" onSubmit={e => e.preventDefault()}>
            <div className="form-group">
                <label htmlFor="shiftName">Shift Name {req}</label>
                <input type="text" className="form-input" id="shiftName" maxLength={60} value={f.shift_name} onChange={set('shift_name')} placeholder="e.g., Regular Shift" />
            </div>
            <div className="form-group">
                <label htmlFor="shiftCode">Shift Code {req}</label>
                <input type="text" className="form-input" id="shiftCode" maxLength={10} value={f.shift_code} onChange={set('shift_code')} placeholder="e.g., REG" style={{ textTransform: 'uppercase' }} />
            </div>
            <div className="form-group">
                <label htmlFor="shiftStart">Start Time {req}</label>
                <input type="time" className="form-input" id="shiftStart" value={f.start_time} onChange={set('start_time')} />
            </div>
            <div className="form-group">
                <label htmlFor="shiftEnd">End Time {req}</label>
                <input type="time" className="form-input" id="shiftEnd" value={f.end_time} onChange={set('end_time')} />
                {overnight && <span style={hint}>Overnight shift: ends the next day.</span>}
            </div>
            <div className="form-group">
                <label htmlFor="shiftBreakStart">Break Start</label>
                <input type="time" className="form-input" id="shiftBreakStart" value={f.break_start} onChange={set('break_start')} />
            </div>
            <div className="form-group">
                <label htmlFor="shiftBreakEnd">Break End</label>
                <input type="time" className="form-input" id="shiftBreakEnd" value={f.break_end} onChange={set('break_end')} />
            </div>
            <div className="form-group">
                <label>Total Working Hours</label>
                <input type="text" className="form-input" id="shiftWorkHours" readOnly style={readOnly} value={work === null ? 'Check the times' : `${fmtMinutes(work)} (break excluded)`} />
            </div>
            <div className="form-group">
                <label htmlFor="shiftGrace">Grace Period (minutes) {req}</label>
                <input type="number" className="form-input" id="shiftGrace" min={0} max={60} step={1} value={f.grace_minutes} onChange={set('grace_minutes')} />
                <span style={hint}>Time in within the grace period is not late; after it, lateness counts from the start time.</span>
            </div>
            <div className="form-group">
                <label htmlFor="shiftType">Shift Type {req}</label>
                <select className="form-input" id="shiftType" value={f.shift_type} onChange={set('shift_type')}>
                    {types.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
            </div>
            <div className="form-group">
                <label htmlFor="shiftStatus">Status</label>
                <select className="form-input" id="shiftStatus" value={f.status} onChange={set('status')}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                </select>
            </div>
        </form>
    );
}

/* ---------------------------------------------------------------- Holidays */

function HolidaysView({ data, year, setYear, reload }: { data: PageData; year: number; setYear: (y: number) => void; reload: () => Promise<unknown> }) {
    const [form, setForm] = useState<{ holiday_date: string; name: string; holiday_type: string } | null>(null);
    const hf = useFilters({ search: '', type: '' });
    const hv = useTableView(data.holidays, h => matchesText(hf.values.search, h.name, h.created_by_name) && is(hf.values.type, h.holiday_type), {
        date: h => h.holiday_date, name: h => h.name, type: h => h.holiday_type, by: h => h.created_by_name,
    }, { key: 'date', dir: 'asc' });
    const [busy, setBusy] = useState(false);
    const thisYear = new Date().getFullYear();
    const add = async () => {
        if (!form) return;
        if (!form.holiday_date || form.name.trim().length < 3 || !form.holiday_type) {
            await ArchonAlert.warning('Please enter the date, the holiday name (at least 3 characters) and its type.', { title: 'Missing Information' });
            return;
        }
        setBusy(true);
        try {
            const res = await attendanceService.saveHoliday(form);
            setForm(null);
            await ArchonAlert.success(res.message, { timer: 1600 });
            await reload();
        } catch (err) {
            await ArchonAlert.error(err instanceof Error ? err.message : 'The holiday could not be added.');
        } finally {
            setBusy(false);
        }
    };
    const remove = async (id: number, name: string, date: string) => {
        const ok = await confirmDialog({ title: 'Remove Holiday', paragraphs: [`Remove ${name} (${fmtDay(date)})? That date becomes a normal work day again.`], icon: 'warning', confirmText: 'Remove', danger: true });
        if (!ok) return;
        try {
            const res = await attendanceService.deleteHoliday(id);
            await ArchonAlert.success(res.message, { timer: 1600 });
            await reload();
        } catch (err) {
            await ArchonAlert.error(err instanceof Error ? err.message : 'The holiday could not be removed.');
        }
    };
    return (
        <>
            <div className="page-toolbar">
                <div className="toolbar-left">
                    <button className="btn btn-primary" id="holBtnAdd" onClick={() => setForm({ holiday_date: '', name: '', holiday_type: data.holiday_types[0] })}><Icon as={Plus} /> Add Holiday</button>
                    <select className="form-select" id="holYear" value={year} onChange={e => setYear(Number(e.target.value))}>
                        {[thisYear - 1, thisYear, thisYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <SearchBox value={hf.values.search} onChange={hf.set('search')} placeholder="Search holiday..." id="holSearch" />
                    <FilterSelect id="holTypeFilter" label="Types" value={hf.values.type} onChange={hf.set('type')} options={distinct(data.holidays, h => h.holiday_type)} />
                    <ClearFilters id="holClear" active={hf.active} onClear={hf.clear} />
                </div>
            </div>
            <p className="att-note">Holidays are not work days: attendance shows "Holiday" instead of Absent, and they are not counted as leave days.</p>
            <div className="card hover-card">
                <div className="card-body no-padding">
                    <table className="data-table" id="holidaysTable">
                        <thead><tr><SortTh view={hv} k="date">Date</SortTh><SortTh view={hv} k="name">Holiday</SortTh><SortTh view={hv} k="type">Type</SortTh><SortTh view={hv} k="by">Added By</SortTh><th>Actions</th></tr></thead>
                        <tbody>
                            {!data.holidays.length ? <EmptyRow colSpan={5}>No holidays for {year} yet.</EmptyRow> : !hv.rows.length ? <EmptyRow colSpan={5}>No records found. Try other filters or clear them.</EmptyRow> : hv.rows.map(h => (
                                <tr className="hover-row" key={h.id}>
                                    <td className="att-nowrap">{fmtDay(h.holiday_date)}</td>
                                    <td><strong>{h.name}</strong></td>
                                    <td>{h.holiday_type}</td>
                                    <td>{h.created_by_name ?? '—'}</td>
                                    <td><button className="table-action-btn" title="Remove" style={{ color: 'var(--danger)' }} onClick={() => void remove(h.id, h.name, h.holiday_date)}><Icon as={Trash2} /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <Modal open={!!form} onClose={() => setForm(null)} title={<><Icon as={Sun} /> Add Holiday</>}
                footer={<>
                    <button className="btn btn-outline" onClick={() => setForm(null)}>Cancel</button>
                    <button className="btn btn-primary" id="holSaveBtn" disabled={busy} onClick={() => void add()}><Icon as={Save} /> Add Holiday</button>
                </>}>
                {form && (
                    <form className="modal-form-grid" onSubmit={e => e.preventDefault()}>
                        <div className="form-group">
                            <label htmlFor="holDate">Date {req}</label>
                            <input type="date" className="form-input" id="holDate" value={form.holiday_date} onChange={e => setForm({ ...form, holiday_date: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="holType">Type {req}</label>
                            <select className="form-input" id="holType" value={form.holiday_type} onChange={e => setForm({ ...form, holiday_type: e.target.value })}>
                                {data.holiday_types.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="form-group full-width">
                            <label htmlFor="holName">Holiday Name {req}</label>
                            <input type="text" className="form-input" id="holName" maxLength={150} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., All Saints' Day" />
                        </div>
                    </form>
                )}
            </Modal>
        </>
    );
}
