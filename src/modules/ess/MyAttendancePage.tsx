import { useEffect, useState } from 'react';
import { CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, Clock, Eye, Info, LogIn, LogOut, UserCheck, UserX } from 'lucide-react';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import { Card, EmptyRow, PageState, StatCard, StatsGrid } from '../../components/ui';
import { ClearFilters, FilterSelect, SortTh, distinct, is, useFilters, useTableView } from '../../components/TableControls';
import { useAuth } from '../../hooks/AuthContext';
import { usePageData } from '../../hooks/usePageData';
import { attendanceService, type AttendanceDay, type MyAttendancePage as MyAttendanceData } from '../../services/attendanceService';
import { ArchonAlert } from '../../utils/alerts';
import { phpMjY } from '../../utils/format';
import { AttendanceDetails } from '../attendance/TimeAttendancePage';
import { MonthPicker, ScheduleCalendar, StatusBadge, addDays, daysLabel, fmtClock, fmtDay, fmtMinutes, parseIso, shiftTimes, weekRange, ymd } from '../attendance/shared';

/** One week (Monday..Sunday) of the employee's own page: the month(s) it spans, trimmed to the week. */
async function loadWeek(from: string): Promise<MyAttendanceData> {
    const to = addDays(from, 6);
    const months = [...new Set([from.slice(0, 7), to.slice(0, 7)])];
    const pages = await Promise.all(months.map(ym => attendanceService.myPage(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)))));
    const days = pages.flatMap(p => p.days ?? []).filter(d => d.date >= from && d.date <= to);
    const summary: Record<string, number> = {};
    for (const d of days) summary[d.status] = (summary[d.status] ?? 0) + 1;
    return { ...pages[0], days, summary };
}

