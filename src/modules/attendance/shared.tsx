import type { ReactNode } from 'react';
import { Badge } from '../../components/ui';
import type { AttendanceDay, AttendanceStatus, ScheduleDay, ScheduleStatus } from '../../services/attendanceService';
import '../../styles/time-attendance.css';

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const ATT_BADGE: Record<AttendanceStatus, string> = {
    Present: 'badge-success', Late: 'badge-warning', 'Half Day': 'badge-warning', Absent: 'badge-danger', Incomplete: 'badge-danger',
    'On Leave': 'att-badge-leave', Holiday: 'att-badge-holiday', 'Rest Day': 'badge-secondary', Scheduled: 'badge-info', 'No Schedule': 'badge-secondary',
};

export const SCHEDULE_BADGE: Record<ScheduleStatus, string> = {
    Scheduled: 'badge-info', 'Rest Day': 'badge-secondary', 'On Leave': 'att-badge-leave', Holiday: 'att-badge-holiday', 'No Schedule': 'badge-secondary',
};

export const ATTENDANCE_STATUSES: AttendanceStatus[] = ['Present', 'Late', 'Half Day', 'Absent', 'Incomplete', 'On Leave', 'Rest Day', 'Holiday', 'Scheduled', 'No Schedule'];

export function StatusBadge({ status }: { status: AttendanceStatus }) {
    return <Badge variant={ATT_BADGE[status] ?? 'badge-secondary'} style={{ whiteSpace: 'nowrap' }}>{status}</Badge>;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Local Y-m-d of a Date. */
export function ymd(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseIso(iso: string): Date {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
}

export function addDays(iso: string, n: number): string {
    const d = parseIso(iso);
    d.setDate(d.getDate() + n);
    return ymd(d);
}

/** Monday..Sunday of the week containing `iso`. */
export function weekRange(iso: string): [string, string] {
    const d = parseIso(iso);
    const back = (d.getDay() + 6) % 7;
    const from = addDays(iso, -back);
    return [from, addDays(from, 6)];
}

export function monthRange(year: number, month: number): [string, string] {
    return [`${year}-${pad(month)}-01`, ymd(new Date(year, month, 0))];
}

/** "Thu, Oct 1, 2026" */
export function fmtDay(iso: string | null | undefined): string {
    if (!iso) return '—';
    return parseIso(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

/** "HH:MM" -> "8:00 AM" */
export function fmt12(hhmm: string | null | undefined): string {
    if (!hhmm) return '—';
    const [h, m] = hhmm.split(':').map(Number);
    return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "8:00 AM - 5:00 PM" (+ "next day" for an overnight shift) */
export function shiftTimes(start: string | null, end: string | null, overnight = false): string {
    if (!start || !end) return '—';
    return `${fmt12(start)} - ${fmt12(end)}${overnight ? ' (next day)' : ''}`;
}

/** A recorded time ("Y-m-d H:i:s") as "8:15 AM", with the date when it is not the work date. */
export function fmtClock(ts: string | null | undefined, workDate?: string): string {
    if (!ts) return '—';
    const t = fmt12(ts.slice(11, 16));
    return workDate && ts.slice(0, 10) !== workDate ? `${t} (${parseIso(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})` : t;
}

/** Minutes as "7h 45m" / "15m"; zero shows as "—". */
export function fmtMinutes(m: number | null | undefined, zero = '—'): string {
    if (m === null || m === undefined) return '—';
    if (m <= 0) return zero;
    const h = Math.floor(m / 60);
    const r = m % 60;
    return h ? `${h}h${r ? ` ${pad(r)}m` : ''}` : `${r}m`;
}

/** Hours with two decimals for totals ("165.50"). */
export function fmtHours(m: number): string {
    return (m / 60).toFixed(2);
}

export function daysLabel(days: number[]): string {
    if (!days.length) return 'None';
    const sorted = [...days].sort((a, b) => a - b);
    const consecutive = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
    if (consecutive && sorted.length > 2) return `${WEEKDAY_SHORT[sorted[0] - 1]} - ${WEEKDAY_SHORT[sorted[sorted.length - 1] - 1]}`;
    return sorted.map(d => WEEKDAY_SHORT[d - 1]).join(', ');
}

/** Tab strip for a page's sections. */
export function Tabs<T extends string>({ tabs, active, onChange, id }: { tabs: { key: T; label: ReactNode }[]; active: T; onChange: (k: T) => void; id?: string }) {
    return (
        <div className="att-tabs" role="tablist" id={id}>
            {tabs.map(t => (
                <button key={t.key} type="button" role="tab" aria-selected={active === t.key} data-tab={t.key}
                    className={`att-tab${active === t.key ? ' active' : ''}`} onClick={() => onChange(t.key)}>
                    {t.label}
                </button>
            ))}
        </div>
    );
}

/** Top-level section switch of a module (button group, above the section's own tabs). */
export function SectionSwitch<T extends string>({ views, active, onChange, id }: { views: { key: T; label: ReactNode }[]; active: T; onChange: (k: T) => void; id?: string }) {
    if (views.length < 2) return null;
    return (
        <div className="att-sections" role="group" id={id}>
            {views.map(v => (
                <button key={v.key} type="button" data-view={v.key} aria-pressed={active === v.key}
                    className={`btn ${active === v.key ? 'btn-primary' : 'btn-outline'}`} onClick={() => onChange(v.key)}>
                    {v.label}
                </button>
            ))}
        </div>
    );
}

/** What the calendar shows for one date. */
function CalendarCell({ day, attendance }: { day: ScheduleDay | undefined; attendance?: AttendanceDay }) {
    if (!day) return <div className="att-cal-muted">—</div>;
    return (
        <>
            {day.holiday && <div className="att-cal-tag att-cal-tag--holiday" title={day.holiday.holiday_type}>{day.holiday.name}</div>}
            {day.leave && day.day_type === 'Working' && !day.holiday && <div className="att-cal-tag att-cal-tag--leave">{day.leave.leave_type}</div>}
            {day.day_type === 'Working' && (
                <>
                    <div className="att-cal-shift">{day.shift_name}</div>
                    <div className="att-cal-time">{shiftTimes(day.start_time, day.end_time)}</div>
                </>
            )}
            {day.day_type === 'Rest Day' && <div className="att-cal-rest">Rest Day</div>}
            {day.day_type === 'No Schedule' && <div className="att-cal-muted">No schedule</div>}
            {attendance && attendance.time_in && (
                <div className="att-cal-time">In {fmtClock(attendance.time_in)}{attendance.time_out ? ` · Out ${fmtClock(attendance.time_out)}` : ''}</div>
            )}
            {attendance && ['Present', 'Late', 'Half Day', 'Absent', 'Incomplete'].includes(attendance.status) && (
                <div style={{ marginTop: 2 }}><StatusBadge status={attendance.status} /></div>
            )}
        </>
    );
}

/**
 * Monthly calendar (Mon-Sun) of one employee's schedule: shift and times,
 * rest days, holidays and approved leave; with `attendance`, the day's
 * time in / out and status too.
 */
export function ScheduleCalendar({ year, month, days, today, attendance, range }: {
    year: number;
    month: number;
    days: ScheduleDay[];
    today: string;
    attendance?: AttendanceDay[];
    /** Show these dates (e.g. one week, see weekRange) instead of the whole month. */
    range?: [string, string];
}) {
    const byDate = new Map(days.map(d => [d.date, d]));
    const attByDate = new Map((attendance ?? []).map(d => [d.date, d]));
    const [from, to] = range ?? monthRange(year, month);
    const lead = (parseIso(from).getDay() + 6) % 7;
    const cells: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let d = from; d <= to; d = addDays(d, 1)) cells.push(d);
    while (cells.length % 7) cells.push(null);
    return (
        <div className="att-calendar-wrap">
            <div className="att-calendar" role="grid" aria-label={range ? `${fmtDay(from)} to ${fmtDay(to)}` : `${MONTHS[month - 1]} ${year}`}>
                {WEEKDAY_SHORT.map(w => <div className="att-cal-head" key={w}>{w.toUpperCase()}</div>)}
                {cells.map((d, i) => {
                    if (!d) return <div className="att-cal-cell att-cal-cell--empty" key={`e${i}`} />;
                    const day = byDate.get(d);
                    const kind = !day ? 'none' : day.holiday ? 'holiday' : day.leave && day.day_type === 'Working' ? 'leave'
                        : day.day_type === 'Working' ? 'work' : day.day_type === 'Rest Day' ? 'rest' : 'none';
                    return (
                        <div className={`att-cal-cell att-cal-cell--${kind}${d === today ? ' att-cal-cell--today' : ''}`} key={d} data-date={d} role="gridcell">
                            <div className="att-cal-date">
                                <span className="att-cal-dnum">{parseIso(d).getDate()}</span>
                                <span className="att-cal-dmon">{parseIso(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            </div>
                            <CalendarCell day={day} attendance={attByDate.get(d)} />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/** Month + year pickers. */
export function MonthPicker({ year, month, onChange, idPrefix }: { year: number; month: number; onChange: (y: number, m: number) => void; idPrefix: string }) {
    const thisYear = new Date().getFullYear();
    const years = [thisYear - 2, thisYear - 1, thisYear, thisYear + 1];
    if (!years.includes(year)) years.push(year);
    return (
        <>
            <select className="form-select" id={`${idPrefix}Month`} aria-label="Month" value={month} onChange={e => onChange(year, Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select className="form-select" id={`${idPrefix}Year`} aria-label="Year" value={year} onChange={e => onChange(Number(e.target.value), month)}>
                {years.sort().map(y => <option key={y} value={y}>{y}</option>)}
            </select>
        </>
    );
}
