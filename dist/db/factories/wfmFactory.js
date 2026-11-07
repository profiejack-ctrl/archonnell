// ==============================================================================
// ARCHON NELL INCORPORATED - WORKFORCE MANAGEMENT (WFM) FACTORY & SEEDER
// Populates wfm.shifts, schedules, attendance_logs, timesheets, and leave_requests
// ==============================================================================
import { query } from '../connection.js';
export async function seedWfm(employees, usersByEmail) {
    console.log('   ↳ [WFMFactory] Seeding plant and operational shifts...');
    const shiftsToCreate = [
        { name: 'Standard Day Shift', start: '08:00:00', end: '17:00:00', breakMin: 60 },
        { name: 'Morning Plant Shift', start: '06:00:00', end: '15:00:00', breakMin: 60 },
        { name: 'Afternoon Logistics Shift', start: '13:00:00', end: '22:00:00', breakMin: 60 },
        { name: 'Night Batching Shift', start: '21:00:00', end: '06:00:00', breakMin: 60 }
    ];
    const shifts = [];
    for (const s of shiftsToCreate) {
        const res = await query(`INSERT INTO wfm.shifts (name, start_time, end_time, break_minutes)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, start_time, end_time, break_minutes`, [s.name, s.start, s.end, s.breakMin]);
        shifts.push({
            id: res.rows[0].id,
            name: res.rows[0].name,
            startTime: res.rows[0].start_time,
            endTime: res.rows[0].end_time,
            breakMinutes: res.rows[0].break_minutes
        });
    }
    const dayShift = shifts.find((s) => s.name === 'Standard Day Shift') || shifts[0];
    const morningShift = shifts.find((s) => s.name === 'Morning Plant Shift') || shifts[0];
    const logisticsShift = shifts.find((s) => s.name === 'Afternoon Logistics Shift') || shifts[0];
    const nightShift = shifts.find((s) => s.name === 'Night Batching Shift') || shifts[0];
    console.log('   ↳ [WFMFactory] Generating 30-day employee rosters and schedules...');
    // Generate date list for the past 30 days
    const today = new Date();
    const dateList = [];
    for (let i = 30; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        dateList.push(d.toISOString().slice(0, 10));
    }
    // Assign shift mapping based on department
    const getEmployeeShift = (emp) => {
        if (emp.departmentCode === 'PROD') {
            return emp.employeeNo.endsWith('1') || emp.employeeNo.endsWith('7') ? nightShift : morningShift;
        }
        if (emp.departmentCode === 'LOG') {
            return emp.employeeNo.endsWith('4') || emp.employeeNo.endsWith('6') ? logisticsShift : dayShift;
        }
        return dayShift;
    };
    // 1. Seed schedules for all employees
    for (const emp of employees) {
        const shift = getEmployeeShift(emp);
        for (const dateStr of dateList) {
            await query(`INSERT INTO wfm.schedules (employee_id, shift_id, schedule_date, status)
         VALUES ($1, $2, $3, 'Scheduled')
         ON CONFLICT (employee_id, schedule_date) DO UPDATE
         SET shift_id = EXCLUDED.shift_id`, [emp.id, shift.id, dateStr]);
        }
    }
    console.log('   ↳ [WFMFactory] Seeding 30 days of realistic attendance logs with late/overtime calculations...');
    let attendanceCount = 0;
    for (const emp of employees) {
        const shift = getEmployeeShift(emp);
        const [startH, startM] = shift.startTime.split(':').map(Number);
        const [endH, endM] = shift.endTime.split(':').map(Number);
        for (const dateStr of dateList) {
            const d = new Date(dateStr);
            const dayOfWeek = d.getDay(); // 0 = Sunday
            // Sunday is designated Day Off
            if (dayOfWeek === 0) {
                await query(`INSERT INTO wfm.attendance_logs (
             employee_id, date, status, verification_method
           ) VALUES ($1, $2, 'Day Off', 'kiosk')
           ON CONFLICT (employee_id, date) DO NOTHING`, [emp.id, dateStr]);
                continue;
            }
            // Pseudo-random deterministic variation based on employee number and date
            const hashVal = (emp.employeeNo.charCodeAt(emp.employeeNo.length - 1) + d.getDate()) % 100;
            let status = 'Present';
            let lateMinutes = 0;
            let undertimeMinutes = 0;
            let otMinutes = 0;
            let otStatus = 'Pending';
            let timeInStr = '';
            let timeOutStr = '';
            let workedHours = 8.00;
            if (hashVal < 8) {
                // Late arrival (5 to 35 mins)
                lateMinutes = 5 + (hashVal * 4);
                const actualInM = startM + lateMinutes;
                const finalInH = startH + Math.floor(actualInM / 60);
                const finalInM = actualInM % 60;
                timeInStr = `${String(finalInH).padStart(2, '0')}:${String(finalInM).padStart(2, '0')}:00`;
                timeOutStr = shift.endTime;
                workedHours = Number((8.0 - (lateMinutes / 60)).toFixed(2));
            }
            else if (hashVal >= 90) {
                // Overtime day (1 to 2.5 hours)
                otMinutes = 60 + ((hashVal - 90) * 10);
                otStatus = 'Approved';
                timeInStr = `${String(startH).padStart(2, '0')}:${String(Math.max(0, startM - 8)).padStart(2, '0')}:00`;
                const extraH = Math.floor(otMinutes / 60);
                const extraM = otMinutes % 60;
                timeOutStr = `${String(endH + extraH).padStart(2, '0')}:${String(endM + extraM).padStart(2, '0')}:00`;
                workedHours = Number((8.0 + (otMinutes / 60)).toFixed(2));
            }
            else {
                // Normal punctual attendance (arriving 5-12 mins early)
                const earlyM = 3 + (hashVal % 10);
                const inMin = (startM - earlyM + 60) % 60;
                const inHr = earlyM > startM ? startH - 1 : startH;
                timeInStr = `${String(inHr).padStart(2, '0')}:${String(inMin).padStart(2, '0')}:00`;
                // Out time 5-15 mins after shift end
                const outMin = (endM + 5 + (hashVal % 10)) % 60;
                timeOutStr = `${String(endH).padStart(2, '0')}:${String(outMin).padStart(2, '0')}:00`;
                workedHours = 8.00;
            }
            const verificationMethod = hashVal % 3 === 0 ? 'rfid' : hashVal % 3 === 1 ? 'kiosk' : 'web';
            await query(`INSERT INTO wfm.attendance_logs (
           employee_id, date, time_in, time_out, worked_hours,
           late_minutes, undertime_minutes, ot_minutes, status, ot_status, verification_method
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (employee_id, date) DO UPDATE
         SET time_in = EXCLUDED.time_in,
             time_out = EXCLUDED.time_out,
             worked_hours = EXCLUDED.worked_hours,
             late_minutes = EXCLUDED.late_minutes,
             ot_minutes = EXCLUDED.ot_minutes,
             status = EXCLUDED.status,
             ot_status = EXCLUDED.ot_status`, [
                emp.id,
                dateStr,
                timeInStr,
                timeOutStr,
                workedHours,
                lateMinutes,
                undertimeMinutes,
                otMinutes,
                status,
                otStatus,
                verificationMethod
            ]);
            attendanceCount++;
        }
    }
    console.log(`   ↳ [WFMFactory] Generating periodic aggregated timesheets...`);
    const adminUser = usersByEmail.get('admin@archonnell.com');
    const timesheetPeriods = [
        { from: '2026-10-01', to: '2026-10-15', status: 'Approved' },
        { from: '2026-10-16', to: '2026-10-31', status: 'Approved' },
        { from: '2026-11-01', to: '2026-11-15', status: 'Submitted' }
    ];
    for (const emp of employees) {
        for (const period of timesheetPeriods) {
            // Calculate actual sums from attendance_logs for this period
            const aggRes = await query(`SELECT COALESCE(SUM(worked_hours), 0) AS total_hours,
                COALESCE(SUM(ot_minutes), 0) AS total_ot_min,
                COALESCE(SUM(late_minutes), 0) AS total_late_min,
                COALESCE(SUM(undertime_minutes), 0) AS total_under_min
         FROM wfm.attendance_logs
         WHERE employee_id = $1 AND date >= $2 AND date <= $3`, [emp.id, period.from, period.to]);
            const row = aggRes.rows[0];
            const regularHours = Math.min(88, Number(row.total_hours) || 88.0);
            const otHours = Number(((Number(row.total_ot_min) || 0) / 60).toFixed(2));
            const lateMin = Number(row.total_late_min) || 0;
            const undertimeMin = Number(row.total_under_min) || 0;
            await query(`INSERT INTO wfm.timesheets (
           employee_id, period_from, period_to, total_regular_hours, total_ot_hours,
           total_late_minutes, total_undertime_minutes, status, approved_by, approved_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (employee_id, period_from, period_to) DO UPDATE
         SET total_regular_hours = EXCLUDED.total_regular_hours,
             total_ot_hours = EXCLUDED.total_ot_hours,
             total_late_minutes = EXCLUDED.total_late_minutes,
             status = EXCLUDED.status`, [
                emp.id,
                period.from,
                period.to,
                regularHours,
                otHours,
                lateMin,
                undertimeMin,
                period.status,
                period.status === 'Approved' ? adminUser?.id || null : null,
                period.status === 'Approved' ? new Date().toISOString() : null
            ]);
        }
    }
    console.log('   ↳ [WFMFactory] Seeding realistic leave requests...');
    const leaveRequestsData = [
        {
            empIdx: 0,
            type: 'Vacation',
            days: 3,
            start: '2026-10-21',
            end: '2026-10-23',
            reason: 'Annual family gathering in Tagaytay City, Cavite.',
            status: 'Approved'
        },
        {
            empIdx: 3,
            type: 'Sick',
            days: 2,
            start: '2026-10-14',
            end: '2026-10-15',
            reason: 'Acute upper respiratory infection. Medical certificate from Silang Doctors Clinic submitted.',
            status: 'Approved'
        },
        {
            empIdx: 6,
            type: 'Vacation',
            days: 4,
            start: '2026-11-20',
            end: '2026-11-24',
            reason: 'Scheduled rest and recreation trip to Palawan.',
            status: 'Pending'
        },
        {
            empIdx: 7,
            type: 'Emergency',
            days: 1,
            start: '2026-10-28',
            end: '2026-10-28',
            reason: 'Severe localized flash flooding along residential access road in Alabang during tropical depression.',
            status: 'Approved'
        },
        {
            empIdx: 13,
            type: 'Emergency',
            days: 2,
            start: '2026-11-04',
            end: '2026-11-05',
            reason: 'Family emergency, home water supply line repair.',
            status: 'Approved'
        },
        {
            empIdx: 16,
            type: 'Sick',
            days: 1,
            start: '2026-11-06',
            end: '2026-11-06',
            reason: 'Migraine headache and fever.',
            status: 'Pending'
        }
    ];
    for (const lr of leaveRequestsData) {
        const emp = employees[lr.empIdx] || employees[0];
        await query(`INSERT INTO wfm.leave_requests (
         employee_id, leave_type, start_date, end_date, days_count,
         reason, status, approved_by, approved_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [
            emp.id,
            lr.type,
            lr.start,
            lr.end,
            lr.days,
            lr.reason,
            lr.status,
            lr.status === 'Approved' ? adminUser?.id || null : null,
            lr.status === 'Approved' ? new Date().toISOString() : null
        ]);
    }
    console.log(`   ✅ [WFMFactory] Seeded ${shifts.length} shifts, ${attendanceCount} daily attendance logs, and ${leaveRequestsData.length} leave requests.`);
    return { shifts };
}
