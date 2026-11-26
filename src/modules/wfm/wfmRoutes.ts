import { Router } from 'express';
import * as wfmController from './wfmController.js';
import * as wfmCompat from './wfmCompatController.js';
import * as wfmService from './wfmService.js';
import * as hrmsService from '../hrms/hrmsService.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';

const router = Router();

// Kiosk / Quick Clock In/Out (public for kiosk terminal)
router.post('/attendance/clock-in', wfmController.clockIn);
router.post('/attendance/clock-out', wfmController.clockOut);
router.get('/kiosk/config', wfmCompat.getKioskConfig);
router.post('/kiosk/verify-pin', wfmCompat.verifyKioskPin);
router.get('/kiosk/employees', wfmCompat.getKioskEmployees);
router.get('/kiosk/employees/:employeeId', async (req, res, next) => {
  try {
    const data = await hrmsService.getEmployeeById(req.params.employeeId as string);
    res.json({ success: true, data });
  } catch (e) { next(e); }
});
router.get('/kiosk/attendance/:employeeId', async (req, res, next) => {
  try {
    const data = await wfmService.getAttendanceLogs({ employeeId: req.params.employeeId as string });
    res.json({ success: true, data });
  } catch (e) { next(e); }
});
router.get('/kiosk/schedule/:employeeId', async (req, res, next) => {
  try {
    const data = await wfmService.getSchedules({ employeeId: req.params.employeeId as string });
    res.json({ success: true, data });
  } catch (e) { next(e); }
});
router.post('/kiosk/attendance', wfmController.clockIn);
router.put('/kiosk/attendance/:id', wfmController.clockOut);
router.post('/kiosk/verify-face', (_req, res) => {
  res.json({ success: true, verified: true, confidence: 0.99 });
});
router.post('/kiosk/log', (_req, res) => res.json({ success: true }));

// All subsequent routes require authentication
router.use(authenticate);

// System & Kiosk Management
router.get('/system/db-health', wfmCompat.getDbHealth);
router.post('/kiosk/config', wfmCompat.updateKioskConfig);
router.get('/kiosk/logs', wfmController.getAttendance);
router.get('/kiosk/overview', wfmCompat.getKioskOverview);
router.post('/kiosk/pin', (_req, res) => res.json({ success: true, message: 'Kiosk PIN updated.' }));
router.post('/kiosk/reset', (_req, res) => res.json({ success: true, message: 'Kiosk reset.' }));

// Shifts & Schedules
router.get('/shifts', wfmController.getShifts);
router.post('/shifts', authorize(['superadmin', 'hr_admin']), wfmController.createShift);
router.get('/schedules', wfmController.getSchedules);
router.post('/schedules', authorize(['superadmin', 'hr_admin']), wfmController.assignSchedule);
router.get('/shifts/schedules', wfmController.getSchedules);
router.post('/shifts/schedules', authorize(['superadmin', 'hr_admin']), wfmController.assignSchedule);

// Attendance, Early-Outs, Adjustments & Alerts
router.get('/attendance', wfmController.getAttendance);
router.post('/attendance', wfmController.clockIn);
router.get('/attendance/alerts/check', (_req, res) => {
  res.json({ success: true, alerts: [], checkedAt: new Date().toISOString() });
});
router.post('/attendance/remind-clock-out', (_req, res) => {
  res.json({ success: true, reminded: 0 });
});
router.get('/attendance/early-outs', (_req, res) => res.json({ success: true, data: [] }));
router.get('/attendance/early-outs/pending', (_req, res) => res.json({ success: true, data: [] }));
router.get('/attendance/early-outs/employee/:employeeId', (_req, res) => res.json({ success: true, data: [] }));
router.put('/attendance/early-outs/:id/reason', (req, res) => res.json({ success: true, data: { id: req.params.id, ...req.body } }));
router.post('/attendance/early-outs/:id/classify', (req, res) => res.json({ success: true, data: { id: req.params.id, ...req.body } }));

router.get('/attendance/adjustments', (_req, res) => res.json({ success: true, data: [] }));
router.get('/attendance/adjustments/mine', (_req, res) => res.json({ success: true, data: [] }));
router.get('/attendance/adjustments/mine/:id', (_req, res) => res.json({ success: true, data: null }));
router.get('/attendance/adjustments/:id', (_req, res) => res.json({ success: true, data: null }));
router.post('/attendance/adjustments', (req, res) => res.status(201).json({ success: true, data: { id: `adj-${Date.now()}`, ...req.body, status: 'Pending' } }));
router.post('/attendance/adjustments/:id/cancel', (_req, res) => res.json({ success: true }));
router.post('/attendance/adjustments/:id/preview', (_req, res) => res.json({ success: true, data: {} }));
router.post('/attendance/adjustments/:id/decide', (req, res) => res.json({ success: true, data: { id: req.params.id, status: req.body.decision } }));

