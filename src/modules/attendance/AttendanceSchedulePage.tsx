import { useSearchParams } from 'react-router-dom';
import { CalendarClock, CalendarDays, Clock } from 'lucide-react';
import Icon from '../../components/Icon';
import { Page, PageHeader } from '../../components/ui';
import { PERM, useAuth } from '../../hooks/AuthContext';
import MyAttendancePage from '../ess/MyAttendancePage';
import ShiftSchedulePage from './ShiftSchedulePage';
import TimeAttendancePage from './TimeAttendancePage';
import { SectionSwitch } from './shared';

type View = 'attendance' | 'schedule' | 'mine';

/**
 * Attendance & Schedule (main sidebar). Super Admin / Admin (Time & Attendance
 * or Shift & Schedule permission, which the server grants to those roles only)
 * see every employee's monthly attendance and schedule calendar, plus their own
 * time clock; everyone else, HR Manager included, sees only their own attendance
 * and schedule (the API returns only their records).
 */
export default function AttendanceSchedulePage() {
    const { can } = useAuth();
    const [params, setParams] = useSearchParams();
    const views: { key: View; label: React.ReactNode }[] = [];
    if (can(PERM.TIME_ATTENDANCE)) views.push({ key: 'attendance', label: <><Icon as={Clock} /> Employee Attendance</> });
    if (can(PERM.SHIFT_SCHEDULE)) views.push({ key: 'schedule', label: <><Icon as={CalendarDays} /> Employee Schedules</> });

    if (!views.length) {
        return (
            <Page id="attendance-schedule">
                <PageHeader title="Attendance & Schedule" subtitle="Your time in / time out, attendance history and work schedule" />
                <MyAttendancePage />
            </Page>
        );
    }
    if (can(PERM.ESS)) views.push({ key: 'mine', label: <><Icon as={CalendarClock} /> My Attendance &amp; Schedule</> });
    const asked = params.get('view') as View | null;
    const view = views.some(v => v.key === asked) ? (asked as View) : views[0].key;

    return (
        <Page id="attendance-schedule">
            <PageHeader title="Attendance & Schedule" subtitle="Monthly attendance and work schedules of employees" />
            <SectionSwitch id="asSections" views={views} active={view} onChange={v => setParams({ view: v }, { replace: true })} />
            {view === 'attendance' && <TimeAttendancePage />}
            {view === 'schedule' && <ShiftSchedulePage />}
            {view === 'mine' && <MyAttendancePage />}
        </Page>
    );
}
