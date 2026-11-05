import { Router } from 'express';
import * as wfmController from './wfmController.js';
import * as hrmsService from '../hrms/hrmsService.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';

const router = Router();

// Kiosk / Quick Clock In/Out (open or authenticated)
router.post('/attendance/clock-in', wfmController.clockIn);
router.post('/attendance/clock-out', wfmController.clockOut);

// All subsequent routes require authentication
router.use(authenticate);

// Shifts & Schedules
router.get('/shifts', wfmController.getShifts);
router.post('/shifts', authorize(['superadmin', 'hr_admin']), wfmController.createShift);

router.get('/schedules', wfmController.getSchedules);
router.post('/schedules', authorize(['superadmin', 'hr_admin']), wfmController.assignSchedule);
router.get('/shifts/schedules', wfmController.getSchedules);
router.post('/shifts/schedules', authorize(['superadmin', 'hr_admin']), wfmController.assignSchedule);

// Attendance Queries
router.get('/attendance', wfmController.getAttendance);

// Timesheets
router.get('/timesheets', wfmController.getTimesheets);
router.post('/timesheets/generate', authorize(['superadmin', 'hr_admin']), wfmController.generateTimesheet);
router.patch('/timesheets/:id/status', authorize(['superadmin', 'hr_admin']), wfmController.updateTimesheetStatus);

// Leaves
router.get('/leaves', wfmController.getLeaves);
router.post('/leaves', wfmController.fileLeave);
router.patch('/leaves/:id/status', authorize(['superadmin', 'hr_admin']), wfmController.decideLeave);

// AI Decision Support & Alerts
router.get('/intelligence/alerts', authorize(['superadmin', 'hr_admin']), wfmController.getAlerts);
router.get('/analytics', authorize(['superadmin', 'hr_admin']), wfmController.getAlerts);

// HRMS cross-query bridges (allows WFM frontend to fetch active employees & departments without separate config)
router.get('/employees', async (req, res, next) => {
  try {
    const data = await hrmsService.getAllEmployees();
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});
router.get('/departments', async (req, res, next) => {
  try {
    const data = await hrmsService.getAllDepartments();
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

// Settings & Notifications
router.get('/settings', (req, res) => {
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
router.get('/notifications', (req, res) => {
  res.json({ success: true, data: [], count: 0 });
});
router.get('/notifications/unread-count', (req, res) => {
  res.json({ success: true, count: 0 });
});

export default router;