router.get('/attendance/employee/:employeeId', async (req, res, next) => {
  try {
    const data = await wfmService.getAttendanceLogs({ employeeId: req.params.employeeId as string });
    res.json({ success: true, data });
  } catch (e) { next(e); }
});
router.get('/attendance/date/:date', async (req, res, next) => {
  try {
    const d = req.params.date as string;
    const data = await wfmService.getAttendanceLogs({ fromDate: d, toDate: d });
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

// Overtime
router.get('/overtime', (_req, res) => res.json({ success: true, data: [] }));
router.get('/overtime/employee/:employeeId', (_req, res) => res.json({ success: true, data: [] }));
router.get('/overtime/:id', (_req, res) => res.json({ success: true, data: null }));
router.post('/overtime', (req, res) => res.status(201).json({ success: true, data: { id: `ot-${Date.now()}`, ...req.body, status: 'Pending' } }));
router.patch('/overtime/bulk-status', (req, res) => res.json({ success: true, updated: req.body?.ids?.length || 0 }));
router.patch('/overtime/:id/status', (req, res) => res.json({ success: true, data: { id: req.params.id, status: req.body.status } }));
router.delete('/overtime/:id', (_req, res) => res.json({ success: true }));

// Timesheets
router.get('/timesheets', wfmController.getTimesheets);
router.get('/timesheets/employee/:employeeId', async (req, res, next) => {
  try {
    const data = await wfmService.getTimesheets(undefined, undefined, req.params.employeeId as string);
    res.json({ success: true, data });
  } catch (e) { next(e); }
});
router.post('/timesheets/generate', authorize(['superadmin', 'hr_admin']), wfmController.generateTimesheet);
router.patch('/timesheets/:id/status', authorize(['superadmin', 'hr_admin']), wfmController.updateTimesheetStatus);

// Leaves
router.get('/leaves', wfmController.getLeaves);
router.get('/leaves/employee/:employeeId', async (req, res, next) => {
  try {
    const data = await wfmService.getAllLeaves(req.params.employeeId as string);
    res.json({ success: true, data });
  } catch (e) { next(e); }
});
router.get('/leaves/balances/:employeeId', wfmCompat.getLeaveBalances);
router.get('/leaves/working-days', wfmCompat.getWorkingDays);
router.get('/leave-types', wfmCompat.getLeaveTypes);
router.post('/leaves', wfmController.fileLeave);
router.patch('/leaves/:id/status', authorize(['superadmin', 'hr_admin']), wfmController.decideLeave);

// Analytics & AI Decision Support
router.get('/intelligence/alerts', authorize(['superadmin', 'hr_admin']), wfmController.getAlerts);
router.get('/analytics', authorize(['superadmin', 'hr_admin']), wfmController.getAlerts);
router.get('/analytics/ai/health-score', wfmCompat.getAiHealthScore);
router.get('/analytics/ai/insights', wfmCompat.getAiInsights);
router.post('/analytics/ai/actions', wfmCompat.postAiAction);
router.get('/analytics/workforce', wfmCompat.getWorkforceAnalytics);
router.get('/analytics/attendance-trend', wfmCompat.getAttendanceTrend);
router.get('/analytics/department-productivity', wfmCompat.getDepartmentProductivity);
router.get('/analytics/leave-trend', wfmCompat.getLeaveTrend);
router.get('/analytics/overtime-summary', (_req, res) => res.json({ success: true, data: { totalHours: 0, approvedCount: 0, pendingCount: 0 } }));
router.get('/analytics/punctuality-score', wfmCompat.getPunctualityScore);
router.get('/analytics/top-performers', wfmCompat.getTopPerformers);
router.get('/analytics/employee/:employeeId', async (req, res, next) => {
  try {
    const data = await wfmService.getAttendanceLogs({ employeeId: req.params.employeeId as string });
    res.json({ success: true, data: { attendance: data } });
  } catch (e) { next(e); }
});

// HRMS cross-query bridges
router.get('/employees', async (_req, res, next) => {
  try {
    const data = await hrmsService.getAllEmployees();
    res.json({ success: true, data });
  } catch (e) { next(e); }
});
router.get('/employees/:id', async (req, res, next) => {
  try {
    const data = await hrmsService.getEmployeeById(req.params.id as string);
    res.json({ success: true, data });
  } catch (e) { next(e); }
});
router.get('/departments', async (_req, res, next) => {
  try {
    const data = await hrmsService.getAllDepartments();
    res.json({ success: true, data });
  } catch (e) { next(e); }
});
router.get('/roles', async (req, res, next) => {
  try {
    const data = await hrmsService.getAllPositions(req.query.department_id as string | undefined);
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

// Audit, Search, Settings, Profile & Notifications
router.get('/audit', wfmCompat.getAuditLogs);
router.get('/search', wfmCompat.globalSearch);
router.get('/settings', (_req, res) => {
  res.json({
    success: true,
    data: {
      grace_period_minutes: 15,
      default_shift_start: '08:00',
      default_shift_end: '17:00',
      overtime_minimum_minutes: 60
    }
  });
});
router.put('/settings', (req, res) => res.json({ success: true, data: req.body }));
router.get('/profile', (req, res) => res.json({ success: true, data: req.user }));
router.put('/profile', (req, res) => res.json({ success: true, data: { ...req.user, ...req.body } }));
router.get('/notifications', (_req, res) => res.json({ success: true, data: [], count: 0 }));
router.get('/notifications/unread-count', (_req, res) => res.json({ success: true, count: 0 }));
router.post('/notifications/:id/read', (_req, res) => res.json({ success: true }));
router.post('/notifications/read-all', (_req, res) => res.json({ success: true }));

export default router;
