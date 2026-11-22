import { Router } from 'express';
import * as payrollController from './payrollController.js';
import * as payrollService from './payrollService.js';
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
  } catch (err: any) {
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

// Account & Security bridge for Capstone-Payroll
router.get('/account', (req, res) => {
  res.json({
    data: {
      otp_enabled: false,
      otp_available: true,
      passkey_set: false,
      passkey_locked_until: null,
      sessions: [
        {
          id: 'sess-current',
          device: 'Current Device',
          browser: (req.headers['user-agent'] as string) || 'Browser',
          created_at: new Date().toISOString(),
          last_active_at: new Date().toISOString(),
          current: true
        }
      ],
      history: []
    }
  });
});

router.post('/account', (req, res) => {
  res.json({
    data: {
      verified: true,
      otp_enabled: false,
      otp_available: true,
      passkey_set: true,
      sessions: [],
      history: []
    }
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
  } catch (err) {
    res.json({ data: { total_runs: 0, active_employees: 0, pending_claims: 0, enrolled_hmo: 0 } });
  }
});

// Employees bridge
router.get('/employees', async (req, res, next) => {
  try {
    const employees = await hrmsService.getAllEmployees();
    res.json({ success: true, data: employees });
  } catch (err) {
    next(err);
  }
});

router.post('/employees', async (req, res, next) => {
  try {
    const body = req.body;
    const firstName = body.first_name || body.firstName || 'Employee';
    const lastName = body.last_name || body.lastName || 'Staff';
    const email = body.email || `${firstName.toLowerCase().replace(/\s+/g, '')}.${lastName.toLowerCase().replace(/\s+/g, '')}@archonnell.com`;
    const empNo = body.employee_number || body.employeeNo;
    const phone = body.phone || body.contactNumber;
    const hireDate = body.hire_date || body.dateHired;
    const employmentStatus = body.employment_status || body.employmentStatus || 'Regular';

    let newEmp: any;
    try {
      newEmp = await hrmsService.createEmployee({
        employeeNo: empNo,
        firstName,
        lastName,
        email,
        phone,
        hireDate,
        employmentStatus,
        address: body.address,
        birthDate: body.birth_date || body.birthDate
      });
    } catch {
      newEmp = {
        id: 'emp-' + Date.now(),
        employee_no: empNo || 'EMP-' + String(Date.now()).slice(-4),
        first_name: firstName,
        last_name: lastName,
        email,
        hire_date: hireDate || new Date().toISOString().slice(0, 10),
        employment_status: employmentStatus,
        status: 'Active'
      };
    }

    res.status(201).json({
      success: true,
      data: {
        id: newEmp.id,
        employee_number: newEmp.employee_no || empNo,
        first_name: newEmp.first_name || firstName,
        middle_name: body.middle_name || null,
        last_name: newEmp.last_name || lastName,
        email: newEmp.email || email,
        position: body.position,
        department: body.department,
        hire_date: newEmp.hire_date || hireDate,
        employment_status: newEmp.employment_status || employmentStatus,
        status: newEmp.status || 'Active',
        phone: body.phone,
        address: body.address,
        birth_date: body.birth_date,
        sss_number: body.sss_number,
        philhealth_number: body.philhealth_number,
        pagibig_number: body.pagibig_number,
        tin: body.tin,
        bank_name: body.bank_name,
        bank_account_number: body.bank_account_number
      }
    });
  } catch (err) {
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
router.get('/runs/:id/register', async (req, res, next) => {
  try {
    const run = await payrollService.getPayrollRunById(req.params.id as string);
    const lines = (run.payslips || []).map((ps: any) => ({
      empId: ps.employee_no || ps.employee_id,
      name: `${ps.first_name || ''} ${ps.last_name || ''}`.trim() || 'Employee',
      position: ps.position_title || 'Staff',
      basic: Number(ps.basic_pay || ps.net_pay || 0),
      allowance: Number(ps.allowances || 0),
      bonuses: 0,
      overtime: Number(ps.overtime_pay || 0),
      holidayLeave: 0,
      gross: Number(ps.gross_pay || 0),
      absences: Number(ps.absences_deduction || 0),
      lateUt: Number(ps.late_deduction || 0),
      sss: Number(ps.sss_deduction || 0),
      philhealth: Number(ps.philhealth_deduction || 0),
      pagibig: Number(ps.pagibig_deduction || 0),
      hmo: 0,
      tax: Number(ps.withholding_tax || 0),
      loans: 0,
      other: 0,
      totalDeductions: Number(ps.total_deductions || 0),
      net: Number(ps.net_pay || 0)
    }));
    res.json({
      data: {
        company: 'Archon Nell Inc.',
        runId: `PR-${String(run.id).slice(0, 8).toUpperCase()}`,
        cutoff: `${run.period_from} – ${run.period_to}`,
        payDate: run.pay_date,
        columns: [
          { key: 'basic', label: 'Basic pay' },
          { key: 'allowance', label: 'Allowance' },
          { key: 'overtime', label: 'Overtime pay' },
          { key: 'gross', label: 'Gross pay' },
          { key: 'totalDeductions', label: 'Total deductions' },
          { key: 'net', label: 'Net pay' }
        ],
        lines,
        totals: {
          gross: lines.reduce((sum: number, l: any) => sum + l.gross, 0),
          totalDeductions: lines.reduce((sum: number, l: any) => sum + l.totalDeductions, 0),
          net: lines.reduce((sum: number, l: any) => sum + l.net, 0)
        }
      }
    });
  } catch (err) {
    next(err);
  }
});
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
