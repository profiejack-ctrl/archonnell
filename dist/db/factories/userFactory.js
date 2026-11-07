// ==============================================================================
// ARCHON NELL INCORPORATED - USER FACTORY & SSO SEEDER
// Populates auth_core.users, auth_core.audit_logs with realistic credentials
// ==============================================================================
import bcrypt from 'bcryptjs';
import { query } from '../connection.js';
export async function seedUsers() {
    console.log('   ↳ [UserFactory] Hashing master enterprise passwords...');
    const adminPasswordHash = await bcrypt.hash('Admin123!', 10);
    const employeePasswordHash = await bcrypt.hash('Employee123!', 10);
    const customerPasswordHash = await bcrypt.hash('Customer123!', 10);
    const usersToCreate = [
        // 1. Core Enterprise Admins & Officers
        {
            email: 'admin@archonnell.com',
            fullName: 'Arch. Vincent De Leon',
            globalRole: 'superadmin',
            phoneNumber: '0917-888-0001',
            avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
            passwordHash: adminPasswordHash
        },
        {
            email: 'hr@archonnell.com',
            fullName: 'Maria Cristina Santos',
            globalRole: 'hr_admin',
            phoneNumber: '0917-888-0002',
            avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=250&q=80',
            passwordHash: adminPasswordHash
        },
        {
            email: 'payroll@archonnell.com',
            fullName: 'Arlene Reyes-Castillo',
            globalRole: 'payroll_officer',
            phoneNumber: '0917-888-0003',
            avatarUrl: 'https://images.unsplash.com/photo-1580894732444-8ecded7900cd?auto=format&fit=crop&w=250&q=80',
            passwordHash: adminPasswordHash
        },
        {
            email: 'fleet@archonnell.com',
            fullName: 'Engr. Carlos Mendoza',
            globalRole: 'fleet_manager',
            phoneNumber: '0917-888-0004',
            avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80',
            passwordHash: adminPasswordHash
        },
        {
            email: 'driver1@archonnell.com',
            fullName: 'Reynaldo Bautista Jr.',
            globalRole: 'driver',
            phoneNumber: '0920-555-0101',
            avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80',
            passwordHash: adminPasswordHash
        },
        {
            email: 'customer@gmail.com',
            fullName: 'Juan Dela Cruz',
            globalRole: 'customer',
            phoneNumber: '0919-777-1010',
            avatarUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=250&q=80',
            passwordHash: customerPasswordHash
        },
        // 2. Enterprise Staff & Operations Team
        {
            email: 'scheduler@archonnell.com',
            fullName: 'Paolo Gabriel Dizon',
            globalRole: 'employee',
            phoneNumber: '0918-222-3001',
            avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=250&q=80',
            passwordHash: employeePasswordHash
        },
        {
            email: 'plant.sup@archonnell.com',
            fullName: 'Danilo Flores Ramos',
            globalRole: 'employee',
            phoneNumber: '0918-222-3002',
            avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=250&q=80',
            passwordHash: employeePasswordHash
        },
        {
            email: 'chemist@archonnell.com',
            fullName: 'Dr. Camille Angela Soriano',
            globalRole: 'employee',
            phoneNumber: '0918-222-3003',
            avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=250&q=80',
            passwordHash: employeePasswordHash
        },
        {
            email: 'qa.lead@archonnell.com',
            fullName: 'Engr. Rochelle Navarro',
            globalRole: 'employee',
            phoneNumber: '0918-222-3004',
            avatarUrl: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?auto=format&fit=crop&w=250&q=80',
            passwordHash: employeePasswordHash
        },
        {
            email: 'b2b.sales@archonnell.com',
            fullName: 'Rafael Antonio Morales',
            globalRole: 'employee',
            phoneNumber: '0918-222-3005',
            avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=250&q=80',
            passwordHash: employeePasswordHash
        },
        {
            email: 'accounting@archonnell.com',
            fullName: 'Kimberly Joy Tan',
            globalRole: 'employee',
            phoneNumber: '0918-222-3006',
            avatarUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=250&q=80',
            passwordHash: employeePasswordHash
        },
        {
            email: 'recruiter@archonnell.com',
            fullName: 'Jasmine Beatrice Lim',
            globalRole: 'employee',
            phoneNumber: '0918-222-3007',
            avatarUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=250&q=80',
            passwordHash: employeePasswordHash
        },
        {
            email: 'warehouse@archonnell.com',
            fullName: 'Rodrigo Cruz Salazar',
            globalRole: 'employee',
            phoneNumber: '0918-222-3008',
            avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=250&q=80',
            passwordHash: employeePasswordHash
        },
        {
            email: 'tech.support@archonnell.com',
            fullName: 'Anthony Miguel Valdez',
            globalRole: 'employee',
            phoneNumber: '0918-222-3009',
            avatarUrl: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&w=250&q=80',
            passwordHash: employeePasswordHash
        },
        // 3. Commercial Fleet Drivers
        {
            email: 'driver2@archonnell.com',
            fullName: 'Eduardo Manalo Pascual',
            globalRole: 'driver',
            phoneNumber: '0920-555-0102',
            avatarUrl: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=250&q=80',
            passwordHash: employeePasswordHash
        },
        {
            email: 'driver3@archonnell.com',
            fullName: 'Danilo Tolentino Rivera',
            globalRole: 'driver',
            phoneNumber: '0920-555-0103',
            avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80',
            passwordHash: employeePasswordHash
        },
        {
            email: 'driver4@archonnell.com',
            fullName: 'Rolando Castillo Guzman',
            globalRole: 'driver',
            phoneNumber: '0920-555-0104',
            avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=250&q=80',
            passwordHash: employeePasswordHash
        },
        // 4. Plant Production Technicians & Batchers
        {
            email: 'batcher1@archonnell.com',
            fullName: 'Emilio Mercado Del Rosario',
            globalRole: 'employee',
            phoneNumber: '0921-666-0201',
            avatarUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=250&q=80',
            passwordHash: employeePasswordHash
        },
        {
            email: 'batcher2@archonnell.com',
            fullName: 'Kenneth Francis Aquino',
            globalRole: 'employee',
            phoneNumber: '0921-666-0202',
            avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=250&q=80',
            passwordHash: employeePasswordHash
        },
        {
            email: 'lab.tech@archonnell.com',
            fullName: 'Stephanie Grace Ocampo',
            globalRole: 'employee',
            phoneNumber: '0921-666-0203',
            avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80',
            passwordHash: employeePasswordHash
        },
        // 5. Authentic B2B Contractors & Corporate Clients
        {
            email: 'kent.tagle@eei.com.ph',
            fullName: 'Engr. Kent Tagle',
            globalRole: 'customer',
            phoneNumber: '0928-987-6543',
            avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80',
            passwordHash: customerPasswordHash
        },
        {
            email: 'carlos.mendoza@dmci.com.ph',
            fullName: 'Engr. Carlos Mendoza (DMCI)',
            globalRole: 'customer',
            phoneNumber: '0918-555-1201',
            avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=250&q=80',
            passwordHash: customerPasswordHash
        },
        {
            email: 'maricel.reyes@archstudio.ph',
            fullName: 'Arch. Maricel Reyes',
            globalRole: 'customer',
            phoneNumber: '0917-333-8822',
            avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=250&q=80',
            passwordHash: customerPasswordHash
        },
        {
            email: 'antonio.aquino@conmix.ph',
            fullName: 'Engr. Antonio Aquino',
            globalRole: 'customer',
            phoneNumber: '0919-444-9911',
            avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80',
            passwordHash: customerPasswordHash
        },
        {
            email: 'patricia.lim@megawide.com.ph',
            fullName: 'Patricia Lim',
            globalRole: 'customer',
            phoneNumber: '0927-111-4455',
            avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
            passwordHash: customerPasswordHash
        },
        {
            email: 'rowena.delacruz@megabuild.ph',
            fullName: 'Rowena Dela Cruz',
            globalRole: 'customer',
            phoneNumber: '0918-666-7788',
            avatarUrl: 'https://images.unsplash.com/photo-1580894732444-8ecded7900cd?auto=format&fit=crop&w=250&q=80',
            passwordHash: customerPasswordHash
        }
    ];
    const usersByEmail = new Map();
    const adminUsers = [];
    const employeeUsers = [];
    const driverUsers = [];
    const customerUsers = [];
    for (const u of usersToCreate) {
        const res = await query(`INSERT INTO auth_core.users (email, password_hash, full_name, global_role, phone_number, avatar_url, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       ON CONFLICT (email) DO UPDATE
       SET full_name = EXCLUDED.full_name,
           global_role = EXCLUDED.global_role,
           phone_number = EXCLUDED.phone_number,
           avatar_url = EXCLUDED.avatar_url,
           updated_at = NOW()
       RETURNING id, email, full_name, global_role, phone_number, avatar_url`, [u.email, u.passwordHash, u.fullName, u.globalRole, u.phoneNumber, u.avatarUrl]);
        const record = {
            id: res.rows[0].id,
            email: res.rows[0].email,
            fullName: res.rows[0].full_name,
            globalRole: res.rows[0].global_role,
            phoneNumber: res.rows[0].phone_number,
            avatarUrl: res.rows[0].avatar_url
        };
        usersByEmail.set(record.email, record);
        if (['superadmin', 'hr_admin', 'payroll_officer', 'fleet_manager'].includes(record.globalRole)) {
            adminUsers.push(record);
        }
        else if (record.globalRole === 'driver') {
            driverUsers.push(record);
        }
        else if (record.globalRole === 'customer') {
            customerUsers.push(record);
        }
        else {
            employeeUsers.push(record);
        }
    }
    // Seed sample audit logs
    const adminUser = usersByEmail.get('admin@archonnell.com');
    if (adminUser) {
        await query(`INSERT INTO auth_core.audit_logs (user_id, module, action, resource_id, details, ip_address)
       VALUES 
       ($1, 'auth', 'USER_LOGIN', $2, '{"status": "SUCCESS", "client": "Admin Portal"}'::jsonb, '127.0.0.1'),
       ($1, 'hrms', 'DEPARTMENT_SYNC', 'DEPT_ALL', '{"message": "Verified organizational chart"}'::jsonb, '127.0.0.1'),
       ($1, 'shop', 'INVENTORY_RECONCILE', 'INV_2026', '{"audited_items": 12, "status": "VERIFIED"}'::jsonb, '127.0.0.1')`, [adminUser.id, adminUser.id]);
    }
    console.log(`   ✅ [UserFactory] Seeded ${usersToCreate.length} universal users across 7 roles.`);
    return { usersByEmail, adminUsers, employeeUsers, driverUsers, customerUsers };
}
