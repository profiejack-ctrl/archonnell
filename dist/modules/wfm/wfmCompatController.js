import { query, primaryPool } from '../../db/connection.js';
import * as wfmService from './wfmService.js';
import * as hrmsService from '../hrms/hrmsService.js';
// ------------------------------------------------------------------------------
// SYSTEM & ANALYTICS
// ------------------------------------------------------------------------------
export async function getDbHealth(req, res) {
    const start = Date.now();
    try {
        await primaryPool.query('SELECT 1');
        return res.json({
            success: true,
            data: {
                status: 'healthy',
                ok: true,
                latencyMs: Date.now() - start,
                timestamp: new Date().toISOString(),
            },
        });
    }
    catch (err) {
        return res.status(503).json({
            success: false,
            data: { status: 'down', ok: false, error: err.message, latencyMs: Date.now() - start },
        });
    }
}
export async function getAiHealthScore(req, res, next) {
    try {
        const [empRes, attRes, leaveRes] = await Promise.all([
            query(`SELECT COUNT(*)::int AS total FROM hrms.employees WHERE employment_status != 'Terminated'`),
            query(`SELECT COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE status = 'Present')::int AS present,
                    COUNT(*) FILTER (WHERE status = 'Late')::int AS late
             FROM wfm.attendance_logs WHERE date >= CURRENT_DATE - INTERVAL '30 days'`),
            query(`SELECT COUNT(*) FILTER (WHERE status = 'Pending')::int AS pending FROM wfm.leave_requests`),
        ]);
        const totalAtt = attRes.rows[0]?.total || 0;
        const present = attRes.rows[0]?.present || 0;
        const punctualityRate = totalAtt > 0 ? Math.round((present / totalAtt) * 100) : 96;
        const score = Math.min(100, Math.max(70, punctualityRate));
        return res.json({
            success: true,
            data: {
                score,
                status: score >= 85 ? 'Optimal' : score >= 70 ? 'Good' : 'Attention',
                totalEmployees: empRes.rows[0]?.total || 0,
                pendingLeaves: leaveRes.rows[0]?.pending || 0,
                punctualityRate,
                generatedAt: new Date().toISOString(),
            },
        });
    }
    catch (err) {
        return next(err);
    }
}
export async function getAiInsights(req, res, next) {
    try {
        const alerts = await wfmService.getWorkforceAlerts();
        return res.json({ success: true, data: { insights: alerts, alerts } });
    }
    catch (err) {
        return next(err);
    }
}
export async function postAiAction(req, res) {
    return res.json({ success: true, message: 'AI insight action processed.', data: req.body });
}
export async function getWorkforceAnalytics(req, res, next) {
    try {
        const period = req.query.period === 'month' ? 30 : 7;
        const [schedRes, attRes, empRes] = await Promise.all([
            query(`SELECT COUNT(*)::int AS scheduled FROM wfm.schedules WHERE schedule_date >= CURRENT_DATE - ($1 || ' days')::interval`, [period]),
            query(`SELECT COUNT(*) FILTER (WHERE status IN ('Present', 'Late', 'Half Day'))::int AS present,
                    COUNT(*) FILTER (WHERE status = 'Late')::int AS late
             FROM wfm.attendance_logs WHERE date >= CURRENT_DATE - ($1 || ' days')::interval`, [period]),
            query(`SELECT COUNT(*)::int AS total FROM hrms.employees WHERE employment_status != 'Terminated'`),
        ]);
        const scheduledDays = schedRes.rows[0]?.scheduled || 0;
        const presentDays = attRes.rows[0]?.present || 0;
        const rate = scheduledDays > 0 ? Math.round((presentDays / scheduledDays) * 100) : 95;
        return res.json({
            success: true,
            data: {
                period: req.query.period || 'week',
                totalEmployees: empRes.rows[0]?.total || 0,
                attendanceRate: { rate, scheduledDays, presentDays },
                lateCount: attRes.rows[0]?.late || 0,
            },
        });
    }
    catch (err) {
        return next(err);
    }
}
export async function getAttendanceTrend(req, res, next) {
    try {
        const resRows = await query(`SELECT date::text AS date,
              COUNT(*) FILTER (WHERE status = 'Present')::int AS present,
              COUNT(*) FILTER (WHERE status = 'Late')::int AS late,
              COUNT(*) FILTER (WHERE status = 'Absent')::int AS absent
       FROM wfm.attendance_logs
       WHERE date >= CURRENT_DATE - INTERVAL '14 days'
       GROUP BY date ORDER BY date ASC`);
        return res.json({ success: true, data: resRows.rows });
    }
    catch (err) {
        return next(err);
    }
}
export async function getDepartmentProductivity(req, res, next) {
    try {
        const resRows = await query(`SELECT d.name AS department,
              COUNT(DISTINCT e.id)::int AS headcount,
              COALESCE(AVG(a.worked_hours), 8)::numeric(5,2) AS avg_hours
       FROM hrms.departments d
       LEFT JOIN hrms.employees e ON e.department_id = d.id
       LEFT JOIN wfm.attendance_logs a ON a.employee_id = e.id AND a.date >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY d.id, d.name ORDER BY d.name ASC`);
        return res.json({ success: true, data: resRows.rows });
    }
    catch (err) {
        return next(err);
    }
}
export async function getLeaveTrend(req, res, next) {
    try {
        const resRows = await query(`SELECT leave_type, status, COUNT(*)::int AS count
       FROM wfm.leave_requests
       GROUP BY leave_type, status`);
        return res.json({ success: true, data: resRows.rows });
    }
    catch (err) {
        return next(err);
    }
}
export async function getPunctualityScore(req, res, next) {
    try {
        const resRows = await query(`SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'Present')::int AS on_time
       FROM wfm.attendance_logs WHERE date >= CURRENT_DATE - INTERVAL '30 days'`);
        const total = resRows.rows[0]?.total || 0;
        const onTime = resRows.rows[0]?.on_time || 0;
        return res.json({
            success: true,
            data: { score: total > 0 ? Math.round((onTime / total) * 100) : 100, total, onTime },
        });
    }
    catch (err) {
        return next(err);
    }
}
export async function getTopPerformers(req, res, next) {
    try {
        const resRows = await query(`SELECT e.id, e.employee_no, CONCAT(e.first_name, ' ', e.last_name) AS name,
              d.name AS department, u.avatar_url AS avatar,
              COUNT(a.id) FILTER (WHERE a.status = 'Present')::int AS on_time_days,
              COALESCE(SUM(a.worked_hours), 0)::numeric(8,2) AS total_hours
       FROM hrms.employees e
       LEFT JOIN hrms.departments d ON d.id = e.department_id
       LEFT JOIN auth_core.users u ON u.id = e.user_id
       LEFT JOIN wfm.attendance_logs a ON a.employee_id = e.id AND a.date >= CURRENT_DATE - INTERVAL '30 days'
       WHERE e.employment_status != 'Terminated'
       GROUP BY e.id, d.name, u.avatar_url
       ORDER BY on_time_days DESC, total_hours DESC
       LIMIT 10`);
        return res.json({ success: true, data: resRows.rows });
    }
    catch (err) {
        return next(err);
    }
}
// ------------------------------------------------------------------------------
// KIOSK ENDPOINTS (Persisted in wfm.settings for serverless consistency)
// ------------------------------------------------------------------------------
const DEFAULT_KIOSK_CONFIG = {
    location: 'Main Entrance',
    deviceName: 'Front Door Kiosk',
    timezone: 'Asia/Manila',
    active: false,
    enabledAt: null,
    hasPin: false,
    kioskEnabled: true,
    pinConfigured: false,
    requireFaceVerification: false,
    gracePeriodMinutes: 15,
    pin: '1234',
};
async function readKioskConfig() {
    try {
        const res = await query(`SELECT value FROM wfm.settings WHERE key = 'kiosk' LIMIT 1`);
        if (res.rows[0]?.value) {
            return { ...DEFAULT_KIOSK_CONFIG, ...res.rows[0].value };
        }
    }
    catch (err) {
        console.warn('[Kiosk Settings] Read fallback:', err.message);
    }
    return { ...DEFAULT_KIOSK_CONFIG };
}
async function writeKioskConfig(patch) {
    const current = await readKioskConfig();
    const next = { ...current, ...patch };
    try {
        await query(`INSERT INTO wfm.settings (key, value, updated_at)
       VALUES ('kiosk', $1::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`, [JSON.stringify(next)]);
    }
    catch (err) {
        console.warn('[Kiosk Settings] Write fallback:', err.message);
    }
    return next;
}
export async function getKioskConfig(req, res) {
    const cfg = await readKioskConfig();
    const { pin: _pin, ...publicConfig } = cfg;
    return res.json({
        success: true,
        data: { ...publicConfig, serverTime: new Date().toISOString() },
    });
}
export async function updateKioskConfig(req, res) {
    const next = await writeKioskConfig(req.body || {});
    const { pin: _pin, ...publicConfig } = next;
    return res.json({ success: true, data: publicConfig });
}
export async function setKioskPin(req, res) {
    const pin = String(req.body?.pin || '').trim();
    if (!pin || pin.length < 4) {
        return res.status(400).json({ success: false, message: 'PIN must be at least 4 digits.' });
    }
    const next = await writeKioskConfig({
        pin,
        hasPin: true,
        pinConfigured: true,
    });
    const { pin: _pin, ...publicConfig } = next;
    return res.json({ success: true, data: publicConfig, message: 'Kiosk PIN updated.' });
}
export async function verifyKioskPin(req, res) {
    const cfg = await readKioskConfig();
    const incoming = String(req.body?.pin || '').trim();
    const ok = Boolean(incoming) && (incoming === String(cfg.pin || '1234') || (!cfg.hasPin && incoming === '1234'));
    if (!ok) {
        return res.status(401).json({ success: false, ok: false, message: 'Incorrect access PIN.' });
    }
    const midnight = new Date();
    midnight.setHours(23, 59, 59, 999);
    const expiresAt = Math.floor(midnight.getTime() / 1000);
    const token = `kiosk_${Buffer.from(`${Date.now()}:${expiresAt}`).toString('base64')}`;
    return res.json({
        success: true,
        ok: true,
        valid: true,
        token,
        expiresAt,
    });
}
export async function getKioskOverview(req, res, _next) {
    const today = new Date().toISOString().slice(0, 10);
    const [cfg, empRes, attRes] = await Promise.all([
        readKioskConfig().catch(() => ({ ...DEFAULT_KIOSK_CONFIG })),
        query(`SELECT COUNT(*)::int AS total FROM hrms.employees WHERE employment_status != 'Terminated'`).catch(() => ({ rows: [{ total: 0 }] })),
        query(`SELECT COUNT(*) FILTER (WHERE time_in IS NOT NULL)::int AS clocked_in,
                  COUNT(*) FILTER (WHERE time_out IS NOT NULL)::int AS clocked_out
           FROM wfm.attendance_logs WHERE date = $1`, [today]).catch(() => ({ rows: [{ clocked_in: 0, clocked_out: 0 }] })),
    ]);
    const activeEmployees = empRes.rows[0]?.total || 0;
    return res.json({
        success: true,
        data: {
            totalEmployees: activeEmployees,
            clockedInToday: attRes.rows[0]?.clocked_in || 0,
            clockedOutToday: attRes.rows[0]?.clocked_out || 0,
            waiting: [],
            failedAttempts: 0,
            readiness: {
                pinSet: Boolean(cfg.hasPin || cfg.pinConfigured),
                kioskActive: Boolean(cfg.active),
                activeEmployees,
                withoutFace: activeEmployees,
            },
        },
    });
}
export function normalizeKioskEmployee(e) {
    if (!e)
        return e;
    return {
        ...e,
        employeeId: e.employee_no || e.id,
        employeeNo: e.employee_no || e.id,
        firstName: e.firstName || e.first_name || '',
        lastName: e.lastName || e.last_name || '',
        name: `${e.first_name || ''} ${e.last_name || ''}`.trim(),
        department: e.department || e.department_name || '',
        position: e.position || e.position_title || '',
        avatar: e.avatar || e.avatar_url || '',
        status: e.employment_status === 'Terminated' ? 'Terminated' : 'Active',
        faceRegistered: Boolean(e.face_registered ?? e.faceRegistered ?? e.face_descriptor),
        faceDescriptor: e.face_descriptor || e.faceDescriptor || null,
        faceImage: e.face_image || e.faceImage || null,
    };
}
export async function getKioskEmployees(req, res, next) {
    try {
        const data = await hrmsService.getAllEmployees();
        return res.json({ success: true, data: data.map(normalizeKioskEmployee) });
    }
    catch (err) {
        return next(err);
    }
}
// ------------------------------------------------------------------------------
// LEAVE TYPES, BALANCES, AUDIT, SEARCH
// ------------------------------------------------------------------------------
export async function getLeaveTypes(req, res) {
    return res.json({
        success: true,
        data: [
            { id: 'VL', code: 'VL', name: 'Vacation Leave', defaultDays: 15, paid: true },
            { id: 'SL', code: 'SL', name: 'Sick Leave', defaultDays: 15, paid: true },
            { id: 'EL', code: 'EL', name: 'Emergency Leave', defaultDays: 5, paid: true },
            { id: 'ML', code: 'ML', name: 'Maternity Leave', defaultDays: 105, paid: true },
            { id: 'PL', code: 'PL', name: 'Paternity Leave', defaultDays: 7, paid: true },
        ],
    });
}
export async function getLeaveBalances(req, res, next) {
    try {
        const empId = req.params.employeeId;
        const usedRes = await query(`SELECT leave_type, COALESCE(SUM(days_count), 0)::int AS used
       FROM wfm.leave_requests
       WHERE employee_id = $1 AND status = 'Approved'
       GROUP BY leave_type`, [empId]);
        const usedMap = {};
        for (const r of usedRes.rows)
            usedMap[r.leave_type] = r.used;
        return res.json({
            success: true,
            data: {
                VL: { total: 15, used: usedMap['VL'] || 0, remaining: Math.max(0, 15 - (usedMap['VL'] || 0)) },
                SL: { total: 15, used: usedMap['SL'] || 0, remaining: Math.max(0, 15 - (usedMap['SL'] || 0)) },
                EL: { total: 5, used: usedMap['EL'] || 0, remaining: Math.max(0, 5 - (usedMap['EL'] || 0)) },
            },
        });
    }
    catch (err) {
        return next(err);
    }
}
export async function getWorkingDays(req, res) {
    const start = new Date(String(req.query.startDate || new Date().toISOString().slice(0, 10)));
    const end = new Date(String(req.query.endDate || new Date().toISOString().slice(0, 10)));
    let count = 0;
    const cur = new Date(start);
    while (cur <= end) {
        const day = cur.getDay();
        if (day !== 0 && day !== 6)
            count++;
        cur.setDate(cur.getDate() + 1);
    }
    return res.json({ success: true, data: { workingDays: Math.max(1, count) } });
}
export async function getAuditLogs(req, res, next) {
    try {
        const page = Math.max(1, Number(req.query.page || 1));
        const limit = Math.min(100, Math.max(1, Number(req.query.limit || 25)));
        const offset = (page - 1) * limit;
        const [rowsRes, countRes] = await Promise.all([
            query(`SELECT a.*, u.email AS user_email, u.full_name AS user_name
         FROM auth_core.audit_logs a
         LEFT JOIN auth_core.users u ON u.id = a.user_id
         ORDER BY a.created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]),
            query(`SELECT COUNT(*)::int AS total FROM auth_core.audit_logs`),
        ]);
        return res.json({
            success: true,
            data: rowsRes.rows,
            meta: { page, limit, total: countRes.rows[0]?.total || 0 },
        });
    }
    catch (err) {
        return next(err);
    }
}
export async function globalSearch(req, res, next) {
    try {
        const q = String(req.query.q || '').trim();
        if (!q)
            return res.json({ success: true, data: [] });
        const empRes = await query(`SELECT id, employee_no, first_name, last_name, email
       FROM hrms.employees
       WHERE first_name ILIKE $1 OR last_name ILIKE $1 OR employee_no ILIKE $1 OR email ILIKE $1
       LIMIT 10`, [`%${q}%`]);
        const results = empRes.rows.map((e) => ({
            id: e.id,
            type: 'employee',
            title: `${e.first_name} ${e.last_name}`.trim(),
            subtitle: `${e.employee_no} · ${e.email}`,
            to: `/employees?search=${encodeURIComponent(e.employee_no || e.first_name)}`,
        }));
        return res.json({ success: true, data: results });
    }
    catch (err) {
        return next(err);
    }
}
// ------------------------------------------------------------------------------
// SHIFTS HOLIDAYS & TIMESHEETS PAYROLL EXPORT
// ------------------------------------------------------------------------------
export async function getHolidays(req, res) {
    const year = new Date().getFullYear();
    return res.json({
        success: true,
        data: [
            { id: 'hol-1', date: `${year}-01-01`, name: "New Year's Day", type: 'Regular' },
            { id: 'hol-2', date: `${year}-04-09`, name: 'Araw ng Kagitingan', type: 'Regular' },
            { id: 'hol-3', date: `${year}-05-01`, name: 'Labor Day', type: 'Regular' },
            { id: 'hol-4', date: `${year}-06-12`, name: 'Independence Day', type: 'Regular' },
            { id: 'hol-5', date: `${year}-08-21`, name: 'Ninoy Aquino Day', type: 'Special' },
            { id: 'hol-6', date: `${year}-11-01`, name: "All Saints' Day", type: 'Special' },
            { id: 'hol-7', date: `${year}-11-30`, name: 'Bonifacio Day', type: 'Regular' },
            { id: 'hol-8', date: `${year}-12-25`, name: 'Christmas Day', type: 'Regular' },
            { id: 'hol-9', date: `${year}-12-30`, name: 'Rizal Day', type: 'Regular' },
        ],
    });
}
export async function exportTimesheetsForPayroll(req, res, next) {
    try {
        // Ensure exported_at column exists even if cold-start migration is still running
        await query(`ALTER TABLE wfm.timesheets ADD COLUMN IF NOT EXISTS exported_at TIMESTAMP WITH TIME ZONE`).catch(() => { });
        const updatedRes = await query(`UPDATE wfm.timesheets
       SET exported_at = NOW(), updated_at = NOW()
       WHERE status = 'Approved' AND exported_at IS NULL
       RETURNING *`);
        if (updatedRes.rows.length === 0) {
            return res.json({ success: true, data: [] });
        }
        const ids = updatedRes.rows.map((r) => r.id);
        const enriched = await query(`SELECT t.*, e.employee_no, CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
              d.name AS department_name
       FROM wfm.timesheets t
       JOIN hrms.employees e ON e.id = t.employee_id
       LEFT JOIN hrms.departments d ON d.id = e.department_id
       WHERE t.id = ANY($1::uuid[])
       ORDER BY e.last_name ASC`, [ids]);
        const payload = enriched.rows.map((t) => ({
            ...t,
            id: t.id,
            employeeId: t.employee_no || t.employee_id,
            employeeName: t.employee_name,
            department: t.department_name || '',
            periodStart: t.period_from ? String(t.period_from).slice(0, 10) : '',
            periodEnd: t.period_to ? String(t.period_to).slice(0, 10) : '',
            regularHours: Number(t.regular_hours || 0),
            overtimeHours: Number(t.overtime_hours || 0),
            totalHours: Number(t.total_hours || 0),
            status: t.status,
            exportedAt: t.exported_at,
        }));
        return res.json({ success: true, data: payload });
    }
    catch (err) {
        return next(err);
    }
}
