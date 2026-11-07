// ==============================================================================
// ARCHON NELL INCORPORATED - FACTORY ORCHESTRATOR
// Coordinates multi-schema relational seeding for realistic enterprise dataset
// ==============================================================================
import { query } from '../connection.js';
import { seedUsers } from './userFactory.js';
import { seedHrms } from './hrmsFactory.js';
import { seedWfm } from './wfmFactory.js';
import { seedPayroll } from './payrollFactory.js';
import { seedShop } from './shopFactory.js';
import { seedFleet } from './fleetFactory.js';
export * from './dataSets.js';
export * from './userFactory.js';
export * from './hrmsFactory.js';
export * from './wfmFactory.js';
export * from './payrollFactory.js';
export * from './shopFactory.js';
export * from './fleetFactory.js';
export async function runFullEnterpriseSeed() {
    const startTime = Date.now();
    console.log('\n==============================================================================');
    console.log('🏗️  ARCHON NELL ENTERPRISE - REALISTIC MULTI-SCHEMA DATABASE SEEDER');
    console.log('   Domain: Philippine Construction Chemicals, Flooring & Infrastructure');
    console.log('==============================================================================\n');
    try {
        // Phase 1: Authentication Core & Universal SSO Users
        console.log('▶ [1/6] Seeding Universal SSO Credentials & Activity Audit Trail...');
        const { usersByEmail, customerUsers } = await seedUsers();
        // Phase 2: Human Resource Management (HRMS)
        console.log('\n▶ [2/6] Seeding HRMS Organizational Hierarchy, Profiles & Recruitment...');
        const { employees } = await seedHrms(usersByEmail);
        // Phase 3: Workforce Management (WFM)
        console.log('\n▶ [3/6] Seeding WFM Operations, Shifts & 30-Day Attendance Logs...');
        await seedWfm(employees, usersByEmail);
        // Phase 4: Payroll & Employee Benefits
        console.log('\n▶ [4/6] Seeding Payroll Computation Engine & Philippine Statutory Lines...');
        await seedPayroll(employees, usersByEmail);
        // Phase 5: Shop & E-Commerce Storefront
        console.log('\n▶ [5/6] Seeding E-Commerce Catalog, Orders & Verified Reviews...');
        const { orders: shopOrders } = await seedShop(customerUsers);
        // Phase 6: Fleet & Commercial Logistics
        console.log('\n▶ [6/6] Seeding Commercial Fleet Vehicles, Dispatches & Live GPS Logs...');
        await seedFleet(employees, shopOrders);
        // Summary Verification: Audit row counts across all tables
        console.log('\n==============================================================================');
        console.log('📊 DATABASE RECORD AUDIT SUMMARY');
        console.log('==============================================================================');
        const tableQueries = [
            { schema: 'auth_core', table: 'users' },
            { schema: 'auth_core', table: 'audit_logs' },
            { schema: 'hrms', table: 'departments' },
            { schema: 'hrms', table: 'positions' },
            { schema: 'hrms', table: 'employees' },
            { schema: 'hrms', table: 'job_postings' },
            { schema: 'hrms', table: 'applicants' },
            { schema: 'hrms', table: 'onboarding_tasks' },
            { schema: 'wfm', table: 'shifts' },
            { schema: 'wfm', table: 'schedules' },
            { schema: 'wfm', table: 'attendance_logs' },
            { schema: 'wfm', table: 'timesheets' },
            { schema: 'wfm', table: 'leave_requests' },
            { schema: 'payroll', table: 'payroll_runs' },
            { schema: 'payroll', table: 'payslips' },
            { schema: 'payroll', table: 'payslip_lines' },
            { schema: 'payroll', table: 'claims' },
            { schema: 'payroll', table: 'benefits_hmo' },
            { schema: 'shop', table: 'categories' },
            { schema: 'shop', table: 'products' },
            { schema: 'shop', table: 'vouchers' },
            { schema: 'shop', table: 'orders' },
            { schema: 'shop', table: 'order_items' },
            { schema: 'shop', table: 'reviews' },
            { schema: 'fleet', table: 'vehicles' },
            { schema: 'fleet', table: 'drivers' },
            { schema: 'fleet', table: 'dispatches' },
            { schema: 'fleet', table: 'trip_records' },
            { schema: 'fleet', table: 'location_logs' },
            { schema: 'fleet', table: 'fuel_logs' }
        ];
        for (const t of tableQueries) {
            try {
                const countRes = await query(`SELECT COUNT(*)::int AS count FROM ${t.schema}.${t.table}`);
                const count = countRes.rows[0].count;
                console.log(`   ${t.schema.padEnd(10)} | ${t.table.padEnd(20)} : ${String(count).padStart(5)} rows`);
            }
            catch (err) {
                console.warn(`   ${t.schema.padEnd(10)} | ${t.table.padEnd(20)} : [Query Failed: ${err.message}]`);
            }
        }
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log('==============================================================================');
        console.log(`🎉 FULL ENTERPRISE SEEDING COMPLETED IN ${duration}s!`);
        console.log('==============================================================================\n');
    }
    catch (error) {
        console.error('\n❌ FATAL SEEDER ERROR:', error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        throw error;
    }
}
