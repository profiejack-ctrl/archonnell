// ==============================================================================
// ARCHON NELL INCORPORATED - HRMS FACTORY & SEEDER
// Populates hrms.departments, positions, employees, job_postings, applicants, onboarding_tasks
// ==============================================================================
import { query } from '../connection.js';
import { PHILIPPINE_DEPARTMENTS, PHILIPPINE_POSITIONS } from './dataSets.js';
export async function seedHrms(usersByEmail) {
    console.log('   ↳ [HRMSFactory] Seeding corporate departments...');
    const deptMap = new Map(); // code -> id
    for (const d of PHILIPPINE_DEPARTMENTS) {
        const res = await query(`INSERT INTO hrms.departments (code, name, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (code) DO UPDATE
       SET name = EXCLUDED.name, description = EXCLUDED.description
       RETURNING id, code`, [d.code, d.name, d.description]);
        deptMap.set(res.rows[0].code, res.rows[0].id);
    }
    console.log('   ↳ [HRMSFactory] Seeding organizational positions...');
    const posMap = new Map(); // title -> { id, baseSalary }
    for (const p of PHILIPPINE_POSITIONS) {
        const deptId = deptMap.get(p.deptCode);
        if (!deptId)
            continue;
        // Check if position already exists for department
        const existing = await query(`SELECT id, base_salary FROM hrms.positions WHERE department_id = $1 AND title = $2`, [deptId, p.title]);
        let posId;
        if (existing.rows.length > 0) {
            posId = existing.rows[0].id;
            await query(`UPDATE hrms.positions SET salary_grade = $1, base_salary = $2 WHERE id = $3`, [p.salaryGrade, p.baseSalary, posId]);
        }
        else {
            const inserted = await query(`INSERT INTO hrms.positions (department_id, title, salary_grade, base_salary)
         VALUES ($1, $2, $3, $4)
         RETURNING id`, [deptId, p.title, p.salaryGrade, p.baseSalary]);
            posId = inserted.rows[0].id;
        }
        posMap.set(p.title, { id: posId, baseSalary: p.baseSalary });
    }
    console.log('   ↳ [HRMSFactory] Seeding 25+ realistic employee profiles...');
    // Specific mapping for core employee logins
    const primaryEmployees = [
        {
            empNo: 'EMP-0001',
            email: 'hr@archonnell.com',
            first: 'Maria Cristina',
            last: 'Santos',
            deptCode: 'HR',
            posTitle: 'Human Resources Director',
            hireDate: '2021-03-15',
            birthDate: '1984-06-22',
            address: '128 Don Chino Roces Ave, Pio del Pilar, Makati City'
        },
        {
            empNo: 'EMP-0002',
            email: 'payroll@archonnell.com',
            first: 'Arlene',
            last: 'Reyes-Castillo',
            deptCode: 'FIN',
            posTitle: 'Senior Payroll & Tax Officer',
            hireDate: '2021-08-01',
            birthDate: '1988-11-14',
            address: '77 Ortigas Ave, San Antonio, Pasig City'
        },
        {
            empNo: 'EMP-0003',
            email: 'fleet@archonnell.com',
            first: 'Carlos',
            last: 'Mendoza',
            deptCode: 'LOG',
            posTitle: 'Fleet & Logistics Supervisor',
            hireDate: '2022-01-10',
            birthDate: '1982-04-18',
            address: 'Lot 8 Industrial Park, Santa Rosa, Laguna'
        },
        {
            empNo: 'EMP-0004',
            email: 'driver1@archonnell.com',
            first: 'Reynaldo',
            last: 'Bautista Jr.',
            deptCode: 'LOG',
            posTitle: 'Senior Commercial Logistics Driver',
            hireDate: '2022-04-15',
            birthDate: '1985-09-30',
            address: 'Block 4 Lot 12 Cavite Economic Zone, Rosario, Cavite'
        },
        {
            empNo: 'EMP-0005',
            email: 'scheduler@archonnell.com',
            first: 'Paolo Gabriel',
            last: 'Dizon',
            deptCode: 'WFM',
            posTitle: 'Plant & Field Shift Scheduler',
            hireDate: '2022-06-01',
            birthDate: '1992-02-17',
            address: 'Governor Drive, Silang, Cavite'
        },
        {
            empNo: 'EMP-0006',
            email: 'plant.sup@archonnell.com',
            first: 'Danilo Flores',
            last: 'Ramos',
            deptCode: 'PROD',
            posTitle: 'Plant Production Superintendent',
            hireDate: '2021-05-10',
            birthDate: '1979-12-05',
            address: 'Carmona Bypass Road, Carmona, Cavite'
        },
        {
            empNo: 'EMP-0007',
            email: 'chemist@archonnell.com',
            first: 'Camille Angela',
            last: 'Soriano',
            deptCode: 'PROD',
            posTitle: 'Senior Chemical Mixing Chemist',
            hireDate: '2022-09-01',
            birthDate: '1990-08-19',
            address: 'Aguinaldo Highway, Dasmariñas City, Cavite'
        },
        {
            empNo: 'EMP-0008',
            email: 'qa.lead@archonnell.com',
            first: 'Rochelle',
            last: 'Navarro',
            deptCode: 'QA',
            posTitle: 'Quality Assurance Specialist',
            hireDate: '2022-10-15',
            birthDate: '1991-03-25',
            address: 'Filinvest Corporate City, Alabang, Muntinlupa'
        },
        {
            empNo: 'EMP-0009',
            email: 'b2b.sales@archonnell.com',
            first: 'Rafael Antonio',
            last: 'Morales',
            deptCode: 'SALES',
            posTitle: 'National B2B Sales Manager',
            hireDate: '2021-11-01',
            birthDate: '1986-07-12',
            address: '32nd Street, Fort Bonifacio, BGC, Taguig'
        },
        {
            empNo: 'EMP-0010',
            email: 'accounting@archonnell.com',
            first: 'Kimberly Joy',
            last: 'Tan',
            deptCode: 'FIN',
            posTitle: 'Billing & Accounting Specialist',
            hireDate: '2023-02-01',
            birthDate: '1994-05-08',
            address: 'Pio del Pilar, Chino Roces Ave, Makati City'
        },
        {
            empNo: 'EMP-0011',
            email: 'recruiter@archonnell.com',
            first: 'Jasmine Beatrice',
            last: 'Lim',
            deptCode: 'HR',
            posTitle: 'Senior Talent Acquisition Specialist',
            hireDate: '2023-04-15',
            birthDate: '1993-10-11',
            address: 'Commonwealth Ave, Diliman, Quezon City'
        },
        {
            empNo: 'EMP-0012',
            email: 'warehouse@archonnell.com',
            first: 'Rodrigo Cruz',
            last: 'Salazar',
            deptCode: 'LOG',
            posTitle: 'Warehouse Inventory Custodian',
            hireDate: '2023-01-10',
            birthDate: '1987-01-20',
            address: 'Tartaria, Silang, Cavite'
        },
        {
            empNo: 'EMP-0013',
            email: 'tech.support@archonnell.com',
            first: 'Anthony Miguel',
            last: 'Valdez',
            deptCode: 'SALES',
            posTitle: 'Technical Sales Representative',
            hireDate: '2023-05-20',
            birthDate: '1995-12-03',
            address: 'Aguirre Ave, BF Homes, Parañaque City'
        },
        {
            empNo: 'EMP-0014',
            email: 'driver2@archonnell.com',
            first: 'Eduardo',
            last: 'Manalo Pascual',
            deptCode: 'LOG',
            posTitle: 'Fleet Delivery Driver',
            hireDate: '2023-06-01',
            birthDate: '1989-08-14',
            address: 'Salitran, Dasmariñas City, Cavite'
        },
        {
            empNo: 'EMP-0015',
            email: 'driver3@archonnell.com',
            first: 'Danilo',
            last: 'Tolentino Rivera',
            deptCode: 'LOG',
            posTitle: 'Fleet Delivery Driver',
            hireDate: '2023-07-15',
            birthDate: '1986-04-02',
            address: 'Maduya, Carmona, Cavite'
        },
        {
            empNo: 'EMP-0016',
            email: 'driver4@archonnell.com',
            first: 'Rolando',
            last: 'Castillo Guzman',
            deptCode: 'LOG',
            posTitle: 'Fleet Delivery Driver',
            hireDate: '2023-09-01',
            birthDate: '1988-11-28',
            address: 'Laguna Technopark, Santa Rosa City, Laguna'
        },
        {
            empNo: 'EMP-0017',
            email: 'batcher1@archonnell.com',
            first: 'Emilio',
            last: 'Mercado Del Rosario',
            deptCode: 'PROD',
            posTitle: 'Batching Plant Operator',
            hireDate: '2023-03-10',
            birthDate: '1990-06-15',
            address: 'Tartaria, Governor Drive, Silang, Cavite'
        },
        {
            empNo: 'EMP-0018',
            email: 'batcher2@archonnell.com',
            first: 'Kenneth Francis',
            last: 'Aquino',
            deptCode: 'PROD',
            posTitle: 'Batching Plant Operator',
            hireDate: '2023-08-01',
            birthDate: '1993-01-30',
            address: 'Real, National Highway, Calamba City, Laguna'
        },
        {
            empNo: 'EMP-0019',
            email: 'lab.tech@archonnell.com',
            first: 'Stephanie Grace',
            last: 'Ocampo',
            deptCode: 'QA',
            posTitle: 'Materials Laboratory Technician',
            hireDate: '2023-11-15',
            birthDate: '1996-09-18',
            address: 'Don Jose, Santa Rosa City, Laguna'
        },
        // New Hires (EMP-0020 to EMP-0025)
        {
            empNo: 'EMP-0020',
            email: 'carlo.castro@archonnell.com',
            first: 'Carlo',
            last: 'Castro',
            deptCode: 'WFM',
            posTitle: 'Plant & Field Shift Scheduler',
            hireDate: '2024-02-01',
            birthDate: '1997-07-21',
            address: 'Shaw Blvd, Wack-Wack, Mandaluyong City'
        },
        {
            empNo: 'EMP-0021',
            email: 'maricel.flores@archonnell.com',
            first: 'Maricel',
            last: 'Flores',
            deptCode: 'HR',
            posTitle: 'HR & Employee Relations Associate',
            hireDate: '2024-03-15',
            birthDate: '1998-04-10',
            address: 'Aurora Blvd, Cubao, Quezon City'
        },
        {
            empNo: 'EMP-0022',
            email: 'angelo.garcia@archonnell.com',
            first: 'Angelo',
            last: 'Garcia',
            deptCode: 'PROD',
            posTitle: 'Batching Plant Operator',
            hireDate: '2024-05-01',
            birthDate: '1994-11-03',
            address: 'Tartaria, Silang, Cavite'
        },
        {
            empNo: 'EMP-0023',
            email: 'beatrice.villanueva@archonnell.com',
            first: 'Beatrice',
            last: 'Villanueva',
            deptCode: 'SALES',
            posTitle: 'Technical Sales Representative',
            hireDate: '2024-06-15',
            birthDate: '1997-02-14',
            address: 'Buendia Ave, Bel-Air, Makati City'
        },
        {
            empNo: 'EMP-0024',
            email: 'joseph.fernandez@archonnell.com',
            first: 'Joseph',
            last: 'Fernandez',
            deptCode: 'LOG',
            posTitle: 'Warehouse Inventory Custodian',
            hireDate: '2024-08-01',
            birthDate: '1992-10-09',
            address: 'Carmona Bypass Road, Carmona, Cavite'
        },
        {
            empNo: 'EMP-0025',
            email: 'gabriel.dela.cruz@archonnell.com',
            first: 'Gabriel',
            last: 'Dela Cruz',
            deptCode: 'QA',
            posTitle: 'Materials Laboratory Technician',
            hireDate: '2024-09-01',
            birthDate: '1998-12-25',
            address: 'Salitran, Dasmariñas City, Cavite'
        }
    ];
    const employees = [];
    for (const item of primaryEmployees) {
        const deptId = deptMap.get(item.deptCode);
        const pos = posMap.get(item.posTitle);
        const posId = pos ? pos.id : null;
        const baseSalary = pos ? pos.baseSalary : 25000;
        const matchedUser = usersByEmail.get(item.email);
        const userId = matchedUser ? matchedUser.id : null;
        const phone = matchedUser?.phoneNumber || `0917-${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`;
        const emergencyContact = {
            name: `${item.first} Contact`,
            relationship: 'Spouse/Family',
            phone: `0918-${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`
        };
        const res = await query(`INSERT INTO hrms.employees (
         user_id, employee_no, first_name, last_name, email, phone,
         department_id, position_id, employment_status, hire_date, birth_date,
         address, emergency_contact
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Regular', $9, $10, $11, $12)
       ON CONFLICT (employee_no) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           email = EXCLUDED.email,
           department_id = EXCLUDED.department_id,
           position_id = EXCLUDED.position_id,
           address = EXCLUDED.address
       RETURNING id, employee_no, user_id, first_name, last_name, email, phone, department_id, position_id, hire_date`, [
            userId,
            item.empNo,
            item.first,
            item.last,
            item.email,
            phone,
            deptId,
            posId,
            item.hireDate,
            item.birthDate,
            item.address,
            JSON.stringify(emergencyContact)
        ]);
        employees.push({
            id: res.rows[0].id,
            employeeNo: res.rows[0].employee_no,
            userId: res.rows[0].user_id,
            firstName: res.rows[0].first_name,
            lastName: res.rows[0].last_name,
            email: res.rows[0].email,
            phone: res.rows[0].phone,
            departmentId: res.rows[0].department_id,
            positionId: res.rows[0].position_id,
            baseSalary,
            hireDate: res.rows[0].hire_date,
            departmentCode: item.deptCode,
            positionTitle: item.posTitle
        });
    }
    console.log('   ↳ [HRMSFactory] Seeding realistic job postings...');
    const postingsData = [
        {
            deptCode: 'PROD',
            posTitle: 'Senior Chemical Mixing Chemist',
            title: 'Senior Construction Polymer Chemist',
            jobType: 'Full-Time',
            location: 'Cavite Main Plant, Silang',
            desc: 'Formulate and optimize third-generation polycarboxylate concrete admixtures, crystalline waterproofing slurries, and high-performance epoxy floor coatings.',
            reqs: 'BS / MS in Chemistry or Chemical Engineering. PRC Licensed Chemist. Minimum 3 years formulation experience in construction chemicals or coatings.',
            salaryMin: 45000,
            salaryMax: 65000,
            status: 'Open'
        },
        {
            deptCode: 'LOG',
            posTitle: 'Senior Commercial Logistics Driver',
            title: 'Heavy Truck Commercial Logistics Driver (Code 3/CE)',
            jobType: 'Full-Time',
            location: 'Cavite Plant / Greater Metro Manila Routes',
            desc: 'Operate 6-wheeler and 10-wheeler commercial trucks transporting palletized mortars, 200L chemical drums, and bulk liquid admixtures to major infrastructure sites.',
            reqs: 'Valid Professional Driver License with restriction code 3 / CE (Heavy Vehicles). Clean driving record. Minimum 3 years commercial logistics experience.',
            salaryMin: 28000,
            salaryMax: 35000,
            status: 'Open'
        },
        {
            deptCode: 'QA',
            posTitle: 'Quality Assurance Specialist',
            title: 'Concrete Materials Testing & QA Specialist',
            jobType: 'Full-Time',
            location: 'Archon Nell Central Materials Lab, Silang',
            desc: 'Execute ASTM C109 compressive strength, slump retention, and tensile bond testing on production batches of admixtures and repair mortars.',
            reqs: 'BS in Civil or Chemical Engineering. Familiarity with ASTM C494, C1107, and DPWH blue book construction standards.',
            salaryMin: 36000,
            salaryMax: 48000,
            status: 'Open'
        },
        {
            deptCode: 'SALES',
            posTitle: 'Technical Sales Representative',
            title: 'B2B Technical Sales Engineer - Civil Infrastructure',
            jobType: 'Full-Time',
            location: 'Metro Manila Field / Hybrid',
            desc: 'Liaise with top general contractors (EEI, DMCI, Megawide) and DPWH engineers to specify Archon Nell concrete solutions into highway and high-rise projects.',
            reqs: 'BS Civil Engineering or Architecture. Strong communication and presentation skills. Active contractor client network is an advantage.',
            salaryMin: 35000,
            salaryMax: 55000,
            status: 'Open'
        },
        {
            deptCode: 'WFM',
            posTitle: 'Plant & Field Shift Scheduler',
            title: 'Workforce Operations & Shift Planner',
            jobType: 'Full-Time',
            location: 'Cavite Head Office',
            desc: 'Manage weekly plant production shift rosters, coordinate logistics driver schedules, and audit biometric kiosk attendance feeds.',
            reqs: 'Bachelor degree in Industrial Engineering, Business Admin or HR. Proficiency with ERP timekeeping systems.',
            salaryMin: 32000,
            salaryMax: 42000,
            status: 'Closed'
        }
    ];
    const jobPostingIds = [];
    for (const j of postingsData) {
        const deptId = deptMap.get(j.deptCode);
        const pos = posMap.get(j.posTitle);
        const res = await query(`INSERT INTO hrms.job_postings (
         department_id, position_id, title, job_type, location,
         description, requirements, salary_min, salary_max, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`, [deptId, pos?.id || null, j.title, j.jobType, j.location, j.desc, j.reqs, j.salaryMin, j.salaryMax, j.status]);
        jobPostingIds.push(res.rows[0].id);
    }
    console.log('   ↳ [HRMSFactory] Seeding 18 realistic applicant profiles with AI match scores...');
    const applicantsData = [
        {
            postingIdx: 0,
            appId: 'APP-2026-001',
            first: 'Engr. Christian',
            last: 'Tolentino',
            email: 'c.tolentino.eng@gmail.com',
            phone: '0917-812-3490',
            aiScore: 94.50,
            aiSummary: 'PRC Licensed Chemical Engineer from Mapúa University with 4 years specialized experience in polycarboxylate ether synthesis at Sika Philippines. High alignment with Archon Nell formulation goals.',
            status: 'Final Interview'
        },
        {
            postingIdx: 0,
            appId: 'APP-2026-002',
            first: 'Mary Jane',
            last: 'Rivera',
            email: 'mj.rivera.chem@yahoo.com',
            phone: '0918-234-5612',
            aiScore: 88.00,
            aiSummary: 'BS Chemistry graduate from UST. 3 years QA lab experience in industrial resin synthesis and moisture vapor barrier coatings.',
            status: 'Pre-Interview'
        },
        {
            postingIdx: 0,
            appId: 'APP-2026-003',
            first: 'Dr. Ferdinand',
            last: 'Aquino',
            email: 'dr.ferdie.aquino@gmail.com',
            phone: '0919-456-7823',
            aiScore: 97.20,
            aiSummary: 'PhD in Materials Science from UP Diliman. Published researcher on nano-silica modified concrete accelerators and early compressive strength.',
            status: 'Screening'
        },
        {
            postingIdx: 1,
            appId: 'APP-2026-004',
            first: 'Rodrigo',
            last: 'Castillo',
            email: 'rodrigo.driver78@gmail.com',
            phone: '0920-789-0123',
            aiScore: 91.00,
            aiSummary: 'Professional Driver License Restriction Code 3 & 8 (Heavy articulated trucks). 6 years accident-free commercial delivery on SLEX and NLEX freight corridors.',
            status: 'Final Interview'
        },
        {
            postingIdx: 1,
            appId: 'APP-2026-005',
            first: 'Dante',
            last: 'Pascual',
            email: 'dante_pascual_log@yahoo.com',
            phone: '0921-890-1234',
            aiScore: 86.50,
            aiSummary: 'Experienced 10-wheeler dump and tanker truck operator. Familiar with Calabarzon plant access roads and hazardous chemical safety protocols.',
            status: 'Pre-Interview'
        },
        {
            postingIdx: 1,
            appId: 'APP-2026-006',
            first: 'Gilbert',
            last: 'Manalo',
            email: 'gilbert.manalo@gmail.com',
            phone: '0922-901-2345',
            aiScore: 78.00,
            aiSummary: 'Valid Professional Driver License Code 2 (Light commercial). Would require Code 3 upgrade training for heavy trucks.',
            status: 'Screening'
        },
        {
            postingIdx: 2,
            appId: 'APP-2026-007',
            first: 'Clarissa',
            last: 'Del Rosario',
            email: 'engr.clarissa.dr@gmail.com',
            phone: '0926-345-6789',
            aiScore: 93.00,
            aiSummary: 'Civil Engineer from PUP. 3 years QA experience with concrete cylinder compressive testing and ASTM core drilling compliance.',
            status: 'Pre-Interview'
        },
        {
            postingIdx: 2,
            appId: 'APP-2026-008',
            first: 'Paolo',
            last: 'Guzman',
            email: 'paolo.guzman.qa@gmail.com',
            phone: '0927-456-7890',
            aiScore: 84.00,
            aiSummary: 'Lab Technician with certified training in slump cone testing, air entrainment meters, and moisture content determination.',
            status: 'Screening'
        },
        {
            postingIdx: 3,
            appId: 'APP-2026-009',
            first: 'Engr. Miguel',
            last: 'Salazar',
            email: 'miguel.salazar.sales@gmail.com',
            phone: '0928-567-8901',
            aiScore: 95.80,
            aiSummary: 'BS Civil Engineering from DLSU with 5 years enterprise technical sales track record supplying admixture chemicals to skyway contractors.',
            status: 'Final Interview'
        },
        {
            postingIdx: 3,
            appId: 'APP-2026-010',
            first: 'Rowena',
            last: 'Navarro',
            email: 'rowena.navarro.b2b@yahoo.com',
            phone: '0929-678-9012',
            aiScore: 89.20,
            aiSummary: 'Technical sales specialist with deep relationships across major general contracting firms in Metro Manila and Central Luzon.',
            status: 'Pre-Interview'
        },
        {
            postingIdx: 3,
            appId: 'APP-2026-011',
            first: 'Kenneth',
            last: 'Mercado',
            email: 'kenneth.mercado@gmail.com',
            phone: '0930-789-0123',
            aiScore: 72.50,
            aiSummary: 'Consumer goods sales experience. Lacks civil engineering or building materials technical background.',
            status: 'Rejected'
        },
        {
            postingIdx: 4,
            appId: 'APP-2026-012',
            first: 'Bernadette',
            last: 'Valdez',
            email: 'bernadette.valdez@gmail.com',
            phone: '0931-890-1234',
            aiScore: 90.00,
            aiSummary: 'Industrial Engineering graduate from UST. 2 years experience with plant roster planning and biometric kiosk attendance management.',
            status: 'Hired'
        }
    ];
    for (const a of applicantsData) {
        const postingId = jobPostingIds[a.postingIdx] || jobPostingIds[0];
        await query(`INSERT INTO hrms.applicants (
         job_posting_id, application_id, first_name, last_name, email, phone,
         ai_match_score, ai_summary, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (application_id) DO UPDATE
       SET ai_match_score = EXCLUDED.ai_match_score,
           ai_summary = EXCLUDED.ai_summary,
           status = EXCLUDED.status`, [postingId, a.appId, a.first, a.last, a.email, a.phone, a.aiScore, a.aiSummary, a.status]);
    }
    console.log('   ↳ [HRMSFactory] Seeding onboarding tasks for recent hires...');
    const newHireEmployees = employees.filter((e) => ['EMP-0020', 'EMP-0021', 'EMP-0022', 'EMP-0023', 'EMP-0024', 'EMP-0025'].includes(e.employeeNo));
    const standardOnboardingTasks = [
        { title: 'Submit BIR 2316 and SSS/PhilHealth/Pag-IBIG verification', desc: 'Provide physical photocopies of statutory government IDs and latest tax exemption card.' },
        { title: 'Attend Occupational Safety & Health (OSH) Plant Orientation', desc: 'Mandatory 4-hour OSH safety protocol orientation and emergency exit walk-through at Silang Plant.' },
        { title: 'Receive Personal Protective Equipment (PPE) & Hard Hat', desc: 'Issue safety helmet, high-visibility vest, steel-toe boots, and chemical safety goggles.' },
        { title: 'Chemical Handling & Material Safety Data Sheet (MSDS) Briefing', desc: 'Training on reading GHS hazard pictograms, chemical storage zones, and spill response kits.' },
        { title: 'Set up Enterprise Portal SSO Login & Kiosk RFID Card', desc: 'Provision user credentials, setup mobile MFA, and register fingerprint on biometric terminal.' }
    ];
    for (const emp of newHireEmployees) {
        for (let i = 0; i < standardOnboardingTasks.length; i++) {
            const t = standardOnboardingTasks[i];
            const isCompleted = i < 3; // First 3 completed
            await query(`INSERT INTO hrms.onboarding_tasks (employee_id, title, description, is_completed, completed_at)
         VALUES ($1, $2, $3, $4, $5)`, [emp.id, t.title, t.desc, isCompleted, isCompleted ? new Date().toISOString() : null]);
        }
    }
    console.log(`   ✅ [HRMSFactory] Seeded ${PHILIPPINE_DEPARTMENTS.length} departments, ${PHILIPPINE_POSITIONS.length} positions, ${employees.length} employees, and ${applicantsData.length} applicants.`);
    return { deptMap, posMap, employees };
}
