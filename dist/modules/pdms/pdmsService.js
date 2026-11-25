import { query } from '../../db/connection.js';
export async function ingestWorkforceRecords(records, source = 'hr2_api') {
    let accepted = 0;
    const rejected = [];
    for (let i = 0; i < records.length; i++) {
        const r = records[i];
        if (!r || typeof r !== 'object') {
            rejected.push({ row: i, reason: 'Invalid record object.' });
            continue;
        }
        const code = String(r.employee_code || '').trim();
        const periodStart = String(r.period_start || '').trim();
        const periodEnd = String(r.period_end || '').trim();
        const scheduledDays = Number(r.scheduled_days);
        const daysPresent = Number(r.days_present ?? 0);
        const daysAbsent = Number(r.days_absent ?? 0);
        const lateCount = Number(r.late_count ?? 0);
        const totalLateMinutes = Number(r.total_late_minutes ?? 0);
        const overtimeHours = Number(r.overtime_hours ?? 0);
        const leaveDays = Number(r.leave_days ?? 0);
        const unexcusedAbsences = Number(r.unexcused_absences ?? 0);
        const disciplinaryActions = Number(r.disciplinary_actions ?? 0);
        if (!code) {
            rejected.push({ row: i, reason: 'employee_code is required.' });
            continue;
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd) || periodEnd < periodStart) {
            rejected.push({ row: i, reason: 'Invalid period_start or period_end (expected Y-m-d with period_end >= period_start).' });
            continue;
        }
        if (!Number.isInteger(scheduledDays) || scheduledDays < 0 || scheduledDays > 366) {
            rejected.push({ row: i, reason: 'scheduled_days must be an integer between 0 and 366.' });
            continue;
        }
        if (daysPresent > scheduledDays || daysAbsent > scheduledDays || leaveDays > scheduledDays) {
            rejected.push({ row: i, reason: 'days_present, days_absent, and leave_days cannot exceed scheduled_days.' });
            continue;
        }
        if (unexcusedAbsences > daysAbsent) {
            rejected.push({ row: i, reason: 'unexcused_absences cannot exceed days_absent.' });
            continue;
        }
        if (overtimeHours < 0 || overtimeHours > 744) {
            rejected.push({ row: i, reason: 'overtime_hours must be between 0 and 744.' });
            continue;
        }
        const empRes = await query(`SELECT id FROM hrms.employees WHERE LOWER(employee_no) = LOWER($1) LIMIT 1`, [code]);
        const employeeId = empRes.rows[0]?.id || null;
        const attendanceRate = scheduledDays > 0
            ? Number(((daysPresent / scheduledDays) * 100).toFixed(2))
            : 0;
        await query(`INSERT INTO pdms.workforce_records (
         employee_id, employee_code, period_start, period_end,
         scheduled_days, days_present, days_absent, late_count,
         total_late_minutes, overtime_hours, leave_days,
         unexcused_absences, disciplinary_actions, attendance_rate,
         external_ref, source, raw, received_at, updated_at
       ) VALUES ($1, $2, $3::date, $4::date, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
       ON CONFLICT (employee_code, period_start, period_end, source)
       DO UPDATE SET
         employee_id = COALESCE(EXCLUDED.employee_id, pdms.workforce_records.employee_id),
         scheduled_days = EXCLUDED.scheduled_days,
         days_present = EXCLUDED.days_present,
         days_absent = EXCLUDED.days_absent,
         late_count = EXCLUDED.late_count,
         total_late_minutes = EXCLUDED.total_late_minutes,
         overtime_hours = EXCLUDED.overtime_hours,
         leave_days = EXCLUDED.leave_days,
         unexcused_absences = EXCLUDED.unexcused_absences,
         disciplinary_actions = EXCLUDED.disciplinary_actions,
         attendance_rate = EXCLUDED.attendance_rate,
         external_ref = EXCLUDED.external_ref,
         raw = EXCLUDED.raw,
         received_at = NOW(),
         updated_at = NOW()`, [
            employeeId,
            code,
            periodStart,
            periodEnd,
            scheduledDays,
            daysPresent,
            daysAbsent,
            lateCount,
            totalLateMinutes,
            overtimeHours,
            leaveDays,
            unexcusedAbsences,
            disciplinaryActions,
            attendanceRate,
            r.external_ref || null,
            source,
            JSON.stringify(r),
        ]);
        accepted++;
    }
    return { accepted, rejected };
}
export async function syncWorkforceFromWfm(periodStart, periodEnd) {
    const employeesRes = await query(`SELECT id, employee_no FROM hrms.employees WHERE employment_status != 'Terminated'`);
    const records = [];
    for (const emp of employeesRes.rows) {
        const [attRes, otRes, leaveRes, schedRes] = await Promise.all([
            query(`SELECT
           COUNT(*) FILTER (WHERE status IN ('Present', 'Late', 'Half Day'))::int AS days_present,
           COUNT(*) FILTER (WHERE status = 'Absent')::int AS days_absent,
           COUNT(*) FILTER (WHERE status = 'Late')::int AS late_count,
           COALESCE(SUM(late_minutes), 0)::int AS total_late_minutes
         FROM wfm.attendance_logs
         WHERE employee_id = $1 AND date >= $2::date AND date <= $3::date`, [emp.id, periodStart, periodEnd]),
            query(`SELECT COALESCE(SUM(hours), 0)::numeric(6,2) AS overtime_hours
         FROM wfm.overtime_requests
         WHERE employee_id = $1 AND status = 'Approved' AND date >= $2::date AND date <= $3::date`, [emp.id, periodStart, periodEnd]),
            query(`SELECT COALESCE(SUM(days_count), 0)::int AS leave_days
         FROM wfm.leave_requests
         WHERE employee_id = $1 AND status = 'Approved' AND start_date <= $3::date AND end_date >= $2::date`, [emp.id, periodStart, periodEnd]),
            query(`SELECT COUNT(*)::int AS scheduled_days
         FROM wfm.shift_schedules
         WHERE employee_id = $1 AND schedule_date >= $2::date AND schedule_date <= $3::date`, [emp.id, periodStart, periodEnd]),
        ]);
        const att = attRes.rows[0] || {};
        const scheduledDays = Math.max(Number(schedRes.rows[0]?.scheduled_days || 0), Number(att.days_present || 0) + Number(att.days_absent || 0));
        records.push({
            employee_code: emp.employee_no,
            period_start: periodStart,
            period_end: periodEnd,
            scheduled_days: scheduledDays,
            days_present: Math.min(scheduledDays, Number(att.days_present || 0)),
            days_absent: Math.min(scheduledDays, Number(att.days_absent || 0)),
            late_count: Number(att.late_count || 0),
            total_late_minutes: Number(att.total_late_minutes || 0),
            overtime_hours: Number(otRes.rows[0]?.overtime_hours || 0),
            leave_days: Math.min(scheduledDays, Number(leaveRes.rows[0]?.leave_days || 0)),
            unexcused_absences: 0,
            disciplinary_actions: 0,
            external_ref: `WFM-${periodStart}-${emp.employee_no}`,
        });
    }
    return ingestWorkforceRecords(records, 'hr2_api');
}
export async function listWorkforceRecords(employeeCode) {
    let sql = `
    SELECT wr.*, e.first_name, e.last_name
    FROM pdms.workforce_records wr
    LEFT JOIN hrms.employees e ON e.id = wr.employee_id
  `;
    const params = [];
    if (employeeCode) {
        params.push(employeeCode);
        sql += ` WHERE LOWER(wr.employee_code) = LOWER($1)`;
    }
    sql += ` ORDER BY wr.period_end DESC, wr.employee_code ASC LIMIT 200`;
    const res = await query(sql, params);
    return res.rows;
}
// ------------------------------------------------------------------------------
// PDMS DASHBOARD & CORE MODULES
// ------------------------------------------------------------------------------
export async function getDashboardSummary() {
    const [empCount, goalsCount, reviewsStats, coursesCount, trainingsCount, recognitionsCount, vacantCount] = await Promise.all([
        query(`SELECT COUNT(*)::int AS count FROM hrms.employees WHERE employment_status != 'Terminated'`),
        query(`SELECT COUNT(*)::int AS count FROM pdms.goals`),
        query(`SELECT COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE status = 'Completed')::int AS completed,
                  COUNT(*) FILTER (WHERE status = 'Pending')::int AS pending,
                  COALESCE(AVG(score), 0)::numeric(5,2) AS avg_score
           FROM pdms.performance_reviews`),
        query(`SELECT COUNT(*)::int AS count FROM pdms.courses WHERE is_published = TRUE`),
        query(`SELECT COUNT(*)::int AS count FROM pdms.trainings`),
        query(`SELECT COUNT(*)::int AS count FROM pdms.recognitions`),
        query(`SELECT COUNT(*)::int AS count FROM pdms.succession_positions`),
    ]);
    return {
        counts: {
            employees: empCount.rows[0]?.count || 0,
            active_goals: goalsCount.rows[0]?.count || 0,
            reviews: reviewsStats.rows[0]?.total || 0,
            courses: coursesCount.rows[0]?.count || 0,
            trainings: trainingsCount.rows[0]?.count || 0,
            recognitions: recognitionsCount.rows[0]?.count || 0,
            vacant_positions: vacantCount.rows[0]?.count || 0,
        },
        performance_health: {
            average_score: Number(reviewsStats.rows[0]?.avg_score || 0),
            completed: reviewsStats.rows[0]?.completed || 0,
            pending: reviewsStats.rows[0]?.pending || 0,
            total: reviewsStats.rows[0]?.total || 0,
        },
    };
}
export async function listCompetencies() {
    const res = await query(`SELECT * FROM pdms.competencies WHERE is_active = TRUE ORDER BY created_at DESC`);
    return res.rows;
}
export async function createCompetency(data) {
    const res = await query(`INSERT INTO pdms.competencies (code, name, category, description)
     VALUES ($1, $2, $3, $4) RETURNING *`, [data.code || `COMP-${Date.now().toString().slice(-4)}`, data.name, data.category || 'Core', data.description || null]);
    return res.rows[0];
}
export async function listGoals() {
    const res = await query(`SELECT g.*, e.first_name, e.last_name, e.employee_no AS employee_code
     FROM pdms.goals g
     LEFT JOIN hrms.employees e ON e.id = g.employee_id
     ORDER BY g.created_at DESC`);
    return res.rows;
}
export async function createGoal(data) {
    const res = await query(`INSERT INTO pdms.goals (employee_id, title, description, progress, weight, status, due_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`, [data.employee_id || null, data.title, data.description || null, data.progress ?? 0, data.weight ?? 50, data.status || 'In Progress', data.due_date || null]);
    return res.rows[0];
}
export async function listKpis() {
    const res = await query(`SELECT * FROM pdms.kpis WHERE is_active = TRUE ORDER BY created_at DESC`);
    return res.rows;
}
export async function createKpi(data) {
    const res = await query(`INSERT INTO pdms.kpis (name, source, unit, target_value, direction, frequency)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [data.name, data.source || 'manual', data.unit || '%', data.target_value ?? 100, data.direction || 'higher', data.frequency || 'monthly']);
    return res.rows[0];
}
export async function listPerformanceReviews() {
    const res = await query(`SELECT pr.*, e.first_name, e.last_name, e.employee_no AS employee_code
     FROM pdms.performance_reviews pr
     LEFT JOIN hrms.employees e ON e.id = pr.employee_id
     ORDER BY pr.created_at DESC`);
    return res.rows;
}
export async function createPerformanceReview(data) {
    const res = await query(`INSERT INTO pdms.performance_reviews (employee_id, cycle_name, score, status, comments)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`, [data.employee_id || null, data.cycle_name, data.score ?? 0, data.status || 'Pending', data.comments || null]);
    return res.rows[0];
}
export async function listCourses() {
    const res = await query(`SELECT * FROM pdms.courses ORDER BY created_at DESC`);
    return res.rows;
}
export async function listTrainings() {
    const res = await query(`SELECT * FROM pdms.trainings ORDER BY created_at DESC`);
    return res.rows;
}
export async function listSuccessionPositions() {
    const res = await query(`SELECT sp.*, p.title AS position_title
     FROM pdms.succession_positions sp
     LEFT JOIN hrms.positions p ON p.id = sp.position_id
     ORDER BY sp.created_at DESC`);
    return res.rows;
}
export async function listRecognitions() {
    const res = await query(`SELECT r.*,
            rec.first_name AS recipient_first_name, rec.last_name AS recipient_last_name,
            snd.first_name AS sender_first_name, snd.last_name AS sender_last_name
     FROM pdms.recognitions r
     LEFT JOIN hrms.employees rec ON rec.id = r.recipient_employee_id
     LEFT JOIN hrms.employees snd ON snd.id = r.sender_employee_id
     ORDER BY r.created_at DESC`);
    return res.rows;
}
export async function createRecognition(data) {
    const res = await query(`INSERT INTO pdms.recognitions (recipient_employee_id, sender_employee_id, category, message)
     VALUES ($1, $2, $3, $4) RETURNING *`, [data.recipient_employee_id || null, data.sender_employee_id || null, data.category || 'Excellence', data.message]);
    return res.rows[0];
}