/** "Sep 28 - Oct 4, 2026" */
function weekLabel(from: string): string {
    const short = (iso: string) => parseIso(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const to = addDays(from, 6);
    return `${short(from)} - ${short(to)}, ${parseIso(to).getFullYear()}`;
}

/** Server clock (Asia/Manila) ticking in the browser. */
function useServerClock(serverTime: string | undefined): Date | null {
    const [offset, setOffset] = useState<number | null>(null);
    const [, tick] = useState(0);
    useEffect(() => {
        if (!serverTime) return;
        const [d, t] = serverTime.split(' ');
        const [y, m, day] = d.split('-').map(Number);
        const [h, mi, s] = t.split(':').map(Number);
        setOffset(new Date(y, m - 1, day, h, mi, s).getTime() - Date.now());
    }, [serverTime]);
    useEffect(() => {
        const id = window.setInterval(() => tick(n => n + 1), 1000);
        return () => window.clearInterval(id);
    }, []);
    return offset === null ? null : new Date(Date.now() + offset);
}

/**
 * My Attendance & Schedule: time in / out, current schedule and attendance history (own records only).
 * The Employee role sees its schedule one week at a time; other roles see the monthly calendar.
 */
export default function MyAttendancePage() {
    const { hasRole } = useAuth();
    const weekly = hasRole('Employee');
    const now = new Date();
    const thisWeek = weekRange(ymd(now))[0];
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [weekStart, setWeekStart] = useState(thisWeek);
    const { data, loading, error, retry, reload } = usePageData(
        () => (weekly ? loadWeek(weekStart) : attendanceService.myPage(year, month)),
        [weekly, weekStart, year, month],
    );
    const [busy, setBusy] = useState(false);
    const [viewing, setViewing] = useState<AttendanceDay | null>(null);
    const clock = useServerClock(data?.server_time);

    const punch = async (type: 'in' | 'out') => {
        setBusy(true);
        try {
            const res = await attendanceService.clock(type);
            await ArchonAlert.success(res.message, { title: type === 'in' ? 'Timed In' : 'Timed Out', timer: 2200 });
        } catch (err) {
            await ArchonAlert.error(err instanceof Error ? err.message : 'Your attendance could not be recorded.');
        } finally {
            setBusy(false);
            await reload();
        }
    };

    const t = data?.today ?? null;
    const today = t?.date ?? '';
    const historyAll = (data?.days ?? []).filter(d => d.date <= today).reverse();
    const hf = useFilters({ status: '', shift: '' });
    const historyView = useTableView(historyAll, d => is(hf.values.status, d.status) && is(hf.values.shift, d.shift_name ?? (d.day_type === 'Rest Day' ? 'Rest Day' : '')), {
        date: d => d.date, shift: d => d.shift_name, in: d => d.time_in, out: d => d.time_out, hours: d => d.worked_minutes, late: d => d.late_minutes,
        undertime: d => d.undertime_minutes, overtime: d => d.overtime_minutes, status: d => d.status,
    });
    const history = historyView.rows;
    const s = data?.summary ?? {};

    return (
        <>
            <PageState loading={loading} error={error} onRetry={retry} />
            {data && !data.employee && (
                <Card><p style={{ color: 'var(--text-secondary)', margin: 0 }}><Icon as={Info} /> Your account is not linked to an employee record. Please contact HR.</p></Card>
            )}
            {data?.employee && (
                <>
                    <Card title={<><Icon as={Clock} /> Time Clock</>} id="myClockCard">
                        <div className="att-clock">
                            <div>
                                <div className="att-clock-time" id="myClockTime">{clock ? clock.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }) : '—'}</div>
                                <div className="att-clock-date">{clock ? clock.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : ''}</div>
                            </div>
                            <div className="att-clock-info">
                                <div><div className="info-label">Today's Schedule</div><div className="info-value" id="myTodaySchedule">
                                    {!t ? '—' : t.holiday ? `Holiday: ${t.holiday.name}` : t.leave && t.day_type === 'Working' ? `On leave (${t.leave.leave_type})`
                                        : t.day_type === 'Working' ? `${t.shift_name} · ${shiftTimes(t.start_time, t.end_time, t.overnight)}` : t.day_type === 'Rest Day' ? 'Rest Day' : 'No schedule assigned'}
                                </div></div>
                                <div><div className="info-label">Time In</div><div className="info-value" id="myTimeIn">{data.open ? fmtClock(data.open.time_in) : fmtClock(t?.time_in)}</div></div>
                                <div><div className="info-label">Time Out</div><div className="info-value" id="myTimeOut">{data.open ? '—' : fmtClock(t?.time_out)}</div></div>
                                <div><div className="info-label">Status</div><div className="info-value" id="myTodayStatus">{t ? <StatusBadge status={t.status} /> : '—'}</div></div>
                                <div><div className="info-label">Total Hours</div><div className="info-value" id="myTodayHours">{data.open ? 'On duty' : fmtMinutes(t?.worked_minutes, '0m')}</div></div>
                                <div><div className="info-label">Late</div><div className="info-value" id="myTodayLate">{fmtMinutes(t?.late_minutes, 'None')}</div></div>
                                <div><div className="info-label">Undertime</div><div className="info-value" id="myTodayUndertime">{fmtMinutes(t?.undertime_minutes, 'None')}</div></div>
                                <div><div className="info-label">Overtime</div><div className="info-value" id="myTodayOvertime">{fmtMinutes(t?.overtime_minutes, 'None')}</div></div>
                            </div>
                            <div className="att-clock-btns">
                                <button className="btn btn-success" id="btnTimeIn" disabled={busy || !data.can_time_in} onClick={() => void punch('in')}><Icon as={LogIn} /> Time In</button>
                                <button className="btn btn-danger" id="btnTimeOut" disabled={busy || !data.can_time_out} onClick={() => void punch('out')}><Icon as={LogOut} /> Time Out</button>
                            </div>
                        </div>
                        {data.open && data.open.work_date !== today && (
                            <p className="att-note" style={{ margin: '0.75rem 0 0' }}>You are timed in for your {fmtDay(data.open.work_date)} shift since {fmtClock(data.open.time_in)}.</p>
                        )}
                        {!data.can_time_in && !data.can_time_out && (
                            <p className="att-note" style={{ margin: '0.75rem 0 0' }}>Your attendance for today is complete. For corrections, please contact HR.</p>
                        )}
                    </Card>

                    <Card title={<><Icon as={CalendarCheck} /> Current Schedule</>} id="myScheduleCard">
                        {!data.schedules?.length ? (
                            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No work schedule is assigned to you yet. HR will assign your shift.</p>
                        ) : (
                            <div className="modal-info-grid">
                                {data.schedules.map(sc => (
                                    <div className="info-item" key={sc.id}>
                                        <div className="info-label">{sc.effective_date > today ? 'Upcoming' : 'Current'} · {phpMjY(sc.effective_date)} - {sc.end_date ? phpMjY(sc.end_date) : 'open-ended'}</div>
                                        <div className="info-value">
                                            <strong>{sc.shift_name}</strong> · {shiftTimes(sc.start_time, sc.end_time, sc.overnight)}
                                            <div className="att-muted">Break: {sc.break_start ? shiftTimes(sc.break_start, sc.break_end) : 'none'} · Working days: {daysLabel(sc.working_days)} · Rest days: {daysLabel(sc.rest_days)}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    <div className="page-toolbar" style={{ marginTop: '1.5rem' }}>
                        {weekly ? (
                            <div className="toolbar-left">
                                <h3 className="card-title" style={{ margin: 0 }}><Icon as={CalendarDays} /> Weekly Schedule &amp; Attendance</h3>
                                <button className="btn btn-outline btn-sm" id="myWeekPrev" title="Previous week" aria-label="Previous week" onClick={() => setWeekStart(addDays(weekStart, -7))}><Icon as={ChevronLeft} /></button>
                                <strong id="myWeekLabel">{weekLabel(weekStart)}</strong>
                                <button className="btn btn-outline btn-sm" id="myWeekNext" title="Next week" aria-label="Next week" onClick={() => setWeekStart(addDays(weekStart, 7))}><Icon as={ChevronRight} /></button>
                                {weekStart !== thisWeek && <button className="btn btn-outline btn-sm" id="myWeekToday" onClick={() => setWeekStart(thisWeek)}>This Week</button>}
                            </div>
                        ) : (
                            <div className="toolbar-left">
                                <h3 className="card-title" style={{ margin: 0 }}><Icon as={CalendarDays} /> Monthly Schedule &amp; Attendance</h3>
                                <MonthPicker year={year} month={month} idPrefix="my" onChange={(y, m) => { setYear(y); setMonth(m); }} />
                            </div>
                        )}
                    </div>
                    <StatsGrid>
                        <StatCard icon={UserCheck} gradient={['#34d399', '#10b981']} value={(s['Present'] ?? 0) + (s['Late'] ?? 0) + (s['Half Day'] ?? 0)} label="Days Attended" />
                        <StatCard icon={Clock} gradient={['#fbbf24', '#f59e0b']} value={s['Late'] ?? 0} label="Late" />
                        <StatCard icon={UserX} gradient={['#f87171', '#ef4444']} value={s['Absent'] ?? 0} label="Absent" />
                        <StatCard icon={CalendarCheck} gradient={['#a78bfa', '#7c3aed']} value={s['On Leave'] ?? 0} label="On Leave" />
                    </StatsGrid>
                    <Card>
                        <ScheduleCalendar year={year} month={month} days={data.days ?? []} attendance={data.days ?? []} today={today}
                            range={weekly ? [weekStart, addDays(weekStart, 6)] : undefined} />
                        <div className="att-legend"><span className="lg-work">Work day</span><span className="lg-rest">Rest day</span><span className="lg-holiday">Holiday</span><span className="lg-leave">Approved leave</span></div>
                    </Card>

                    <Card title={<><Icon as={Clock} /> Attendance History</>} bodyClass="no-padding" id="myHistoryCard">
                        {historyAll.length > 0 && (
                            <div className="toolbar-left" style={{ padding: '1rem 1.5rem 0.25rem' }}>
                                <FilterSelect id="myHistoryStatus" label="Statuses" value={hf.values.status} onChange={hf.set('status')} options={distinct(historyAll, d => d.status)} />
                                <FilterSelect id="myHistoryShift" label="Shifts" value={hf.values.shift} onChange={hf.set('shift')} options={distinct(historyAll, d => d.shift_name ?? (d.day_type === 'Rest Day' ? 'Rest Day' : ''))} />
                                <ClearFilters id="myHistoryClear" active={hf.active} onClear={hf.clear} />
                            </div>
                        )}
                        <table className="data-table" id="myAttendanceTable">
                            <thead>
                                <tr><SortTh view={historyView} k="date">Date</SortTh><SortTh view={historyView} k="shift">Shift</SortTh><SortTh view={historyView} k="in">Time In</SortTh><SortTh view={historyView} k="out">Time Out</SortTh><SortTh view={historyView} k="hours">Total Hours</SortTh><SortTh view={historyView} k="late">Late</SortTh><SortTh view={historyView} k="undertime">Undertime</SortTh><SortTh view={historyView} k="overtime">Overtime</SortTh><SortTh view={historyView} k="status">Status</SortTh><th>Remarks</th><th>Actions</th></tr>
                            </thead>
                            <tbody>
                                {!history.length ? <EmptyRow colSpan={11}>{historyAll.length ? 'No records found. Try other filters or clear them.' : weekly ? 'No attendance for this week yet.' : 'No attendance for this month yet.'}</EmptyRow> : history.map(r => (
                                    <tr className="hover-row" key={r.date} data-date={r.date}>
                                        <td className="att-nowrap">{fmtDay(r.date)}</td>
                                        <td>{r.shift_name ?? <span className="att-muted">{r.day_type === 'Rest Day' ? 'Rest Day' : '—'}</span>}</td>
                                        <td className="att-nowrap">{fmtClock(r.time_in, r.date)}</td>
                                        <td className="att-nowrap">{fmtClock(r.time_out, r.date)}</td>
                                        <td className="att-nowrap">{fmtMinutes(r.worked_minutes, '0m')}</td>
                                        <td className="att-nowrap">{fmtMinutes(r.late_minutes)}</td>
                                        <td className="att-nowrap">{fmtMinutes(r.undertime_minutes)}</td>
                                        <td className="att-nowrap">{fmtMinutes(r.overtime_minutes)}</td>
                                        <td><StatusBadge status={r.status} /></td>
                                        <td>{[r.holiday?.name ?? '', r.leave ? r.leave.leave_type : '', r.remarks ?? '', ...r.notes].filter(Boolean).join(' · ') || <span className="att-muted">—</span>}</td>
                                        <td><button className="table-action-btn" title="View" onClick={() => setViewing(r)}><Icon as={Eye} /></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                </>
            )}
            <Modal open={!!viewing} onClose={() => setViewing(null)} size="lg" title={<><Icon as={CalendarCheck} /> Attendance Details</>}
                footer={<button className="btn btn-outline" onClick={() => setViewing(null)}>Close</button>}>
                {viewing && <AttendanceDetails r={viewing} showEmployee={false} />}
            </Modal>
        </>
    );
}
