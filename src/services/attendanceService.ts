import { api } from './http';
import type { Department, Position } from '../types';

export type AttendanceStatus = 'Present' | 'Late' | 'Absent' | 'On Leave' | 'Rest Day' | 'Holiday' | 'Half Day' | 'Incomplete' | 'Scheduled' | 'No Schedule';
export type ScheduleStatus = 'Scheduled' | 'Rest Day' | 'On Leave' | 'Holiday' | 'No Schedule';
export type ShiftType = 'Day Shift' | 'Mid Shift' | 'Night Shift' | 'Rotating Shift';

export interface Shift {
    id: number;
    shift_code: string;
    shift_name: string;
    shift_type: ShiftType;
    /** "HH:MM"; an end earlier than the start ends the next day (overnight). */
    start_time: string;
    end_time: string;
    break_start: string | null;
    break_end: string | null;
    work_minutes: number;
    grace_minutes: number;
    overnight: boolean;
    status: 'Active' | 'Inactive';
    active_assignments: number;
    created_at: string;
    updated_at: string;
}

export interface EmployeeSchedule {
    id: number;
    employee_id: number;
    employee_no: string;
    full_name: string;
    department: string;
    position: string;
    employment_status: string;
    shift_id: number;
    shift_code: string;
    shift_name: string;
    shift_type: ShiftType;
    shift_status: 'Active' | 'Inactive';
    start_time: string;
    end_time: string;
    break_start: string | null;
    break_end: string | null;
    work_minutes: number;
    grace_minutes: number;
    overnight: boolean;
    effective_date: string;
    end_date: string | null;
    /** ISO weekdays, 1 = Monday. */
    working_days: number[];
    rest_days: number[];
    status: 'Active' | 'Inactive';
    remarks: string | null;
    created_at: string;
    updated_at: string;
    created_by_name: string | null;
    updated_by_name: string | null;
}

/** One employee on one date, as the schedule sees it. */
export interface ScheduleDay {
    employee_id: number;
    employee_no: string;
    full_name: string;
    department: string;
    position: string;
    date: string;
    day_type: 'Working' | 'Rest Day' | 'No Schedule';
    schedule_status: ScheduleStatus;
    schedule_id: number | null;
    shift_id: number | null;
    shift_code: string | null;
    shift_name: string | null;
    start_time: string | null;
    end_time: string | null;
    break_start: string | null;
    break_end: string | null;
    overnight: boolean;
    scheduled_minutes: number;
    holiday: { name: string; holiday_type: string } | null;
    leave: { id: number; request_no: string; leave_type: string } | null;
}

/** One employee on one date with attendance and the calculated figures. */
export interface AttendanceDay extends ScheduleDay {
    grace_minutes: number | null;
    record_id: number | null;
    time_in: string | null;
    time_out: string | null;
    source: 'Employee' | 'HR' | null;
    record_updated_at: string | null;
    record_updated_by: string | null;
    remarks: string | null;
    /** null until the employee has timed out. */
    worked_minutes: number | null;
    late_minutes: number;
    undertime_minutes: number;
    overtime_minutes: number;
    status: AttendanceStatus;
    notes: string[];
}

export interface AttEmployee {
    id: number;
    employee_no: string;
    full_name: string;
    department: string;
    position: string;
    employment_status: string;
    date_hired: string | null;
}

export interface Holiday {
    id: number;
    holiday_date: string;
    name: string;
    holiday_type: string;
    created_at: string;
    created_by_name: string | null;
}

export interface MonthlyReportRow {
    employee_id: number;
    employee_no: string;
    full_name: string;
    department: string;
    position: string;
    working_days: number;
    present: number;
    late: number;
    half_day: number;
    absent: number;
    on_leave: number;
    rest_days: number;
    holidays: number;
    incomplete: number;
    worked_minutes: number;
    overtime_minutes: number;
    undertime_minutes: number;
    late_minutes: number;
}

export interface TimeAttendancePage {
    from: string;
    to: string;
    today: string;
    rows: AttendanceDay[];
    departments: Department[];
    positions: Position[];
    shifts: Shift[];
    can_report: boolean;
}

export interface ShiftSchedulePage {
    today: string;
    shifts: Shift[];
    schedules: EmployeeSchedule[];
    employees: AttEmployee[];
    departments: Department[];
    positions: Position[];
    holidays: Holiday[];
    shift_types: ShiftType[];
    holiday_types: string[];
}

export interface MyAttendancePage {
    employee: { id: number; employee_no: string; full_name: string; department: string; position: string } | null;
    server_time?: string;
    today?: AttendanceDay | null;
    open?: { work_date: string; time_in: string } | null;
    can_time_in?: boolean;
    can_time_out?: boolean;
    schedules?: EmployeeSchedule[];
    days?: AttendanceDay[];
    summary?: Record<string, number>;
}

export interface ShiftForm {
    id?: number;
    shift_code: string;
    shift_name: string;
    shift_type: string;
    start_time: string;
    end_time: string;
    break_start: string;
    break_end: string;
    grace_minutes: string;
    status: string;
}

export interface ScheduleForm {
    id?: number;
    employee_id: string;
    shift_id: string;
    effective_date: string;
    end_date: string;
    working_days: number[];
    status: string;
    remarks: string;
    close_previous: boolean;
}

export interface AttendanceForm {
    employee_id: number;
    work_date: string;
    time_in: string;
    time_out: string;
    remarks: string;
    reason: string;
}

type Msg = { message: string };

/** Time & Attendance, Shift & Schedule, and the employee's own attendance. */
export const attendanceService = {
    page: (from: string, to: string) => api.get<TimeAttendancePage>('page_time_attendance', { from, to }),
    monthlyReport: (year: number, month: number, department: string, employeeId: string) =>
        api.get<{ rows: MonthlyReportRow[] }>('attendance_monthly_report', { year, month, department, employee_id: employeeId }),
    saveRecord: (f: AttendanceForm) => api.post<Msg & { row: AttendanceDay }>('save_attendance', { ...f }),

    schedulePage: (year: number) => api.get<ShiftSchedulePage>('page_shift_schedule', { year }),
    scheduleDays: (from: string, to: string, employeeId = '') =>
        api.get<{ from: string; to: string; days: ScheduleDay[] }>('schedule_days', { from, to, employee_id: employeeId }),
    saveShift: (f: ShiftForm) => api.post<Msg & { shift: Shift }>('save_shift', { ...f }),
    saveSchedule: (f: ScheduleForm) => api.post<Msg & { schedule: EmployeeSchedule }>('save_schedule', {
        ...f, working_days: f.working_days, close_previous: f.close_previous ? 1 : 0,
    }),
    saveHoliday: (f: { holiday_date: string; name: string; holiday_type: string }) => api.post<Msg>('save_holiday', { ...f }),
    deleteHoliday: (id: number) => api.post<Msg>('delete_holiday', { id }),

    myPage: (year: number, month: number) => api.get<MyAttendancePage>('page_my_attendance', { year, month }),
    clock: (type: 'in' | 'out') => api.post<Msg>('attendance_clock', { type }),
};
