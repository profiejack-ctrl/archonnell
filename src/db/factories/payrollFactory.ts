// ==============================================================================
// ARCHON NELL INCORPORATED - PAYROLL & BENEFITS FACTORY & SEEDER
// Populates payroll.payroll_runs, payslips, payslip_lines, claims, benefits_hmo
// Implements Philippine Statutory Deductions (SSS, PhilHealth, Pag-IBIG, TRAIN Tax)
// ==============================================================================

import { query } from '../connection.js';
import { EmployeeRecord } from './hrmsFactory.js';
import { UserRecord } from './userFactory.js';
import { HMO_PROVIDERS } from './dataSets.js';

export async function seedPayroll(
  employees: EmployeeRecord[],
  usersByEmail: Map<string, UserRecord>
) {
  console.log('   ↳ [PayrollFactory] Seeding semi-monthly corporate payroll runs...');

  const payrollRunsData = [
    {
      periodFrom: '2026-10-01',
      periodTo: '2026-10-15',
      payDate: '2026-10-15',
      status: 'paid',
      preparedBy: 'Arlene Reyes-Castillo (Payroll Lead)',
      decidedBy: 'Arch. Vincent De Leon (Managing Director)',
      decidedAt: '2026-10-14T16:00:00.000Z',
      fundedAt: '2026-10-15T08:30:00.000Z',
      receiptUrl: 'https://cdn.archonnell.com/receipts/bank_batch_oct15_2026.pdf',
      paymentStatus: 'Paid'
    },
    {
      periodFrom: '2026-10-16',
      periodTo: '2026-10-31',
      payDate: '2026-10-31',
      status: 'paid',
      preparedBy: 'Arlene Reyes-Castillo (Payroll Lead)',
      decidedBy: 'Arch. Vincent De Leon (Managing Director)',
      decidedAt: '2026-10-30T17:15:00.000Z',
      fundedAt: '2026-10-31T09:00:00.000Z',
      receiptUrl: 'https://cdn.archonnell.com/receipts/bank_batch_oct31_2026.pdf',
      paymentStatus: 'Paid'
    },
    {
      periodFrom: '2026-11-01',
      periodTo: '2026-11-15',
      payDate: '2026-11-15',
      status: 'approved',
      preparedBy: 'Arlene Reyes-Castillo (Payroll Lead)',
      decidedBy: 'Arch. Vincent De Leon (Managing Director)',
      decidedAt: '2026-11-14T11:00:00.000Z',
      fundedAt: null,
      receiptUrl: null,
      paymentStatus: 'Pending'
    }
  ];

  let totalPayslipsCount = 0;

  for (const runData of payrollRunsData) {
    const runRes = await query(
      `INSERT INTO payroll.payroll_runs (
         run_type, period_from, period_to, pay_date, status,
         prepared_by, submitted_at, decided_by, decided_at, decision_comment,
         funded_at, funding_receipt_url
       ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        'regular',
        runData.periodFrom,
        runData.periodTo,
        runData.payDate,
        runData.status,
        runData.preparedBy,
        runData.decidedBy,
        runData.decidedAt,
        'Approved in compliance with Philippine Labor Code statutory rates.',
        runData.fundedAt,
        runData.receiptUrl
      ]
    );

    const runId = runRes.rows[0].id;
    let grandGross = 0;
    let grandDeductions = 0;
    let grandNet = 0;

    for (const emp of employees) {
      const monthlySalary = emp.baseSalary || 25000;
      const semiMonthlyBasic = Number((monthlySalary / 2).toFixed(2));
      const hourlyRate = monthlySalary / 22 / 8;
      const minuteRate = hourlyRate / 60;

      // Query employee timesheet for this period
      const tsRes = await query(
        `SELECT total_ot_hours, total_late_minutes, total_undertime_minutes
         FROM wfm.timesheets
         WHERE employee_id = $1 AND period_from = $2 AND period_to = $3`,
        [emp.id, runData.periodFrom, runData.periodTo]
      );

      const otHours = tsRes.rows.length > 0 ? Number(tsRes.rows[0].total_ot_hours) || 0 : 0;
      const lateMinutes = tsRes.rows.length > 0 ? Number(tsRes.rows[0].total_late_minutes) || 0 : 0;
      const undertimeMinutes = tsRes.rows.length > 0 ? Number(tsRes.rows[0].total_undertime_minutes) || 0 : 0;

      // Overtime Pay (125% regular rate)
      const otPay = Number((otHours * hourlyRate * 1.25).toFixed(2));
      const grossPay = Number((semiMonthlyBasic + otPay).toFixed(2));

      // Philippine Statutory Deductions
      const tardinessDeduction = Number(((lateMinutes + undertimeMinutes) * minuteRate).toFixed(2));
      // SSS Employee Share: approx 4.5% of monthly salary capped at ₱1,350 semi-monthly
      const sssDeduction = Number((Math.min(1350, monthlySalary * 0.045) / 2).toFixed(2));
      // PhilHealth: 5% total (2.5% employee share) semi-monthly
      const philhealthDeduction = Number(((monthlySalary * 0.05) / 4).toFixed(2));
      // Pag-IBIG: Standard ₱100.00 semi-monthly
      const pagibigDeduction = 100.00;

      // TRAIN Law Tax Semi-Monthly Bracket Calculation
      const taxableIncome = Math.max(0, grossPay - sssDeduction - philhealthDeduction - pagibigDeduction);
      let taxDeduction = 0;
      if (taxableIncome > 10417) {
        taxDeduction = Number(((taxableIncome - 10417) * 0.15).toFixed(2));
      }

      const totalDeductions = Number(
        (tardinessDeduction + sssDeduction + philhealthDeduction + pagibigDeduction + taxDeduction).toFixed(2)
      );
      const netPay = Number((grossPay - totalDeductions).toFixed(2));

      grandGross += grossPay;
      grandDeductions += totalDeductions;
      grandNet += netPay;

      // Insert Payslip
      const psRes = await query(
        `INSERT INTO payroll.payslips (
           payroll_run_id, employee_id, employee_no, basic_salary, gross_pay,
           total_deductions, net_pay, payment_status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [runId, emp.id, emp.employeeNo, semiMonthlyBasic, grossPay, totalDeductions, netPay, runData.paymentStatus]
      );
      const payslipId = psRes.rows[0].id;
      totalPayslipsCount++;

      // Insert Detailed Payslip Lines
      const lines = [
        { type: 'earning', name: 'Basic Pay (Semi-Monthly)', amount: semiMonthlyBasic },
        ...(otPay > 0 ? [{ type: 'earning', name: `Overtime Pay (${otHours} hrs @ 125%)`, amount: otPay }] : []),
        ...(tardinessDeduction > 0
          ? [{ type: 'deduction', name: `Tardiness / Undertime (${lateMinutes + undertimeMinutes} mins)`, amount: tardinessDeduction }]
          : []),
        { type: 'deduction', name: 'SSS Employee Contribution', amount: sssDeduction },
        { type: 'deduction', name: 'PhilHealth Contribution', amount: philhealthDeduction },
        { type: 'deduction', name: 'Pag-IBIG Fund Contribution', amount: pagibigDeduction },
        ...(taxDeduction > 0 ? [{ type: 'tax', name: 'Withholding Tax (TRAIN Law)', amount: taxDeduction }] : [])
      ];

      for (const line of lines) {
        await query(
          `INSERT INTO payroll.payslip_lines (payslip_id, line_type, line_name, amount)
           VALUES ($1, $2, $3, $4)`,
          [payslipId, line.type, line.name, line.amount]
        );
      }
    }

    // Update payroll run grand totals
    await query(
      `UPDATE payroll.payroll_runs
       SET total_gross = $1, total_deductions = $2, total_net = $3
       WHERE id = $4`,
      [grandGross, grandDeductions, grandNet, runId]
    );
  }

  console.log('   ↳ [PayrollFactory] Seeding employee reimbursement claims...');
  const adminUser = usersByEmail.get('admin@archonnell.com');
  const claimsData = [
    {
      empIdx: 3, // Driver
      type: 'Travel',
      amount: 1450.00,
      desc: 'SLEX and CAVITEX tollway RFID card reload for bulk chemical delivery trip to BGC.',
      status: 'Reimbursed'
    },
    {
      empIdx: 8, // Sales Lead
      type: 'Meal',
      amount: 2850.00,
      desc: 'B2B Client Luncheon with EEI Corporation senior project estimators at Makati Diamond Hotel.',
      status: 'Reimbursed'
    },
    {
      empIdx: 7, // QA Lead
      type: 'Equipment',
      amount: 3200.00,
      desc: 'Laboratory digital thermometer calibration and replacement slump cone base plates.',
      status: 'Approved'
    },
    {
      empIdx: 11, // Warehouse
      type: 'Equipment',
      amount: 2400.00,
      desc: 'Heavy-duty chemical handling nitrile gloves and pallet jack hydraulic fluid top-up.',
      status: 'Reimbursed'
    },
    {
      empIdx: 14, // Driver 3
      type: 'Travel',
      amount: 980.00,
      desc: 'Toll fee reimbursement for emergency rush chemical delivery to San Fernando, Pampanga.',
      status: 'Pending'
    },
    {
      empIdx: 6, // Chemist
      type: 'Medical',
      amount: 1500.00,
      desc: 'Annual specialized respiratory spirometry check-up for chemical handling personnel.',
      status: 'Approved'
    }
  ];

  for (const c of claimsData) {
    const emp = employees[c.empIdx] || employees[0];
    await query(
      `INSERT INTO payroll.claims (
         employee_id, claim_type, amount, description, status, decided_by, decided_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        emp.id,
        c.type,
        c.amount,
        c.desc,
        c.status,
        c.status !== 'Pending' ? adminUser?.id || null : null,
        c.status !== 'Pending' ? new Date().toISOString() : null
      ]
    );
  }

  console.log('   ↳ [PayrollFactory] Seeding HMO health benefits coverage...');
  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];
    const provider = HMO_PROVIDERS[i % HMO_PROVIDERS.length];
    const policyNo = `AN-HMO-2026-${String(1001 + i).padStart(5, '0')}`;

    await query(
      `INSERT INTO payroll.benefits_hmo (
         employee_id, provider_name, policy_number, coverage_amount, status
       ) VALUES ($1, $2, $3, $4, 'Active')
       ON CONFLICT DO NOTHING`,
      [emp.id, provider.name, policyNo, provider.coverage]
    );
  }

  console.log(`   ✅ [PayrollFactory] Seeded ${payrollRunsData.length} payroll runs, ${totalPayslipsCount} itemized payslips, and ${claimsData.length} claims.`);
}
