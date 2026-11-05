import { Router } from 'express';
import * as payrollController from './payrollController.js';
import * as authService from '../auth/authService.js';
import * as hrmsService from '../hrms/hrmsService.js';
import { query } from '../../db/connection.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
const router = Router();
// Finance Integration endpoint (can be called with Bearer token or API key)
router.get('/integrations/finance/payroll-runs', payrollController.getFinanceRuns);
// Pre-auth / SSO Bridge for Capstone-Payroll
router.post('/auth-login', async (req, res) => {
    try {
        const email = req.body.email || req.body.username;
        const password = req.body.password;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }
        const result = await authService.loginUser(email, password);
        res.json({
            success: true,
            data: {
                token: result.token,
                user: {
                    id: result.user.id,
                    employee_id: result.user.id,
                    name: result.user.full_name,
                    email: result.user.email,
                    role: result.user.global_role === 'superadmin' ? 'Admin' : 'HR Staff'
                }
            }
        });
    }
    catch (err) {
        res.status(err.statusCode || 401).json({ success: false, message: err.message || 'Invalid credentials' });
    }
});
// App Data Sync endpoints (Settings and metadata)
router.get('/app-data', (req, res) => {
    res.json({ data: [] });
});
router.post('/app-data', (req, res) => {
    res.json({ success: true, message: 'Saved' });
});
// Authenticated Endpoints
router.use(authenticate);
// Current User Profile for Capstone-Payroll
router.get('/current-user', (req, res) => {
    const user = req.user;
    res.json({
        data: [
            {
                id: user?.id || '1',
                name: user?.full_name || 'System Superadmin',
                display_name: user?.full_name || 'System Superadmin',
                email: user?.email || 'admin@archonnell.com',
                employee_id: 'EMP-0001',
                role: user?.global_role === 'superadmin' ? 'admin' : (user?.global_role || 'admin')
            }
        ]
    });
});
// Dashboard Summary endpoint for Capstone-Payroll
router.get('/dashboard', async (req, res) => {
    try {
        const runsRes = await query('SELECT COUNT(*)::int AS count FROM payroll.payroll_runs');
        const empRes = await query('SELECT COUNT(*)::int AS count FROM hrms.employees');
        res.json({
            data: {
                total_runs: runsRes.rows[0]?.count || 0,
                active_employees: empRes.rows[0]?.count || 0,
                pending_claims: 0,
                enrolled_hmo: 0
            }
        });
    }
    catch (err) {
        res.json({ data: { total_runs: 0, active_employees: 0, pending_claims: 0, enrolled_hmo: 0 } });
    }
});
// Employees bridge
router.get('/employees', async (req, res, next) => {
    try {
        const employees = await hrmsService.getAllEmployees();
        res.json({ success: true, data: employees });
    }
    catch (err) {
        next(err);
    }
});
// Compensation & Loans bridge
router.get('/compensation', (req, res) => {
    res.json({ data: [] });
});
router.get('/loans', (req, res) => {
    res.json({ data: [] });
});
router.get('/audit-logs', (req, res) => {
    res.json({ data: [] });
});
// Payroll Runs & Calculation
router.get('/runs', payrollController.getRuns);
router.get('/runs/:id', payrollController.getRun);
router.post('/runs/compute', authorize(['superadmin', 'payroll_officer', 'hr_admin']), payrollController.computeRun);
router.patch('/runs/:id/status', authorize(['superadmin', 'payroll_officer']), payrollController.updateRunStatus);
// Payslips & Employee Self-Service (ESS)
router.get('/payslips/:id', payrollController.getPayslip);
router.get('/payslips/employee/:employeeId', payrollController.getEmployeePayslips);
router.patch('/payslips/:id/status', authorize(['superadmin', 'payroll_officer']), payrollController.updatePayslipStatus);
// Claims & Reimbursements
router.get('/claims', payrollController.getClaims);
router.post('/claims', payrollController.fileClaim);
router.patch('/claims/:id/decide', authorize(['superadmin', 'payroll_officer', 'hr_admin']), payrollController.decideClaim);
// HMO Benefits
router.get('/benefits/hmo', payrollController.getHmo);
router.post('/benefits/hmo', authorize(['superadmin', 'payroll_officer', 'hr_admin']), payrollController.enrollHmo);
export default router;
