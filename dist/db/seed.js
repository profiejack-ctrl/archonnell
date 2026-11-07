// ==============================================================================
// ARCHON NELL INCORPORATED - CENTRALIZED DATABASE SEED SCRIPT
// Multi-Schema Production-Grade Seeder for Philippine Construction Chemical Enterprise
// ==============================================================================
import { runFullEnterpriseSeed } from './factories/index.js';
import bcrypt from 'bcryptjs';
import { query } from './connection.js';
async function runBasicSeed() {
    console.log('--- Starting Minimal / Basic Database Seeder ---');
    const defaultPassword = await bcrypt.hash('Admin123!', 10);
    // 1. Seed Core Users
    const users = [
        { email: 'admin@archonnell.com', name: 'System Superadmin', role: 'superadmin' },
        { email: 'hr@archonnell.com', name: 'HR Director', role: 'hr_admin' },
        { email: 'payroll@archonnell.com', name: 'Payroll Lead', role: 'payroll_officer' },
        { email: 'fleet@archonnell.com', name: 'Fleet Coordinator', role: 'fleet_manager' },
        { email: 'driver1@archonnell.com', name: 'Reynaldo Driver', role: 'driver' },
        { email: 'customer@gmail.com', name: 'Juan Customer', role: 'customer' }
    ];
    for (const u of users) {
        await query(`INSERT INTO auth_core.users (email, password_hash, full_name, global_role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE 
       SET full_name = EXCLUDED.full_name, global_role = EXCLUDED.global_role`, [u.email, defaultPassword, u.name, u.role]);
    }
    console.log('✅ Seeded 6 basic users');
}
async function main() {
    const args = process.argv.slice(2);
    const isBasic = args.includes('--basic');
    if (isBasic) {
        await runBasicSeed();
    }
    else {
        // Default to full, realistic production-grade data
        await runFullEnterpriseSeed();
    }
}
main()
    .then(() => {
    console.log('Done!');
    process.exit(0);
})
    .catch((err) => {
    console.error('Seed execution failed:', err);
    process.exit(1);
});
