// ==============================================================================
// ARCHON NELL INCORPORATED - DATABASE RESET SCRIPT
// Drops all 6 schemas with CASCADE, re-applies schema.sql, and re-seeds data
// ==============================================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './connection.js';
import { runFullEnterpriseSeed } from './factories/index.js';
import bcrypt from 'bcryptjs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
async function runBasicSeed() {
    console.log('--- Seeding 6 Universal Baseline Users ---');
    const defaultPassword = await bcrypt.hash('Admin123!', 10);
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
    console.log('✅ Baseline users created.');
}
async function runReset() {
    const startTime = Date.now();
    const args = process.argv.slice(2);
    const cleanOnly = args.includes('--clean-only') || args.includes('--no-seed');
    const basicSeed = args.includes('--basic');
    console.log('\n==============================================================================');
    console.log('🔄  ARCHON NELL ENTERPRISE - DATABASE RESET & FRESH SEEDER');
    console.log('==============================================================================\n');
    try {
        // 1. DROP ALL 6 SCHEMAS CASCADE
        console.log('🗑️  [1/3] Dropping existing enterprise schemas (CASCADE)...');
        await query(`
      DROP SCHEMA IF EXISTS shop CASCADE;
      DROP SCHEMA IF EXISTS fleet CASCADE;
      DROP SCHEMA IF EXISTS payroll CASCADE;
      DROP SCHEMA IF EXISTS wfm CASCADE;
      DROP SCHEMA IF EXISTS hrms CASCADE;
      DROP SCHEMA IF EXISTS auth_core CASCADE;
    `);
        console.log('   ✅ Successfully dropped all legacy schemas and data.\n');
        // 2. RE-APPLY SCHEMA.SQL
        console.log('🏗️  [2/3] Re-applying schema.sql (Fresh tables, types & indexes)...');
        let sqlPath = path.join(__dirname, 'schema.sql');
        if (!fs.existsSync(sqlPath)) {
            sqlPath = path.resolve(__dirname, '../../src/db/schema.sql');
        }
        const schemaSql = fs.readFileSync(sqlPath, 'utf-8');
        await query(schemaSql);
        console.log('   ✅ Re-created all 6 schemas and 32 tables successfully.\n');
        // 3. RE-SEED DATA
        if (cleanOnly) {
            console.log('ℹ️  Skipping seed step (--clean-only specified). Database is clean and empty.');
        }
        else if (basicSeed) {
            console.log('🌱 [3/3] Running baseline seeder (--basic)...');
            await runBasicSeed();
        }
        else {
            console.log('🌱 [3/3] Running full enterprise factory seeder...');
            await runFullEnterpriseSeed();
        }
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log('==============================================================================');
        console.log(`✨ DATABASE RESET & SEED COMPLETED IN ${duration}s!`);
        console.log('==============================================================================\n');
    }
    catch (error) {
        console.error('\n❌ DATABASE RESET FAILED:', error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}
runReset()
    .then(() => process.exit(0))
    .catch((err) => {
    console.error('Fatal reset script error:', err);
    process.exit(1);
});
