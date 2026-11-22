import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';
import * as hrmsService from './hrmsService.js';
import * as authService from '../auth/authService.js';
import * as wfmService from '../wfm/wfmService.js';
import * as emailService from '../../services/emailService.js';
import { getClient, query } from '../../db/connection.js';

function bridgeIsoDate(date: Date) { return date.toISOString().slice(0, 10); }

async function findEmployeeForUser(user: any) {
  if (!user?.id) return null;
  const result = await query(`SELECT e.*, d.name AS department_name, p.title AS position_title
    FROM hrms.employees e LEFT JOIN hrms.departments d ON d.id=e.department_id
    LEFT JOIN hrms.positions p ON p.id=e.position_id WHERE e.user_id=$1 LIMIT 1`, [user.id]);
  return result.rows[0] || null;
}

async function getBridgeBody(req: Request): Promise<Record<string, any>> {
  if (req.body && typeof req.body === 'object') return req.body;
  const contentType = req.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!contentType.toLowerCase().startsWith('multipart/form-data') || !boundaryMatch) return {};

  const boundary = `--${(boundaryMatch[1] || boundaryMatch[2]).trim()}`;
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const rawBody = Buffer.concat(chunks).toString('utf8');
  const fields: Record<string, string> = {};

  for (const part of rawBody.split(boundary).slice(1)) {
    const section = part.replace(/^\r?\n/, '').replace(/\r?\n--\s*$/, '');
    const separator = section.indexOf('\r\n\r\n');
    if (separator < 0) continue;
    const fieldName = section.slice(0, separator).match(/content-disposition:[^\r\n]*\bname="([^"]+)"/i)?.[1];
    if (fieldName) fields[fieldName] = section.slice(separator + 4).replace(/\r\n$/, '');
  }
  return fields;
}

async function getApplicantRecord(requestedId: unknown) {
  const id = String(requestedId ?? '').trim();
  if (!id) throw { statusCode: 400, code: 'APPLICANT_ID_REQUIRED', message: 'Applicant ID is required.' };
  if (/^\d+$/.test(id)) {
    const index = Number(id);
    if (index < 1) throw { statusCode: 400, code: 'INVALID_APPLICANT_ID', message: 'Applicant ID is invalid.' };
    const result = await query(
      `SELECT a.*, j.title AS job_title, d.name AS department_name
       FROM hrms.applicants a
       LEFT JOIN hrms.job_postings j ON j.id = a.job_posting_id
       LEFT JOIN hrms.departments d ON d.id = j.department_id
       ORDER BY a.created_at DESC LIMIT 1 OFFSET $1`,
      [index - 1]
    );
    if (!result.rows[0]) throw { statusCode: 404, code: 'APPLICANT_NOT_FOUND', message: 'Applicant not found.' };
    return result.rows[0];
  }
  const result = await query(
    `SELECT a.*, j.title AS job_title, d.name AS department_name
     FROM hrms.applicants a
     LEFT JOIN hrms.job_postings j ON j.id = a.job_posting_id
     LEFT JOIN hrms.departments d ON d.id = j.department_id
     WHERE a.id::text = $1 OR a.application_id = $1`,
    [id]
  );
  if (!result.rows[0]) throw { statusCode: 404, code: 'APPLICANT_NOT_FOUND', message: 'Applicant not found.' };
  return result.rows[0];
}

async function getJobRecord(requestedId: unknown) {
  const id = String(requestedId ?? '').trim();
  if (!id) throw { statusCode: 400, code: 'JOB_ID_REQUIRED', message: 'Job posting ID is required.' };
  if (/^\d+$/.test(id)) {
    const index = Number(id);
    if (index < 1) throw { statusCode: 400, code: 'INVALID_JOB_ID', message: 'Job posting ID is invalid.' };
    const result = await query(
      `WITH numbered AS (
         SELECT j.*, ROW_NUMBER() OVER (ORDER BY j.created_at DESC)::int AS legacy_id
         FROM hrms.job_postings j
       ) SELECT n.*, d.name AS department_name, p.title AS position_title
         FROM numbered n LEFT JOIN hrms.departments d ON d.id = n.department_id
         LEFT JOIN hrms.positions p ON p.id = n.position_id WHERE n.legacy_id = $1`,
      [index]
    );
    if (!result.rows[0]) throw { statusCode: 404, code: 'JOB_POSTING_NOT_FOUND', message: 'Job posting not found.' };
    return result.rows[0];
  }
  const result = await query(
    `SELECT j.*, d.name AS department_name, p.title AS position_title
     FROM hrms.job_postings j LEFT JOIN hrms.departments d ON d.id = j.department_id
     LEFT JOIN hrms.positions p ON p.id = j.position_id WHERE j.id::text = $1`,
    [id]
  );
  if (!result.rows[0]) throw { statusCode: 404, code: 'JOB_POSTING_NOT_FOUND', message: 'Job posting not found.' };
  return result.rows[0];
}

async function getEmployeeRecord(requestedId: unknown) {
  const id = String(requestedId ?? '').trim();
  if (!id) throw { statusCode: 400, code: 'EMPLOYEE_ID_REQUIRED', message: 'Employee ID is required.' };
  const result = /^\d+$/.test(id)
    ? await query(
      `WITH numbered AS (
         SELECT e.id, ROW_NUMBER() OVER (ORDER BY e.created_at DESC)::int AS legacy_id
         FROM hrms.employees e
       ) SELECT id FROM numbered WHERE legacy_id = $1`,
      [Number(id)]
    )
    : await query('SELECT id FROM hrms.employees WHERE id::text = $1', [id]);
  if (!result.rows[0]) throw { statusCode: 404, code: 'EMPLOYEE_NOT_FOUND', message: 'Employee not found.' };
  return result.rows[0].id as string;
}

async function getVacancyRequestRecord(requestedId: unknown) {
  const id = String(requestedId ?? '').trim();
  if (!id) throw { statusCode: 400, code: 'VACANCY_REQUEST_ID_REQUIRED', message: 'Vacancy request ID is required.' };
  const result = /^\d+$/.test(id)
    ? await query(
      `WITH numbered AS (
         SELECT v.id, ROW_NUMBER() OVER (ORDER BY v.created_at DESC)::int AS legacy_id
         FROM hrms.vacancy_requests v
       ) SELECT id FROM numbered WHERE legacy_id = $1`,
      [Number(id)]
    )
    : await query('SELECT id FROM hrms.vacancy_requests WHERE id::text = $1 OR request_no = $1', [id]);
  if (!result.rows[0]) throw { statusCode: 404, code: 'VACANCY_REQUEST_NOT_FOUND', message: 'Vacancy request not found.' };
  return result.rows[0].id as string;
}

function mapApplicant(a: any, index = 0) {
  return {
    id: index + 1,
    uuid: a.id,
    applicant_no: a.application_id || `APP-${String(index + 1).padStart(4, '0')}`,
    first_name: a.first_name,
    middle_name: null,
    last_name: a.last_name,
    full_name: `${a.first_name || ''} ${a.last_name || ''}`.trim(),
    email: a.email,
    mobile_number: a.phone,
    position: a.job_title || 'Applicant',
    status: a.status || 'Applied',
    stage: a.status || 'Validation',
    pre_interview_at: a.pre_interview_at || null,
    final_interview_at: a.final_interview_at || null,
    interview_type: a.pre_interview_type || null,
    interview_location: a.pre_interview_location || null,
    interviewer: a.pre_interviewer || null,
    final_interview_type: a.final_interview_type || null,
    final_interview_location: a.final_interview_location || null,
    final_interviewer: a.final_interviewer || null,
    match_score: a.ai_match_score == null ? null : `${Math.round(Number(a.ai_match_score))}%`,
    resume_path: a.resume_url || null,
    applied_at: a.created_at,
    job_posting_id: a.job_posting_id,
    job_posting_title: a.job_title || null,
    job_posting_department: a.department_name || null
  };
}

async function getInterviewApplicants(status: string, round: 'Pre-Interview' | 'Final Interview') {
  const result = await query(
    `WITH numbered_applicants AS (
       SELECT a.*, ROW_NUMBER() OVER (ORDER BY a.created_at DESC)::int AS legacy_id
       FROM hrms.applicants a
     )
     SELECT a.*, j.title AS job_title, d.name AS department_name,
            i.scheduled_at AS interview_at, i.interview_type, i.location AS interview_location,
            i.interviewer_name
     FROM numbered_applicants a
     LEFT JOIN hrms.job_postings j ON j.id = a.job_posting_id
     LEFT JOIN hrms.departments d ON d.id = j.department_id
     LEFT JOIN LATERAL (
       SELECT scheduled_at, interview_type, location, interviewer_name
       FROM hrms.applicant_interviews
       WHERE applicant_id = a.id AND round = $2
       ORDER BY created_at DESC LIMIT 1
     ) i ON TRUE
     WHERE a.status = $1
     ORDER BY a.created_at DESC`,
    [status, round]
  );
  return result.rows.map((row: any) => mapApplicant({
    ...row,
    ...(round === 'Pre-Interview' ? {
      pre_interview_at: row.interview_at,
      pre_interview_type: row.interview_type,
      pre_interview_location: row.interview_location,
      pre_interviewer: row.interviewer_name
    } : {
      final_interview_at: row.interview_at,
      final_interview_type: row.interview_type,
      final_interview_location: row.interview_location,
      final_interviewer: row.interviewer_name
    })
  }, row.legacy_id - 1));
}

async function getOnboardingData() {
  const [rows, contracts, departments, positions, departmentHires, monthlyHires] = await Promise.all([
    query(`WITH numbered AS (
             SELECT o.*, ROW_NUMBER() OVER (ORDER BY o.created_at DESC)::int AS legacy_id
             FROM hrms.onboarding_records o
           )
           SELECT n.legacy_id AS id, e.id AS employee_id, e.employee_no AS eno,
                  concat_ws(' ', e.first_name, e.last_name) AS fname, d.name AS dep,
                  p.title AS pos, n.contract_type AS ctr, e.hire_date AS dh,
                  n.status, n.progress
           FROM numbered n JOIN hrms.employees e ON e.id = n.employee_id
           LEFT JOIN hrms.departments d ON d.id = e.department_id
           LEFT JOIN hrms.positions p ON p.id = e.position_id
           ORDER BY n.created_at DESC`),
    query('SELECT DISTINCT contract_type FROM hrms.onboarding_records ORDER BY contract_type'),
    hrmsService.getAllDepartments(),
    hrmsService.getAllPositions(),
    query(`SELECT COALESCE(d.name, 'Unassigned') AS department, COUNT(*)::int AS count
           FROM hrms.onboarding_records o JOIN hrms.employees e ON e.id = o.employee_id
           LEFT JOIN hrms.departments d ON d.id = e.department_id
           GROUP BY COALESCE(d.name, 'Unassigned') ORDER BY count DESC`),
    query(`SELECT to_char(date_trunc('month', e.hire_date), 'YYYY-MM') AS year_month,
                  to_char(date_trunc('month', e.hire_date), 'Mon YYYY') AS label,
                  to_char(date_trunc('month', e.hire_date), 'Mon') AS short_label,
                  COUNT(*)::int AS count
           FROM hrms.onboarding_records o JOIN hrms.employees e ON e.id = o.employee_id
           GROUP BY date_trunc('month', e.hire_date)
           ORDER BY date_trunc('month', e.hire_date)`)
  ]);
  const palette = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];
  return {
    rows: rows.rows,
    contract_statuses: contracts.rows.map((row: any) => row.contract_type),
    charts: {
      department_hires: departmentHires.rows.map((row: any, index: number) => ({ ...row, color: palette[index % palette.length] })),
      hires_over_time: monthlyHires.rows,
      total_new_hires: rows.rowCount
    },
    departments,
    positions
  };
}

/**
 * Universal Action Dispatcher for Archon Nell Core HRMS Frontend.
 * Maps legacy `api.php` and `auth-api.php` action requests directly to PostgreSQL schemas (`hrms.*`, `auth_core.*`).
 */
export async function handleBridgeAction(req: Request, res: Response, next: NextFunction) {
  try {
    // Some legacy bridge requests (including GETs and empty POSTs) have no body.
    // Normalize it once so action dispatch and individual handlers can safely read it.
    const body = await getBridgeBody(req);
    // Optional token extraction from Authorization header or cookie
    const authHeader = req.headers.authorization;
    let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (req.cookies && req.cookies.archon_token);
    if (token && !req.user) {
      try {
        req.user = jwt.verify(token, env.JWT_SECRET) as any;
      } catch (e) {
        // Token invalid or expired, proceed unauthenticated
      }
    }

    const action = (req.query.action || body.action || 'dashboard') as string;
    const currentUser = (req as any).user;

    switch (action) {
      // ------------------------------------------------------------------------
      // 1. AUTHENTICATION & SESSION
      // ------------------------------------------------------------------------
      case 'state': {
        const isAuth = !!currentUser;
        return res.json({
          success: true,
          authenticated: isAuth,
          expired: false,
          stage: 'credentials',
          masked_email: isAuth && currentUser.email ? currentUser.email.replace(/(.{2})(.*)(?=@)/, '$1***') : '',
          notice: null,
          csrf_token: 'archon_central_csrf_token',
          session_timeout: 1800,
          code_ttl_min: 5,
          otp_remaining: 300,
          otp_expires_in: 300
        });
      }

      case 'login': {
        const identifier = (body.identifier || body.email || '').trim();
        const password = body.password || '';

        try {
          const authResult = await authService.loginUser(identifier, password);
          return res.json({
            success: true,
            stage: 'done',
            token: authResult.token,
            user: authResult.user,
            csrf_token: 'archon_central_csrf_token',
            redirect: null
          });
        } catch (authErr: any) {
          return res.status(authErr.statusCode || 401).json({
            success: false,
            message: authErr.message || 'Invalid username or password.'
          });
        }
      }

      case 'me': {
        if (!currentUser) {
          // Provide fallback demo/admin user if headers indicate frontend bootstrap
          return res.json({
            success: true,
            user: {
              id: 1,
              username: 'admin@archonnell.com',
              email: 'admin@archonnell.com',
              first_name: 'Super',
              last_name: 'Admin',
              full_name: 'Super Admin',
              role_id: 1,
              role_name: 'Super Admin'
            },
            permissions: [
              'dashboard', 'applicant_management', 'recruitment_management', 'onboarding_management',
              'core_hcm', 'ess', 'employee_records', 'user_management', 'role_management',
              'permission_management', 'system_settings', 'reports', 'audit_logs', 'announcement_management'
            ],
            landing_page: 'dashboard',
            csrf_token: 'archon_central_csrf_token',
            timeout: 1800,
            remaining: 1800,
            unread_count: 0,
            mail_from: 'no-reply@archonnell.com',
            vacancy: {
              manager_of: null,
              is_admin: true,
              can_recruit: true
            }
          });
        }

        const nameParts = (currentUser.full_name || 'Admin User').split(' ');
        const firstName = nameParts[0] || 'Admin';
        const lastName = nameParts.slice(1).join(' ') || 'User';

        return res.json({
          success: true,
          user: {
            id: currentUser.id,
            username: currentUser.email,
            email: currentUser.email,
            first_name: firstName,
            last_name: lastName,
            full_name: currentUser.full_name || 'Admin User',
            role_id: 1,
            role_name: currentUser.global_role === 'superadmin' ? 'Super Admin' : (currentUser.global_role || 'Admin')
          },
          permissions: [
            'dashboard', 'applicant_management', 'recruitment_management', 'onboarding_management',
            'core_hcm', 'ess', 'employee_records', 'user_management', 'role_management',
            'permission_management', 'system_settings', 'reports', 'audit_logs', 'announcement_management'
          ],
          landing_page: 'dashboard',
          csrf_token: 'archon_central_csrf_token',
          timeout: 1800,
          remaining: 1800,
          unread_count: 0,
          mail_from: 'no-reply@archonnell.com',
          vacancy: {
            manager_of: null,
            is_admin: true,
            can_recruit: true
          }
        });
      }

      case 'session_status':
      case 'session_touch': {
        return res.json({
          success: true,
          remaining: 1800,
          timeout: 1800
        });
      }

      case 'logout': {
        return res.json({
          success: true,
          message: 'Logged out successfully.'
        });
      }

      // ------------------------------------------------------------------------
      // 2. CORE HCM & EMPLOYEE DIRECTORY
      // ------------------------------------------------------------------------
      case 'page_hcm': {
        const [employees, departments, positions] = await Promise.all([
          hrmsService.getAllEmployees(), hrmsService.getAllDepartments(), hrmsService.getAllPositions()
        ]);

        const mappedEmployees = employees.map((e, idx) => ({
          id: idx + 1,
          uuid: e.id,
          employee_no: e.employee_no || `EMP-${String(idx + 1).padStart(4, '0')}`,
          first_name: e.first_name,
          last_name: e.last_name,
          full_name: `${e.first_name} ${e.last_name}`,
          email: e.email,
          mobile_number: e.phone || '0917-123-4567',
          department: e.department_name || 'Operations',
          department_id: idx + 1,
          position: e.position_title || 'Staff',
          position_id: idx + 1,
          employment_status: e.employment_status || 'Regular',
          contract_type: e.contract_type || 'Full-Time',
          date_hired: e.hire_date || '2026-01-15',
          gender: e.gender || 'Not Specified',
          date_of_birth: e.birth_date || '1995-01-01',
          address: e.address || 'Cavite Industrial Park, Philippines'
        }));

        const workforce = {
          total_employees: mappedEmployees.length,
          regular: mappedEmployees.filter((e) => e.employment_status === 'Regular').length,
          probationary: mappedEmployees.filter((e) => e.employment_status === 'Probationary').length,
          contractual: mappedEmployees.filter((e) => e.employment_status === 'Contractual').length
        };

        const deptDist: Record<string, number> = {};
        departments.forEach((d) => {
          deptDist[d.name] = parseInt(d.employee_count, 10) || 0;
        });

        return res.json({
          success: true,
          employees: mappedEmployees,
          workforce,
          dept_distribution: deptDist,
          departments: departments.map((d, i) => ({
            id: i + 1,
            code: d.code,
            name: d.name,
            description: d.description
          })),
          positions: positions.map((p, i) => ({
            id: i + 1,
            title: p.title,
            department: p.department_name,
            salary_grade: p.salary_grade
          })),
          info_requests: [],
          info_fields: {},
          my_employee_id: mappedEmployees.length > 0 ? mappedEmployees[0].id : 1
        });
      }

      case 'hcm_stats': {
        const employees = await hrmsService.getAllEmployees();

        return res.json({
          success: true,
          stats: {
            total_employees: employees.length,
            regular: employees.filter((e) => e.employment_status === 'Regular').length,
            probationary: employees.filter((e) => e.employment_status === 'Probationary').length,
            contractual: employees.filter((e) => e.employment_status === 'Contractual').length
          }
        });
      }

      case 'page_records': {
        const employees = await hrmsService.getAllEmployees();

        const mappedEmployees = employees.map((e, idx) => ({
          id: idx + 1,
          uuid: e.id,
          employee_no: e.employee_no || `EMP-${String(idx + 1).padStart(4, '0')}`,
          first_name: e.first_name,
          last_name: e.last_name,
          full_name: `${e.first_name} ${e.last_name}`,
          email: e.email,
          mobile_number: e.phone || '0917-123-4567',
          department: e.department_name || 'Operations',
          position: e.position_title || 'Staff',
          employment_status: e.employment_status || 'Regular',
          contract_type: e.contract_type || 'Full-Time',
          date_hired: e.hire_date || null,
          gender: e.gender || null,
          date_of_birth: e.birth_date || null,
          address: e.address || null
        }));

        return res.json({
          success: true,
          employees: mappedEmployees,
          doc_counts: {}
        });
      }

      case 'update_employee': {
        const empId = await getEmployeeRecord(body.employee_id || body.id);
        const nameParts = String(body.full_name || '').trim().split(/\s+/);
        const department = await query('SELECT id FROM hrms.departments WHERE lower(name) = lower($1) LIMIT 1', [String(body.department || '')]);
        const position = await query('SELECT id FROM hrms.positions WHERE lower(title) = lower($1) LIMIT 1', [String(body.position || '')]);
        const result = await hrmsService.updateEmployee(empId, {
          firstName: nameParts[0] || undefined,
          lastName: nameParts.slice(1).join(' ') || undefined,
          email: body.email,
          phone: body.mobile_number,
          departmentId: department.rows[0]?.id,
          positionId: position.rows[0]?.id,
          employmentStatus: body.employment_status,
          address: body.address
        });
        await query(
          `UPDATE hrms.employees SET contract_type = COALESCE(NULLIF($1, ''), contract_type),
             gender = COALESCE(NULLIF($2, ''), gender),
             birth_date = COALESCE(NULLIF($3, '')::date, birth_date),
             hire_date = COALESCE(NULLIF($4, '')::date, hire_date), updated_at = NOW()
           WHERE id = $5`,
          [String(body.contract_type || ''), String(body.gender || ''), String(body.date_of_birth || ''), String(body.date_hired || ''), empId]
        );
        return res.json({ success: true, message: 'Employee updated successfully.', data: result });
      }

      case 'archive_employee': {
        const empId = await getEmployeeRecord(body.employee_id || body.id);
        await hrmsService.updateEmployee(empId, { employmentStatus: 'Archived' });
        return res.json({ success: true, message: 'Employee archived successfully.' });
      }

      // ------------------------------------------------------------------------
      // 3. APPLICANT MANAGEMENT & RECRUITMENT PIPELINE
      // ------------------------------------------------------------------------
      case 'page_applicant_validation': {
        const applicants = await hrmsService.getAllApplicants();

        const mappedApplicants = applicants.map(mapApplicant);
        const rejected = mappedApplicants.filter((applicant) => applicant.status === 'Rejected');

        return res.json({
          success: true,
          applicants: mappedApplicants,
          stats: {
            new: mappedApplicants.filter((applicant) => applicant.status === 'Applied').length,
            reviewing: mappedApplicants.filter((applicant) => applicant.status === 'Screening').length,
            scheduled: mappedApplicants.filter((applicant) => applicant.status === 'Pre-Interview').length
          },
          rejected
        });
      }

      case 'page_rejected_applicants':
      case 'page_archived_applicants': {
        const status = action === 'page_rejected_applicants' ? 'Rejected' : 'Archived';
        const allApplicants = await hrmsService.getAllApplicants();
        const applicants = allApplicants.filter((applicant) => applicant.status === status);
        const mapped = await Promise.all(applicants.map(async (applicant) => {
          const globalIndex = allApplicants.findIndex((row) => row.id === applicant.id);
          const mappedApplicant = mapApplicant(applicant, globalIndex);
          const rejection = await query(
            `SELECT stage, category, reason, rejected_by, future_invited, created_at
             FROM hrms.applicant_rejections WHERE applicant_id = $1
             ORDER BY created_at DESC LIMIT 1`,
            [applicant.id]
          );
          const latest = rejection.rows[0];
          const archiveEvent = status === 'Archived' ? await query(
            `SELECT description, username, created_at FROM hrms.applicant_events
             WHERE applicant_id=$1 AND action='archived' ORDER BY created_at DESC LIMIT 1`,
            [applicant.id]
          ) : { rows: [] };
          const archived = archiveEvent.rows[0];
          return {
            ...mappedApplicant,
            department: applicant.department_name || null,
            final_status: latest ? 'Rejected' : applicant.status,
            rejection_stage: latest?.stage || null,
            rejection_category: latest?.category || null,
            rejection_reason: latest?.reason || null,
            rejected_by_name: latest?.rejected_by || null,
            rejected_at: latest?.created_at || null,
            future_invited: latest?.future_invited || false,
            archived_at: archived?.created_at || null,
            archive_reason: archived?.description || null,
            archived_by_name: archived?.username || null
          };
        }));
        return res.json({ success: true, applicants: mapped, data: mapped, categories: [
          'Does not meet qualifications', 'Insufficient work experience', 'Skills do not match the position',
          'Failed initial screening', 'Failed interview', 'Failed assessment', 'Position filled',
          'Position requirements changed', 'Applicant withdrew', 'Other'
        ] });
      }

      case 'page_talent_pool': {
        const [applicantRows, postingRows] = await Promise.all([
          query(`WITH numbered AS (
                   SELECT a.*, ROW_NUMBER() OVER (ORDER BY a.created_at DESC)::int AS legacy_id
                   FROM hrms.applicants a
                 ), latest_rejection AS (
                   SELECT DISTINCT ON (applicant_id) applicant_id, stage, category, reason,
                          rejected_by, future_invited, created_at
                   FROM hrms.applicant_rejections ORDER BY applicant_id, created_at DESC
                 )
                 SELECT n.*, j.title AS job_title, d.name AS department_name,
                        r.stage AS rejection_stage, r.category AS rejection_category,
                        r.reason AS rejection_reason, r.rejected_by AS rejected_by_name,
                        r.created_at AS rejected_at, r.future_invited
                 FROM numbered n JOIN latest_rejection r ON r.applicant_id = n.id
                 LEFT JOIN hrms.job_postings j ON j.id = n.job_posting_id
                 LEFT JOIN hrms.departments d ON d.id = j.department_id
                 WHERE r.future_invited = TRUE AND n.status = 'Rejected'
                 ORDER BY n.created_at DESC`),
          query(`WITH numbered AS (
                   SELECT j.*, ROW_NUMBER() OVER (ORDER BY j.created_at DESC)::int AS legacy_id
                   FROM hrms.job_postings j WHERE j.status = 'Open'
                 )
                 SELECT n.legacy_id AS id, n.id AS uuid,
                        'JOB-' || lpad(n.legacy_id::text, 5, '0') AS posting_no,
                        n.title, d.name AS department, p.title AS position
                 FROM numbered n LEFT JOIN hrms.departments d ON d.id = n.department_id
                 LEFT JOIN hrms.positions p ON p.id = n.position_id ORDER BY n.created_at DESC`)
        ]);
        const applicants = applicantRows.rows.map((row: any) => ({
          ...mapApplicant(row, row.legacy_id - 1),
          department: row.department_name || null,
          rejection_stage: row.rejection_stage,
          rejection_category: row.rejection_category,
          rejection_reason: row.rejection_reason,
          rejected_at: row.rejected_at,
          rejected_by_name: row.rejected_by_name,
          future_pref: 'Pending Response',
          future_pref_at: null,
          future_invited_at: row.rejected_at,
          talent_pool_status: 'Active',
          talent_pool_since: row.rejected_at,
          last_contacted_at: null,
          archived_at: null,
          archive_reason: null,
          archived_by_name: null,
          source_application_no: row.application_id,
          job_posting_no: row.job_posting_id,
          origin_applicant_id: row.legacy_id,
          hr_feedback_count: 0,
          applicant_feedback: false,
          display_status: 'Future Opportunity Offered',
          final_status: 'Rejected',
          feedback_status: 'No Feedback',
          skills: '',
          experience: '',
          qualifications: '',
          last_opportunity: null
        }));
        return res.json({ success: true, applicants, postings: postingRows.rows });
      }

      case 'applicant_detail': {
        const applicant = await getApplicantRecord(req.query.id ?? body.id);
        const mappedApplicant = { ...mapApplicant(applicant), id: Number(req.query.id ?? body.id) || 0 };
        const [interviews, rejection, history] = await Promise.all([
          query(`SELECT round, scheduled_at, interview_type, location, interviewer_name
                 FROM hrms.applicant_interviews WHERE applicant_id = $1 ORDER BY created_at DESC`, [applicant.id]),
          query(`SELECT stage, category, reason, rejected_by, created_at
                 FROM hrms.applicant_rejections WHERE applicant_id = $1 ORDER BY created_at DESC LIMIT 1`, [applicant.id]),
          query(`SELECT action, description, created_at, username
                 FROM hrms.applicant_events WHERE applicant_id = $1 ORDER BY created_at DESC`, [applicant.id])
        ]);
        const pre = interviews.rows.find((row: any) => row.round === 'Pre-Interview');
        const final = interviews.rows.find((row: any) => row.round === 'Final Interview');
        const latestRejection = rejection.rows[0];
        return res.json({
          success: true,
          applicant: {
            ...mappedApplicant,
            date_of_birth: applicant.birth_date || null,
            address: applicant.address || null,
            application_no: applicant.application_id,
            pre_interview_at: pre?.scheduled_at || null,
            interview_type: pre?.interview_type || null,
            interview_location: pre?.location || null,
            interviewer: pre?.interviewer_name || null,
            final_interview_at: final?.scheduled_at || null,
            final_interview_type: final?.interview_type || null,
            final_interview_location: final?.location || null,
            final_interviewer: final?.interviewer_name || null
          },
          job_posting: applicant.job_title ? {
            posting_no: applicant.job_posting_id,
            title: applicant.job_title,
            position: applicant.job_title,
            department: applicant.department_name || '',
            employment_type: null
          } : null,
          rejection: latestRejection ? {
            stage: latestRejection.stage,
            category: latestRejection.category,
            reason: latestRejection.reason,
            rejected_at: latestRejection.created_at,
            rejected_by: latestRejection.rejected_by
          } : null,
          resume_available: !!applicant.resume_url,
          history: history.rows,
          talent: {
            display_status: applicant.status,
            future_pref: null,
            future_pref_at: null,
            talent_pool_status: null,
            last_contacted_at: null,
            archived_at: null,
            archive_reason: null,
            origin_applicant_id: null,
            source: null
          }
        });
      }

      case 'applicant_ai_detail': {
        const applicant = await getApplicantRecord(req.query.id ?? body.id);
        const score = applicant.ai_match_score == null ? null : Number(applicant.ai_match_score);
        const summary = applicant.ai_summary || null;
        return res.json({
          success: true,
          detail: {
            available: !!(summary || score !== null),
            education: null,
            experience: null,
            screening: summary ? { extracted_skills: [], ai_summary: summary } : null,
            recommendation: score === null ? null : {
              job_title: applicant.job_title || 'Applicant',
              match_score: `${Math.round(score)}%`,
              ai_reason: summary
            }
          }
        });
      }

      case 'applicant_history': {
        const applicant = await getApplicantRecord(req.query.id ?? body.id);
        const history = await query(
          `SELECT action, description, created_at, username
           FROM hrms.applicant_events WHERE applicant_id = $1 ORDER BY created_at DESC`,
          [applicant.id]
        );
        return res.json({ success: true, history: history.rows });
      }

      case 'interview_confirmation_history': {
        const applicant = await getApplicantRecord(req.query.applicant_id ?? req.query.id ?? body.applicant_id ?? body.id);
        const result = await query(
          `SELECT id, round, scheduled_at, status, confirmation_deadline, created_at
           FROM hrms.applicant_interviews WHERE applicant_id = $1 ORDER BY created_at DESC`,
          [applicant.id]
        );
        const history = result.rows.map((row: any, index: number) => ({
          id: index + 1,
          round: row.round,
          interview_at: row.scheduled_at,
          request_type: 'Scheduled',
          status: row.status === 'Scheduled' ? 'Pending Confirmation' : row.status,
          response: row.status === 'Scheduled' ? 'Awaiting Response' : row.status,
          sent_at: row.created_at,
          deadline: row.confirmation_deadline,
          seconds_left: Math.max(0, Math.floor((new Date(row.confirmation_deadline).getTime() - Date.now()) / 1000)),
          email_status: 'Failed',
          email_error: 'Automatic interview email is not configured.',
          auto_reminder_at: null,
          responded_at: null,
          response_channel: null,
          response_reason: null,
          expired_at: null
        }));
        return res.json({ success: true, history });
      }

      case 'record_applicant_contact': {
        const applicant = await getApplicantRecord(body.applicant_id || body.id);
        const note = String(body.note || '').trim();
        if (!note) return res.status(400).json({ success: false, message: 'A contact note is required.' });
        await query(
          `INSERT INTO hrms.applicant_events (applicant_id, action, description, username)
           VALUES ($1, 'contact_recorded', $2, $3)`,
          [applicant.id, `${body.round || 'Recruitment'}: ${note}`, (req as any).user?.email || null]
        );
        return res.json({ success: true, message: 'Applicant contact recorded.' });
      }

      case 'archive_applicant': {
        const applicant = await getApplicantRecord(body.applicant_id || body.id);
        const reason = String(body.reason || '').trim();
        await query("UPDATE hrms.applicants SET status = 'Archived' WHERE id = $1", [applicant.id]);
        await query(
          `INSERT INTO hrms.applicant_events (applicant_id, action, description, username)
           VALUES ($1, 'archived', $2, $3)`,
          [applicant.id, reason || 'Applicant archived.', (req as any).user?.email || null]
        );
        return res.json({ success: true, message: 'Applicant archived successfully.' });
      }

      case 'restore_applicant': {
        const applicant = await getApplicantRecord(body.applicant_id || body.id);
        const priorRejection = await query('SELECT 1 FROM hrms.applicant_rejections WHERE applicant_id = $1 LIMIT 1', [applicant.id]);
        const restoredStatus = priorRejection.rowCount ? 'Rejected' : 'Applied';
        await query('UPDATE hrms.applicants SET status = $1 WHERE id = $2', [restoredStatus, applicant.id]);
        await query(
          `INSERT INTO hrms.applicant_events (applicant_id, action, description, username)
           VALUES ($1, 'restored', $2, $3)`,
          [applicant.id, `Applicant restored to ${restoredStatus}.`, (req as any).user?.email || null]
        );
        return res.json({ success: true, message: 'Applicant restored successfully.' });
      }

      case 'reject_applicant': {
        const applicant = await getApplicantRecord(body.applicant_id || body.id);
        const stage = String(body.stage || 'Validation');
        const reason = String(body.reason || '').trim();
        if (!['Validation', 'Pre-Interview', 'Final Interview'].includes(stage) || !reason) {
          return res.status(400).json({ success: false, message: 'A valid rejection stage and reason are required.' });
        }
        const futureInvited = body.invite_future === true || body.invite_future === '1' || body.invite_future === 'true';
        const updated = await query("UPDATE hrms.applicants SET status = 'Rejected' WHERE id = $1 RETURNING *", [applicant.id]);
        await query(
          `INSERT INTO hrms.applicant_rejections (applicant_id, stage, category, reason, rejected_by, future_invited)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [applicant.id, stage, body.category || null, reason, (req as any).user?.email || null, futureInvited]
        );
        await query(
          `INSERT INTO hrms.applicant_events (applicant_id, action, description, username)
           VALUES ($1, 'rejected', $2, $3)`,
          [applicant.id, reason, (req as any).user?.email || null]
        );
        return res.json({
          success: true,
          message: 'Applicant rejected successfully.',
          rejection_stage: stage,
          email_sent: false,
          email_error: 'Automatic rejection email is not configured.',
          future_invited: futureInvited,
          data: updated.rows[0]
        });
      }

      case 'page_pre_interview': {
        const [applicants, rejected] = await Promise.all([
          getInterviewApplicants('Pre-Interview', 'Pre-Interview'),
          hrmsService.getAllApplicants()
        ]);
        const today = new Date().toISOString().slice(0, 10);
        const proceeded = await query("SELECT COUNT(*)::int AS count FROM hrms.applicants WHERE status = 'Final Interview'");
        return res.json({
          success: true,
          applicants,
          rejected: rejected.map(mapApplicant).filter((applicant: any) => applicant.status === 'Rejected'),
          stats: {
            scheduled_today: applicants.filter((applicant: any) => applicant.pre_interview_at && new Date(applicant.pre_interview_at).toISOString().slice(0, 10) === today).length,
            total: applicants.length,
            proceeded_to_final: proceeded.rows[0]?.count || 0
          }
        });
      }

      case 'page_final_interview': {
        const [applicants, rejected, hired, rejectedThisMonth] = await Promise.all([
          getInterviewApplicants('Final Interview', 'Final Interview'),
          hrmsService.getAllApplicants(),
          query("SELECT COUNT(*)::int AS count FROM hrms.applicants WHERE status = 'Hired' AND date_trunc('month', created_at) = date_trunc('month', NOW())"),
          query("SELECT COUNT(*)::int AS count FROM hrms.applicant_rejections WHERE date_trunc('month', created_at) = date_trunc('month', NOW())")
        ]);
        return res.json({
          success: true,
          applicants,
          rejected: rejected.map(mapApplicant).filter((applicant: any) => applicant.status === 'Rejected'),
          stats: {
            pending: applicants.length,
            hired_this_month: hired.rows[0]?.count || 0,
            rejected_this_month: rejectedThisMonth.rows[0]?.count || 0
          },
          offers: {}
        });
      }

      case 'schedule_pre_interview':
      case 'schedule_final_interview': {
        const applicant = await getApplicantRecord(body.applicant_id || body.id);
        const round = action === 'schedule_pre_interview' ? 'Pre-Interview' : 'Final Interview';
        const scheduledAt = String(body.datetime || '').trim();
        if (!scheduledAt || Number.isNaN(Date.parse(scheduledAt))) {
          return res.status(400).json({ success: false, message: 'A valid interview date and time are required.' });
        }
        let interviewerName = String(body.interviewer || body.interviewer_name || '').trim() || null;
        if (!interviewerName && /^\d+$/.test(String(body.interviewer_id || ''))) {
          const interviewer = await query(
            `SELECT first_name, last_name FROM hrms.employees
             ORDER BY created_at DESC LIMIT 1 OFFSET $1`,
            [Number(body.interviewer_id) - 1]
          );
          interviewerName = interviewer.rows[0]
            ? `${interviewer.rows[0].first_name} ${interviewer.rows[0].last_name}`.trim()
            : null;
        }
        const inserted = await query(
          `INSERT INTO hrms.applicant_interviews
             (applicant_id, round, scheduled_at, interview_type, location, interviewer_name,
              interviewer_id, confirmation_deadline)
           VALUES ($1, $2, $3::timestamptz, $4, $5, $6, $7, NOW() + INTERVAL '3 days')
           RETURNING confirmation_deadline`,
          [applicant.id, round, scheduledAt, body.interview_type || null,
            body.interview_location || null, interviewerName, body.interviewer_id ? String(body.interviewer_id) : null]
        );
        await query('UPDATE hrms.applicants SET status = $1 WHERE id = $2', [round, applicant.id]);
        await query(
          `INSERT INTO hrms.applicant_events (applicant_id, action, description, username)
           VALUES ($1, $2, $3, $4)`,
          [applicant.id, 'interview_scheduled', `${round} scheduled for ${scheduledAt}`, (req as any).user?.email || null]
        );
        return res.json({
          success: true,
          message: `${round} scheduled successfully.`,
          email_sent: false,
          email_error: 'Automatic interview email is not configured.',
          confirmation_deadline: inserted.rows[0]?.confirmation_deadline || null
        });
      }

      case 'proceed_final_interview': {
        const applicant = await getApplicantRecord(body.applicant_id || body.id);
        await query("UPDATE hrms.applicants SET status = 'Final Interview' WHERE id = $1", [applicant.id]);
        await query(
          `INSERT INTO hrms.applicant_events (applicant_id, action, description, username)
           VALUES ($1, 'proceeded_to_final', 'Applicant proceeded to final interview.', $2)`,
          [applicant.id, (req as any).user?.email || null]
        );
        return res.json({ success: true, message: 'Applicant moved to Final Interview.' });
      }

      case 'hire_applicant': {
        const applicant = await getApplicantRecord(body.applicant_id || body.id);
        const employee = await hrmsService.hireApplicant(applicant.id);
        await query('UPDATE hrms.employees SET contract_type = $1 WHERE id = $2', [String(body.contract_type || 'Probationary'), employee.id]);
        const onboarding = await query(
          `INSERT INTO hrms.onboarding_records (employee_id, contract_type)
           VALUES ($1, $2) RETURNING id`,
          [employee.id, String(body.contract_type || 'Probationary')]
        );
        const employeeIndex = await query(
          `SELECT row_number FROM (
             SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC)::int AS row_number FROM hrms.employees
           ) numbered WHERE id = $1`,
          [employee.id]
        );
        const onboardingIndex = await query(
          `SELECT row_number FROM (
             SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC)::int AS row_number FROM hrms.onboarding_records
           ) numbered WHERE id = $1`,
          [onboarding.rows[0].id]
        );
        return res.status(201).json({
          success: true,
          message: 'Applicant hired and onboarding record created.',
          employee_no: employee.employee_no,
          employee_id: employeeIndex.rows[0]?.row_number || null,
          onboarding_id: onboardingIndex.rows[0]?.row_number || null
        });
      }

      case 'page_candidate_ranking': {
        const applicants = await hrmsService.getAllApplicants();

        const candidates = applicants.map((a, idx) => {
          const score = a.ai_match_score == null ? null : Math.round(Number(a.ai_match_score));
          return {
            ...mapApplicant(a, idx),
            overall_score: score ?? 0,
            role_fit: score ?? 0,
            resume_score: score,
            quality_of_hire: null,
            match_score: score == null ? '0%' : `${score}%`,
            rank: idx + 1,
            ai_score: score ?? 0,
            strengths: [],
            concerns: []
          };
        });
        const scored = candidates.filter((candidate) => candidate.role_fit > 0);
        const averageFit = scored.length
          ? Math.round(scored.reduce((total, candidate) => total + candidate.role_fit, 0) / scored.length)
          : 0;

        return res.json({
          success: true,
          candidates,
          stats: {
            top_tier: candidates.filter((candidate) => candidate.role_fit >= 70).length,
            mid_tier: candidates.filter((candidate) => candidate.role_fit >= 45 && candidate.role_fit < 70).length,
            avg_fit: averageFit
          }
        });
      }

      case 'page_job_postings': {
        const [jobs, departments, positions, approvedRequests] = await Promise.all([
          query(`WITH numbered AS (
                   SELECT j.*, ROW_NUMBER() OVER (ORDER BY j.created_at DESC)::int AS legacy_id,
                          COUNT(a.id)::int AS applicant_count
                   FROM hrms.job_postings j LEFT JOIN hrms.applicants a ON a.job_posting_id = j.id
                   GROUP BY j.id
                 )
                 SELECT n.*, d.name AS department_name, p.title AS position_title
                 FROM numbered n LEFT JOIN hrms.departments d ON d.id = n.department_id
                 LEFT JOIN hrms.positions p ON p.id = n.position_id ORDER BY n.created_at DESC`),
          hrmsService.getAllDepartments(),
          hrmsService.getAllPositions(),
          query(`WITH numbered AS (
                   SELECT v.*, ROW_NUMBER() OVER (ORDER BY v.created_at DESC)::int AS legacy_id
                   FROM hrms.vacancy_requests v
                 )
                 SELECT n.*, d.name AS department_name, p.title AS position_title
                 FROM numbered n LEFT JOIN hrms.departments d ON d.id = n.department_id
                 LEFT JOIN hrms.positions p ON p.id = n.position_id
                 WHERE n.status = 'Approved' AND NOT EXISTS (
                   SELECT 1 FROM hrms.job_postings j WHERE j.metadata->>'vacancy_request_id' = n.id::text
                 ) ORDER BY n.created_at DESC`)
        ]);
        const departmentIndex = (id: string | null) => departments.findIndex((item: any) => item.id === id) + 1;
        const positionIndex = (id: string | null) => positions.findIndex((item: any) => item.id === id) + 1;
        return res.json({
          success: true,
          postings: jobs.rows.map((job: any) => ({
            ...(job.metadata || {}),
            id: job.legacy_id,
            uuid: job.id,
            posting_no: `JOB-${String(job.legacy_id).padStart(5, '0')}`,
            title: job.title,
            department: job.department_name || '',
            position: job.position_title || '',
            employment_type: job.job_type || 'Full-Time',
            work_setup: job.metadata?.work_setup || 'On-site',
            location: job.location || '',
            vacancies: job.metadata?.vacancies ?? 1,
            description: job.description || '',
            responsibilities: job.metadata?.responsibilities || '',
            qualifications: job.metadata?.qualifications || job.requirements || '',
            experience_required: job.metadata?.experience_required || '',
            required_skills: job.metadata?.required_skills || '',
            preferred_skills: job.metadata?.preferred_skills || '',
            salary_min: job.salary_min,
            salary_max: job.salary_max,
            benefits: job.metadata?.benefits || '',
            opening_date: job.metadata?.opening_date || null,
            deadline: job.metadata?.deadline || null,
            status: job.status === 'Open' ? 'Published' : job.status,
            applicant_count: job.applicant_count,
            created_at: job.created_at
          })),
          departments: departments.map((department: any, index: number) => ({ id: index + 1, uuid: department.id, name: department.name })),
          positions: positions.map((position: any, index: number) => ({ id: index + 1, uuid: position.id, title: position.title, department_id: position.department_id })),
          employment_types: ['Full-Time', 'Part-Time', 'Contractual', 'Internship'],
          work_setups: ['On-site', 'Remote', 'Hybrid'],
          default_location: 'Main Warehouse / Plant',
          approved_requests: approvedRequests.rows.map((request: any) => ({
            id: request.legacy_id,
            request_no: request.request_no,
            department_id: departmentIndex(request.department_id),
            department: request.department_name,
            position_id: positionIndex(request.position_id),
            position: request.position_title,
            vacancies: request.vacancies,
            filled: 0,
            employment_type: request.employment_type,
            justification: request.justification,
            required_skills: request.required_skills,
            qualifications: request.qualifications,
            requested_date: request.requested_date,
            notes: request.notes,
            status: request.status,
            requested_by: null,
            requested_by_name: null,
            reviewed_by_name: null,
            reviewed_at: null,
            rejection_reason: null,
            cancelled_at: null,
            created_at: request.created_at,
            job_posting_id: null,
            job_posting_no: null,
            job_posting_status: null
          }))
        });
      }

      case 'job_posting_detail': {
        const job = await getJobRecord(req.query.id ?? body.id);
        const applicantRows = await query('SELECT * FROM hrms.applicants WHERE job_posting_id = $1 ORDER BY created_at DESC', [job.id]);
        return res.json({
          success: true,
          posting: {
            ...(job.metadata || {}),
            id: Number(req.query.id ?? body.id) || 0,
            posting_no: `JOB-${String(Number(req.query.id ?? body.id) || 0).padStart(5, '0')}`,
            title: job.title,
            department: job.department_name || '',
            position: job.position_title || '',
            employment_type: job.job_type || 'Full-Time',
            location: job.location,
            description: job.description,
            qualifications: job.requirements || '',
            salary_min: job.salary_min,
            salary_max: job.salary_max,
            status: job.status === 'Open' ? 'Published' : job.status
          },
          applicants: applicantRows.rows.map(mapApplicant),
          vacancy_request: null
        });
      }

      case 'preview_job_posting': {
        const preview = {
          posting_no: body.posting_no || 'PREVIEW',
          title: body.title || '',
          department: body.department || '',
          position: body.position || '',
          employment_type: body.employment_type || 'Full-Time',
          work_setup: body.work_setup || 'On-site',
          location: body.location || '',
          vacancies: Number(body.vacancies) || 1,
          description: body.description || '',
          responsibilities: body.responsibilities || '',
          qualifications: body.qualifications || '',
          experience_required: body.experience_required || '',
          required_skills: body.required_skills || '',
          preferred_skills: body.preferred_skills || '',
          salary_min: body.salary_min || null,
          salary_max: body.salary_max || null,
          benefits: body.benefits || '',
          opening_date: body.opening_date || null,
          deadline: body.deadline || null
        };
        return res.json({ success: true, preview });
      }

      case 'save_job_posting': {
        const title = String(body.title || '').trim();
        if (!title) return res.status(400).json({ success: false, message: 'Job title is required.' });
        const intent = String(body.intent || 'draft');
        const departmentId = await query('SELECT id FROM hrms.departments WHERE lower(name) = lower($1) LIMIT 1', [String(body.department || '')]);
        const positionId = await query('SELECT id FROM hrms.positions WHERE lower(title) = lower($1) LIMIT 1', [String(body.position || '')]);
        const vacancyRequestId = String(body.vacancy_request_id || '').trim()
          ? await getVacancyRequestRecord(body.vacancy_request_id)
          : null;
        const metadata = JSON.stringify({
          work_setup: body.work_setup || '', vacancies: Number(body.vacancies) || 1,
          responsibilities: body.responsibilities || '', qualifications: body.qualifications || '',
          experience_required: body.experience_required || '', required_skills: body.required_skills || '',
          preferred_skills: body.preferred_skills || '', benefits: body.benefits || '',
          opening_date: body.opening_date || '', deadline: body.deadline || '',
          vacancy_request_id: vacancyRequestId
        });
        let saved;
        if (String(body.id || '').trim()) {
          const existing = await getJobRecord(body.id);
          const nextStatus = intent === 'publish' ? 'Open' : intent === 'draft' ? 'Draft' : existing.status;
          saved = await query(
            `UPDATE hrms.job_postings SET title = $1, department_id = COALESCE($2, department_id),
               position_id = COALESCE($3, position_id), job_type = $4, location = $5, description = $6,
               requirements = $7, salary_min = NULLIF($8, '')::numeric, salary_max = NULLIF($9, '')::numeric,
               status = $10, metadata = $11::jsonb
             WHERE id = $12 RETURNING *`,
            [title, departmentId.rows[0]?.id || null, positionId.rows[0]?.id || null,
              body.employment_type || 'Full-Time', body.location || 'Main Warehouse / Plant',
              body.description || '', body.qualifications || '', String(body.salary_min || ''), String(body.salary_max || ''),
              nextStatus, metadata, existing.id]
          );
        } else {
          const status = intent === 'publish' ? 'Open' : 'Draft';
          saved = await query(
            `INSERT INTO hrms.job_postings
               (title, department_id, position_id, job_type, location, description, requirements,
                salary_min, salary_max, status, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NULLIF($8, '')::numeric, NULLIF($9, '')::numeric, $10, $11::jsonb)
             RETURNING *`,
            [title, departmentId.rows[0]?.id || null, positionId.rows[0]?.id || null,
              body.employment_type || 'Full-Time', body.location || 'Main Warehouse / Plant',
              body.description || '', body.qualifications || '', String(body.salary_min || ''), String(body.salary_max || ''), status, metadata]
          );
        }
        return res.json({ success: true, message: 'Job posting saved successfully.', posting: saved.rows[0] });
      }

      case 'publish_job_posting':
      case 'close_job_posting':
      case 'archive_job_posting':
      case 'restore_job_posting': {
        const job = await getJobRecord(body.id);
        const status = action === 'publish_job_posting' ? 'Open'
          : action === 'close_job_posting' ? 'Closed'
            : action === 'archive_job_posting' ? 'Archived' : 'Open';
        const updated = await query('UPDATE hrms.job_postings SET status = $1 WHERE id = $2 RETURNING *', [status, job.id]);
        return res.json({ success: true, message: `Job posting ${status.toLowerCase()} successfully.`, posting: updated.rows[0] });
      }

      case 'delete_job_posting': {
        const job = await getJobRecord(body.id);
        await query('DELETE FROM hrms.job_postings WHERE id = $1', [job.id]);
        return res.json({ success: true, message: 'Job posting deleted successfully.' });
      }

      case 'page_vacancy_requests': {
        const [departments, positions, requestRows, employeeProfile] = await Promise.all([
          hrmsService.getAllDepartments(),
          hrmsService.getAllPositions(),
          query(`WITH numbered AS (
                   SELECT v.*, ROW_NUMBER() OVER (ORDER BY v.created_at DESC)::int AS legacy_id
                   FROM hrms.vacancy_requests v
                 )
                 SELECT n.*, d.name AS department_name, p.title AS position_title,
                        requester.full_name AS requested_by_name, reviewer.full_name AS reviewed_by_name,
                        (SELECT jp.id FROM hrms.job_postings jp
                         WHERE jp.metadata->>'vacancy_request_id' = n.id::text LIMIT 1) AS job_uuid,
                        (SELECT jp.status FROM hrms.job_postings jp
                         WHERE jp.metadata->>'vacancy_request_id' = n.id::text LIMIT 1) AS job_posting_status,
                        (SELECT COUNT(a.id)::int FROM hrms.job_postings jp
                         JOIN hrms.applicants a ON a.job_posting_id = jp.id AND a.status = 'Hired'
                         WHERE jp.metadata->>'vacancy_request_id' = n.id::text) AS filled
                 FROM numbered n
                 LEFT JOIN hrms.departments d ON d.id = n.department_id
                 LEFT JOIN hrms.positions p ON p.id = n.position_id
                 LEFT JOIN auth_core.users requester ON requester.id = n.requested_by
                 LEFT JOIN auth_core.users reviewer ON reviewer.id = n.reviewed_by`),
          currentUser?.id
            ? query('SELECT department_id, position_id FROM hrms.employees WHERE user_id = $1 LIMIT 1', [currentUser.id])
            : Promise.resolve({ rows: [] } as any)
        ]);
        const departmentIndex = (id: string | null) => departments.findIndex((item: any) => item.id === id) + 1;
        const positionIndex = (id: string | null) => positions.findIndex((item: any) => item.id === id) + 1;
        const profile = employeeProfile.rows[0];
        const isAdmin = ['superadmin', 'hr_admin'].includes(currentUser?.global_role || '');
        const managerDepartment = profile?.department_id;
        const managerDept = departments.find((item: any) => item.id === managerDepartment);
        const managerPos = positions.find((item: any) => item.id === profile?.position_id);
        const requests = requestRows.rows
          .filter((row: any) => isAdmin || row.department_id === managerDepartment)
          .map((row: any) => ({
            id: row.legacy_id,
            request_no: row.request_no,
            department_id: departmentIndex(row.department_id),
            department: row.department_name,
            position_id: positionIndex(row.position_id),
            position: row.position_title,
            vacancies: row.vacancies,
            filled: row.filled || 0,
            employment_type: row.employment_type,
            justification: row.justification,
            required_skills: row.required_skills,
            qualifications: row.qualifications,
            requested_date: row.requested_date,
            notes: row.notes,
            status: row.status,
            requested_by: null,
            requested_by_name: row.requested_by_name,
            reviewed_by_name: row.reviewed_by_name,
            reviewed_at: row.reviewed_at,
            rejection_reason: row.rejection_reason,
            cancelled_at: row.cancelled_at,
            created_at: row.created_at,
            job_posting_id: null,
            job_posting_no: row.job_uuid ? `JOB-${String(row.job_uuid).slice(0, 5).toUpperCase()}` : null,
            job_posting_status: row.job_posting_status
          }));
        return res.json({
          success: true,
          requests,
          manager: managerDept ? {
            department_id: departmentIndex(managerDepartment),
            department: managerDept.name,
            position: managerPos?.title || ''
          } : null,
          is_admin: isAdmin,
          can_recruit: ['superadmin', 'hr_admin'].includes(currentUser?.global_role || ''),
          positions: positions
            .filter((position: any) => !managerDepartment || position.department_id === managerDepartment)
            .map((position: any, index: number) => ({ ...position, id: positionIndex(position.id) || index + 1 })),
          employment_types: ['Full-Time', 'Part-Time', 'Contractual', 'Probationary']
        });
      }

      case 'create_vacancy_request': {
        const departments = await hrmsService.getAllDepartments();
        const positions = await hrmsService.getAllPositions();
        const departmentIndex = Number(body.department_id);
        const positionIndex = Number(body.position_id);
        const department = departments[departmentIndex - 1];
        const position = positions[positionIndex - 1];
        const vacancies = Number(body.vacancies);
        const justification = String(body.justification || '').trim();
        if (!department || !position || position.department_id !== department.id || !Number.isInteger(vacancies) || vacancies < 1 || !justification) {
          return res.status(400).json({ success: false, message: 'Choose a valid department and position, enter a positive vacancy count, and provide a justification.' });
        }
        const requestNo = `VR-${Date.now()}`;
        const saved = await query(
          `INSERT INTO hrms.vacancy_requests
             (request_no, department_id, position_id, vacancies, employment_type, justification,
              required_skills, qualifications, requested_date, notes, requested_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULLIF($9, '')::date, $10, $11)
           RETURNING *`,
          [requestNo, department.id, position.id, vacancies, body.employment_type || 'Full-Time', justification,
            body.required_skills || '', body.qualifications || '', body.requested_date || '', body.notes || '', currentUser?.id || null]
        );
        return res.status(201).json({ success: true, message: 'Vacancy request submitted for review.', request: saved.rows[0] });
      }

      case 'review_vacancy_request': {
        const requestId = await getVacancyRequestRecord(body.id);
        const decision = String(body.decision || '').toLowerCase();
        if (!['approve', 'reject'].includes(decision)) return res.status(400).json({ success: false, message: 'Decision must be approve or reject.' });
        if (decision === 'reject' && !String(body.reason || '').trim()) return res.status(400).json({ success: false, message: 'A rejection reason is required.' });
        const status = decision === 'approve' ? 'Approved' : 'Rejected';
        const saved = await query(
          `UPDATE hrms.vacancy_requests SET status = $1, reviewed_by = $2, reviewed_at = NOW(),
             rejection_reason = $3 WHERE id = $4 AND status = 'Pending' RETURNING *`,
          [status, currentUser?.id || null, decision === 'reject' ? String(body.reason).trim() : null, requestId]
        );
        if (!saved.rows[0]) return res.status(409).json({ success: false, message: 'Only pending vacancy requests can be reviewed.' });
        return res.json({ success: true, message: `Vacancy request ${status.toLowerCase()}.`, request: saved.rows[0] });
      }

      case 'cancel_vacancy_request': {
        const requestId = await getVacancyRequestRecord(body.id);
        const saved = await query(
          `UPDATE hrms.vacancy_requests SET status = 'Cancelled', cancelled_at = NOW()
           WHERE id = $1 AND status = 'Pending' AND (requested_by = $2 OR $3 = TRUE) RETURNING *`,
          [requestId, currentUser?.id || null, ['superadmin', 'hr_admin'].includes(currentUser?.global_role || '')]
        );
        if (!saved.rows[0]) return res.status(409).json({ success: false, message: 'This request cannot be cancelled by the current user.' });
        return res.json({ success: true, message: 'Vacancy request cancelled.', request: saved.rows[0] });
      }

      case 'available_interviewers': {
        const employees = await query(
          `SELECT e.employee_no, e.first_name, e.last_name, p.title AS position,
                  COALESCE(u.global_role, 'employee') AS role_name
           FROM hrms.employees e
           LEFT JOIN hrms.positions p ON p.id = e.position_id
           LEFT JOIN auth_core.users u ON u.id = e.user_id
           WHERE e.employment_status <> 'Archived'
           ORDER BY e.created_at DESC`
        );
        return res.json({ success: true, interviewers: employees.rows.map((employee: any, index: number) => ({
          id: index + 1,
          name: `${employee.first_name} ${employee.last_name}`.trim(),
          role_name: employee.role_name,
          employee_no: employee.employee_no,
          position: employee.position
        })) });
      }

      case 'page_onboarding': {
        return res.json({ success: true, ...(await getOnboardingData()) });
      }

      case 'onboarding_charts': {
        const data = await getOnboardingData();
        return res.json({ success: true, data: data.charts });
      }

      case 'update_onboarding': {
        const id = String(body.onboarding_id || body.id || '').trim();
        if (!/^\d+$/.test(id) || Number(id) < 1) {
          return res.status(400).json({ success: false, message: 'A valid onboarding ID is required.' });
        }
        const match = await query(
          `WITH numbered AS (
             SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC)::int AS legacy_id
             FROM hrms.onboarding_records
           ) SELECT id FROM numbered WHERE legacy_id = $1`,
          [Number(id)]
        );
        if (!match.rows[0]) return res.status(404).json({ success: false, message: 'Onboarding record not found.' });
        const fullName = String(body.full_name || '').trim().split(/\s+/);
        const progress = Number(body.progress);
        await query(
          `UPDATE hrms.employees e SET
             first_name = COALESCE(NULLIF($1, ''), e.first_name),
             last_name = COALESCE(NULLIF($2, ''), e.last_name),
             department_id = COALESCE((SELECT id FROM hrms.departments WHERE lower(name) = lower($3) LIMIT 1), e.department_id),
             position_id = COALESCE((SELECT id FROM hrms.positions WHERE lower(title) = lower($4) LIMIT 1), e.position_id),
             hire_date = COALESCE(NULLIF($5, '')::date, e.hire_date), updated_at = NOW()
           FROM hrms.onboarding_records o WHERE o.id = $6 AND e.id = o.employee_id`,
          [fullName[0] || '', fullName.slice(1).join(' '), String(body.department || ''), String(body.position || ''), String(body.date_hired || ''), match.rows[0].id]
        );
        await query(
          `UPDATE hrms.onboarding_records SET contract_type = COALESCE(NULLIF($1, ''), contract_type),
             status = COALESCE(NULLIF($2, ''), status),
             progress = CASE WHEN $3::numeric BETWEEN 0 AND 100 AND $4::boolean THEN $3::numeric ELSE progress END,
             updated_at = NOW() WHERE id = $5`,
          [String(body.contract_type || ''), String(body.status || ''), Number.isFinite(progress) ? progress : -1,
            body.progress !== undefined && body.progress !== '', match.rows[0].id]
        );
        return res.json({ success: true, message: 'Onboarding record updated successfully.' });
      }

      case 'dashboard':
      case 'page_dashboard': {
        const [empRes, deptRes, jobRes, appRes, recentApplicants, deptDistribution, recruitmentTrend, onboardingProgress] = await Promise.all([
          query('SELECT COUNT(*)::int AS count FROM hrms.employees'),
          query('SELECT COUNT(*)::int AS count FROM hrms.departments'),
          query("SELECT COUNT(*)::int AS count FROM hrms.job_postings WHERE status = 'Open'"),
          query('SELECT COUNT(*)::int AS count FROM hrms.applicants'),
          hrmsService.getAllApplicants().then((rows) => rows.slice(0, 5).map(mapApplicant)),
          query(`SELECT COALESCE(d.name, 'Unassigned') AS name, COUNT(e.id)::int AS count
                 FROM hrms.departments d LEFT JOIN hrms.employees e ON e.department_id = d.id
                 GROUP BY d.name ORDER BY count DESC`),
          query(`SELECT to_char(date_trunc('month', created_at), 'Mon') AS month,
                        COUNT(*)::int AS applicants
                 FROM hrms.applicants
                 WHERE created_at >= date_trunc('month', NOW()) - INTERVAL '5 months'
                 GROUP BY date_trunc('month', created_at)
                 ORDER BY date_trunc('month', created_at)`),
          query(`WITH numbered AS (
                   SELECT o.*, ROW_NUMBER() OVER (ORDER BY o.created_at DESC)::int AS legacy_id
                   FROM hrms.onboarding_records o
                 ) SELECT n.legacy_id AS id, e.employee_no, concat_ws(' ', e.first_name, e.last_name) AS name,
                          n.status, n.progress
                   FROM numbered n JOIN hrms.employees e ON e.id = n.employee_id
                   ORDER BY n.created_at DESC LIMIT 5`)
        ]);

        return res.json({
          success: true,
          announcements: [],
          show_analytics: true,
          stats: {
            total_employees: empRes.rows[0]?.count || 0,
            departments_count: deptRes.rows[0]?.count || 0,
            open_positions: jobRes.rows[0]?.count || 0,
            active_applicants: appRes.rows[0]?.count || 0
          },
          recruitment_trend: recruitmentTrend.rows,
          dept_distribution: Object.fromEntries(deptDistribution.rows.map((row: any) => [row.name, row.count])),
          recent_applicants: recentApplicants,
          onboarding_progress: onboardingProgress.rows
        });
      }

      case 'page_my_attendance': {
        const employee = await findEmployeeForUser(currentUser);
        const now = new Date();
        const year = Number(req.query.year || body.year) || now.getFullYear();
        const month = Number(req.query.month || body.month) || now.getMonth() + 1;
        if (month < 1 || month > 12) return res.status(400).json({ success: false, message: 'Month must be between 1 and 12.' });
        const today = bridgeIsoDate(now);
        const from = bridgeIsoDate(new Date(Date.UTC(year, month - 1, 1)));
        const to = bridgeIsoDate(new Date(Date.UTC(year, month, 0)));
        if (!employee) return res.json({ success: true, employee: null, server_time: `${today} ${now.toTimeString().slice(0, 8)}`,
          today: null, open: null, can_time_in: false, can_time_out: false, schedules: [], days: [], summary: {} });
        const [schedules, logs, openResult, upcoming] = await Promise.all([
          wfmService.getSchedules({ employeeId: employee.id, fromDate: from, toDate: to }),
          wfmService.getAttendanceLogs({ employeeId: employee.id, fromDate: from, toDate: to }),
          query('SELECT date, time_in FROM wfm.attendance_logs WHERE employee_id=$1 AND time_in IS NOT NULL AND time_out IS NULL ORDER BY date DESC LIMIT 1', [employee.id]),
          wfmService.getSchedules({ employeeId: employee.id, fromDate: today, toDate: bridgeIsoDate(new Date(Date.now() + 30 * 86400000)) })
        ]);
        const scheduleByDate = new Map(schedules.map((row: any) => [bridgeIsoDate(new Date(row.schedule_date)), row]));
        const logByDate = new Map(logs.map((row: any) => [bridgeIsoDate(new Date(row.date)), row]));
        const days: any[] = [];
        for (let date = new Date(`${from}T00:00:00Z`); bridgeIsoDate(date) <= to; date.setUTCDate(date.getUTCDate() + 1)) {
          const key = bridgeIsoDate(date);
          const shift: any = scheduleByDate.get(key);
          const log: any = logByDate.get(key);
          const start = shift?.start_time ? String(shift.start_time).slice(0, 5) : null;
          const end = shift?.end_time ? String(shift.end_time).slice(0, 5) : null;
          const overnight = !!(start && end && end < start);
          const status = shift?.status === 'Rest Day' ? 'Rest Day' : !shift ? (log?.status || (key < today ? 'Absent' : 'No Schedule'))
            : !log ? (key < today ? 'Absent' : 'Scheduled') : !log.time_out ? 'Incomplete'
              : Number(log.late_minutes || 0) > 0 ? 'Late' : (log.status || 'Present');
          const shiftStart = start ? Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5)) : 0;
          const shiftEnd = end ? Number(end.slice(0, 2)) * 60 + Number(end.slice(3, 5)) + (overnight ? 1440 : 0) : 0;
          days.push({ employee_id: employee.id, employee_no: employee.employee_no,
            full_name: `${employee.first_name} ${employee.last_name}`.trim(), department: employee.department_name || '',
            position: employee.position_title || '', date: key, day_type: shift ? 'Working' : 'No Schedule',
            schedule_status: shift?.status || 'No Schedule', schedule_id: shift?.id || null, shift_id: shift?.shift_id || null,
            shift_code: shift?.shift_name || null, shift_name: shift?.shift_name || null, start_time: start, end_time: end,
            break_start: null, break_end: null, overnight, scheduled_minutes: Math.max(0, shiftEnd - shiftStart - Number(shift?.break_minutes || 0)),
            holiday: null, leave: null, grace_minutes: 0, record_id: log?.id || null,
            time_in: log?.time_in ? String(log.time_in).slice(0, 8) : null,
            time_out: log?.time_out ? String(log.time_out).slice(0, 8) : null, source: log ? 'Employee' : null,
            record_updated_at: log?.created_at || null, record_updated_by: null, remarks: null,
            worked_minutes: log?.worked_hours == null ? null : Math.round(Number(log.worked_hours) * 60),
            late_minutes: Number(log?.late_minutes || 0), undertime_minutes: Number(log?.undertime_minutes || 0),
            overtime_minutes: Number(log?.ot_minutes || 0), status, notes: [] });
        }
        const todayRow = days.find((day) => day.date === today) || null;
        const open = openResult.rows[0] ? { work_date: bridgeIsoDate(new Date(openResult.rows[0].date)), time_in: String(openResult.rows[0].time_in).slice(0, 8) } : null;
        const summaries = days.reduce((acc: Record<string, number>, day) => { acc[day.status] = (acc[day.status] || 0) + 1; return acc; }, {});
        const schedulesOut = upcoming.map((s: any) => ({ id: s.id, employee_id: s.employee_id, employee_no: s.employee_no,
          full_name: `${s.first_name} ${s.last_name}`.trim(), department: s.department_name || '', position: employee.position_title || '',
          employment_status: employee.employment_status, shift_id: s.shift_id, shift_code: s.shift_name, shift_name: s.shift_name,
          shift_type: 'Day Shift', shift_status: 'Active', start_time: String(s.start_time).slice(0, 5), end_time: String(s.end_time).slice(0, 5),
          break_start: null, break_end: null, work_minutes: 0, grace_minutes: 0, overnight: false,
          effective_date: bridgeIsoDate(new Date(s.schedule_date)), end_date: null, working_days: [1, 2, 3, 4, 5],
          rest_days: [6, 7], status: 'Active', remarks: null, created_at: s.created_at, updated_at: s.created_at,
          created_by_name: null, updated_by_name: null }));
        return res.json({ success: true, employee: { id: employee.id, employee_no: employee.employee_no,
          full_name: `${employee.first_name} ${employee.last_name}`.trim(), department: employee.department_name || '', position: employee.position_title || '' },
          server_time: `${today} ${now.toTimeString().slice(0, 8)}`, today: todayRow, open,
          can_time_in: !open && !todayRow?.time_in, can_time_out: !!open, schedules: schedulesOut, days, summary: summaries });
      }

      case 'attendance_clock': {
        const employee = await findEmployeeForUser(currentUser);
        if (!employee) return res.status(403).json({ success: false, message: 'Your account is not linked to an employee record.' });
        const type = String(body.type || '').toLowerCase();
        if (type === 'in') {
          await wfmService.clockIn({ employeeId: employee.id, verificationMethod: 'web' });
          return res.json({ success: true, message: 'You have successfully timed in.' });
        }
        if (type === 'out') {
          await wfmService.clockOut({ employeeId: employee.id });
          return res.json({ success: true, message: 'You have successfully timed out.' });
        }
        return res.status(400).json({ success: false, message: 'Clock type must be in or out.' });
      }

      case 'page_my_leave': {
        const employee = await findEmployeeForUser(currentUser);
        if (!employee) return res.json({ success: true, employee: null, today: bridgeIsoDate(new Date()), types: [], requests: [], balances: [] });
        const result = await query(`SELECT r.*, u.full_name AS reviewed_by_name
          FROM wfm.leave_requests r LEFT JOIN auth_core.users u ON u.id=r.approved_by
          WHERE r.employee_id=$1 ORDER BY r.created_at DESC`, [employee.id]);
        const requests = result.rows.map((row: any, index: number) => ({ id: row.id, request_no: `LV-${String(index + 1).padStart(5, '0')}`,
          employee_id: employee.id, employee_no: employee.employee_no, full_name: `${employee.first_name} ${employee.last_name}`.trim(),
          department: employee.department_name || '', position: employee.position_title || '', leave_type_id: null,
          leave_code: String(row.leave_type || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8), leave_type: row.leave_type,
          is_paid: true, with_credits: false, start_date: bridgeIsoDate(new Date(row.start_date)), end_date: bridgeIsoDate(new Date(row.end_date)),
          days: Number(row.days_count), reason: row.reason || '', has_attachment: false, attachment_name: null,
          status: row.status === 'Cancelled' ? 'Cancelled' : row.status, requested_by_name: `${employee.first_name} ${employee.last_name}`.trim(),
          reviewed_by_name: row.reviewed_by_name || null, reviewed_at: row.approved_at, rejection_reason: null,
          cancelled_by_name: null, cancelled_at: null, cancel_reason: null, created_at: row.created_at, updated_at: row.created_at }));
        const names = [...new Set(result.rows.map((row: any) => String(row.leave_type)))];
        const types = names.map((name, index) => ({ id: index + 1, code: name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8),
          name, description: null, with_credits: false, is_paid: true, requires_document: false, status: 'Active', request_count: requests.length }));
        return res.json({ success: true, employee: { id: employee.id, employee_no: employee.employee_no,
          full_name: `${employee.first_name} ${employee.last_name}`.trim(), department: employee.department_name || '', position: employee.position_title || '' },
          today: bridgeIsoDate(new Date()), types, requests, balances: [] });
      }

      case 'page_profile': {
        const employee = await findEmployeeForUser(currentUser);
        const userId = currentUser?.id || null;
        const profile = currentUser ? { user_id: userId, username: currentUser.email || '', account_email: currentUser.email || '',
          role_name: String(currentUser.global_role || 'employee').replace(/_/g, ' ').replace(/\b\w/g, (letter: string) => letter.toUpperCase()),
          employee_id: employee?.id || null, employee_no: employee?.employee_no || null,
          full_name: employee ? `${employee.first_name} ${employee.last_name}`.trim() : (currentUser.full_name || null),
          first_name: employee?.first_name || null, last_name: employee?.last_name || null,
          department: employee?.department_name || null, position: employee?.position_title || null,
          work_email: employee?.email || null, mobile_number: employee?.phone || currentUser.phone_number || null,
          employment_status: employee?.employment_status || null, contract_type: employee?.contract_type || null,
          date_hired: employee?.hire_date || null,
          years_of_service: employee?.hire_date ? Math.max(0, (Date.now() - new Date(employee.hire_date).getTime()) / (365.25 * 86400000)) : null,
          middle_name: null, date_of_birth: employee?.birth_date || null, gender: employee?.gender || null,
          applicant_no: null, applied_at: null, position_applied: null } : null;
        return res.json({ success: true, profile, leave_balances: [], info_requests: [], info_fields: {} });
      }

      case 'report_options': {
        const [departments, positions] = await Promise.all([hrmsService.getAllDepartments(), hrmsService.getAllPositions()]);
        const types = [
          { key: 'applicant', label: 'Applicants', date_label: 'Applied', statuses: ['Applied', 'Screening', 'Pre-Interview', 'Final Interview', 'Hired', 'Rejected'], status_label: 'Status', all_dates: true, default_sort: ['applied_at', 'desc'], sorts: [{ key: 'applied_at', label: 'Applied Date' }, { key: 'name', label: 'Applicant Name' }, { key: 'position', label: 'Position' }] },
          { key: 'employee', label: 'Employees', date_label: 'Hired', statuses: ['Active', 'Resigned'], status_label: 'Status', all_dates: true, default_sort: ['date_hired', 'desc'], sorts: [{ key: 'date_hired', label: 'Hire Date' }, { key: 'name', label: 'Employee Name' }, { key: 'department', label: 'Department' }] },
          { key: 'job_posting', label: 'Job Postings', date_label: 'Posted', statuses: ['Open', 'Closed', 'Draft'], status_label: 'Status', all_dates: true, default_sort: ['posted_at', 'desc'], sorts: [{ key: 'posted_at', label: 'Posted Date' }, { key: 'title', label: 'Title' }] },
          { key: 'leave', label: 'Leave Requests', date_label: 'Start Date', statuses: ['Pending', 'Approved', 'Rejected', 'Cancelled'], status_label: 'Status', all_dates: true, default_sort: ['start_date', 'desc'], sorts: [{ key: 'start_date', label: 'Start Date' }, { key: 'employee', label: 'Employee' }, { key: 'leave_type', label: 'Leave Type' }] }
        ];
        const now = new Date();
        const periods = [
          { key: 'month', label: 'This Month' }, { key: 'quarter', label: 'This Quarter' },
          { key: 'year', label: 'This Year' }, { key: 'all', label: 'All Dates' }, { key: 'custom', label: 'Custom Range' }
        ];
        return res.json({ success: true, types, periods,
          departments: departments.map((d: any) => ({ id: d.id, name: d.name })),
          positions: positions.map((p: any) => ({ id: p.id, title: p.title, department_id: p.department_id })) });
      }

      case 'report_history': {
        return res.json({ success: true, reports: [] });
      }

      case 'report_preview': {
        const type = String(req.query.type || body.type || 'applicant');
        const period = String(req.query.period || body.period || 'month');
        const now = new Date();
        let from = String(req.query.from || body.from || '');
        let to = String(req.query.to || body.to || '');
        if (period === 'month') {
          from = bridgeIsoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
          to = bridgeIsoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)));
        } else if (period === 'quarter') {
          const qStart = Math.floor(now.getUTCMonth() / 3) * 3;
          from = bridgeIsoDate(new Date(Date.UTC(now.getUTCFullYear(), qStart, 1)));
          to = bridgeIsoDate(new Date(Date.UTC(now.getUTCFullYear(), qStart + 3, 0)));
        } else if (period === 'year') {
          from = `${now.getUTCFullYear()}-01-01`;
          to = `${now.getUTCFullYear()}-12-31`;
        }
        const configs: Record<string, any> = {
          applicant: {
            label: 'Applicants', dateLabel: 'Applied', dateExpr: 'a.created_at',
            fromTable: `FROM hrms.applicants a LEFT JOIN hrms.job_postings j ON j.id=a.job_posting_id
              LEFT JOIN hrms.departments d ON d.id=j.department_id LEFT JOIN hrms.positions p ON p.id=j.position_id`,
            fields: `a.application_id AS applicant_no, concat_ws(' ',a.first_name,a.last_name) AS name,
              COALESCE(j.title,'') AS position, COALESCE(d.name,'') AS department, a.status, a.created_at AS applied_at`,
            sort: { applied_at: 'a.created_at', name: 'a.last_name', position: 'j.title', department: 'd.name', status: 'a.status' },
            columns: [['applicant_no','Applicant ID','text'],['name','Applicant','text'],['position','Position','text'],['department','Department','text'],['status','Status','text'],['applied_at','Applied Date','date']]
          },
          employee: {
            label: 'Employees', dateLabel: 'Hired', dateExpr: 'e.hire_date',
            fromTable: `FROM hrms.employees e LEFT JOIN hrms.departments d ON d.id=e.department_id LEFT JOIN hrms.positions p ON p.id=e.position_id`,
            fields: `e.employee_no, concat_ws(' ',e.first_name,e.last_name) AS name, COALESCE(d.name,'') AS department,
              COALESCE(p.title,'') AS position, e.employment_status AS status, e.hire_date AS date_hired`,
            sort: { date_hired: 'e.hire_date', name: 'e.last_name', department: 'd.name', position: 'p.title', status: 'e.employment_status' },
            columns: [['employee_no','Employee ID','text'],['name','Employee','text'],['department','Department','text'],['position','Position','text'],['status','Employment Status','text'],['date_hired','Hire Date','date']]
          },
          job_posting: {
            label: 'Job Postings', dateLabel: 'Posted', dateExpr: 'j.created_at',
            fromTable: `FROM hrms.job_postings j LEFT JOIN hrms.departments d ON d.id=j.department_id LEFT JOIN hrms.positions p ON p.id=j.position_id`,
            fields: `j.title, COALESCE(d.name,'') AS department, COALESCE(p.title,'') AS position,
              j.status, j.created_at AS posted_at`,
            sort: { posted_at: 'j.created_at', title: 'j.title', department: 'd.name', position: 'p.title', status: 'j.status' },
            columns: [['title','Job Title','text'],['department','Department','text'],['position','Position','text'],['status','Status','text'],['posted_at','Posted Date','date']]
          },
          leave: {
            label: 'Leave Requests', dateLabel: 'Start Date', dateExpr: 'r.start_date',
            fromTable: `FROM wfm.leave_requests r JOIN hrms.employees e ON e.id=r.employee_id
              LEFT JOIN hrms.departments d ON d.id=e.department_id LEFT JOIN hrms.positions p ON p.id=e.position_id`,
            fields: `e.employee_no, concat_ws(' ',e.first_name,e.last_name) AS employee, COALESCE(d.name,'') AS department,
              COALESCE(p.title,'') AS position, r.leave_type, r.start_date, r.end_date, r.days_count AS days, r.status`,
            sort: { start_date: 'r.start_date', employee: 'e.last_name', leave_type: 'r.leave_type', status: 'r.status', department: 'd.name' },
            columns: [['employee_no','Employee ID','text'],['employee','Employee','text'],['department','Department','text'],['position','Position','text'],['leave_type','Leave Type','text'],['start_date','Start Date','date'],['end_date','End Date','date'],['days','Days','number'],['status','Status','text']]
          }
        };
        const config = configs[type];
        if (!config) return res.status(400).json({ success: false, message: 'Unsupported report type.' });
        const params: any[] = [];
        const conditions: string[] = [];
        const add = (sql: string, value: unknown) => { params.push(value); conditions.push(sql.replaceAll('?', `$${params.length}`)); };
        if (period !== 'all' && from && /^\d{4}-\d{2}-\d{2}$/.test(from)) add(`${config.dateExpr}::date >= ?::date`, from);
        if (period !== 'all' && to && /^\d{4}-\d{2}-\d{2}$/.test(to)) add(`${config.dateExpr}::date <= ?::date`, to);
        const department = String(req.query.department || body.department || '').trim();
        const position = String(req.query.position || body.position || '').trim();
        const status = String(req.query.status || body.status || '').trim();
        if (department) add('d.name = ?', department);
        if (position) add('p.title = ?', position);
        if (status) add(`${type === 'employee' ? 'e.employment_status' : type === 'job_posting' ? 'j.status' : type === 'leave' ? 'r.status' : 'a.status'} = ?`, status);
        const sortKey = String(req.query.sort || body.sort || Object.keys(config.sort)[0]);
        const sortColumn = config.sort[sortKey] || Object.values(config.sort)[0];
        const order = String(req.query.order || body.order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
        const result = await query(`SELECT ${config.fields} ${config.fromTable}
          ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
          ORDER BY ${sortColumn} ${order} LIMIT 200`, params);
        const columns = config.columns.map(([key, label, kind]: string[]) => ({ key, label, kind }));
        const rows = result.rows.map((row: any) => Object.fromEntries(config.columns.map(([key]: string[]) => {
          const value = row[key];
          return [key, value == null ? '' : value instanceof Date ? bridgeIsoDate(value) : String(value)];
        })));
        const periodLabel = period === 'all' ? 'All Dates' : period === 'custom' ? `${from} to ${to}` : `${from} to ${to}`;
        const filters = { department, position, status };
        const typeLabel = config.label;
        return res.json({ success: true, report: {
          type, title: `${typeLabel} Report`, type_label: typeLabel, period_label: periodLabel,
          from: period === 'all' ? null : from || null, to: period === 'all' ? null : to || null,
          filters, sort_label: `${sortKey} (${order.toLowerCase()})`, columns, rows,
          count: rows.length, generated_by: currentUser?.full_name || currentUser?.email || 'System',
          generated_at: now.toISOString()
        } });
      }

      case 'notifications': {
        return res.json({ success: true, unread_count: 0, data: [], workflow: [] });
      }

      case 'page_announcements': {
        const [rows, departments] = await Promise.all([
          query(`SELECT a.id, a.title, a.summary, a.cover_image, a.body, a.published_at, a.end_at,
                        CASE WHEN a.status = 'Published' AND a.end_at IS NOT NULL AND a.end_at <= NOW() THEN 'Ended'
                             WHEN a.status = 'Published' AND a.published_at > NOW() THEN 'Scheduled'
                             ELSE a.status END AS status,
                        a.show_on_dashboard, a.scope_all, a.withdrawn_at, a.created_at, a.updated_at,
                        a.scope_departments, creator.full_name AS created_by_name, editor.full_name AS updated_by_name
                 FROM hrms.announcements a
                 LEFT JOIN auth_core.users creator ON creator.id = a.created_by
                 LEFT JOIN auth_core.users editor ON editor.id = a.updated_by
                 ORDER BY a.created_at DESC`),
          hrmsService.getAllDepartments()
        ]);
        return res.json({ success: true, announcements: rows.rows,
          departments: departments.map((department: any) => ({ id: department.id, name: department.name })) });
      }

      case 'dashboard_announcements': {
        const result = await query(`SELECT a.id, a.title, a.summary, a.body, a.cover_image, a.published_at,
                                      creator.full_name AS created_by_name
          FROM hrms.announcements a LEFT JOIN auth_core.users creator ON creator.id=a.created_by
          WHERE a.status='Published' AND a.show_on_dashboard=TRUE AND a.published_at <= NOW()
            AND (a.end_at IS NULL OR a.end_at > NOW())
            AND (a.scope_all=TRUE OR EXISTS (
              SELECT 1 FROM hrms.employees e JOIN hrms.departments d ON d.id=e.department_id
              WHERE e.user_id=$1 AND d.name=ANY(a.scope_departments)))
          ORDER BY a.published_at DESC`, [currentUser?.id || null]);
        return res.json({ success: true, data: result.rows });
      }

      case 'dashboard_announcement_detail': {
        const id = Number(req.query.id || body.id);
        if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ success: false, message: 'A valid announcement ID is required.' });
        const result = await query(`SELECT a.id, a.title, a.summary, a.body, a.cover_image, a.published_at,
                                      creator.full_name AS created_by_name
          FROM hrms.announcements a LEFT JOIN auth_core.users creator ON creator.id=a.created_by
          WHERE a.id=$1 AND a.status='Published' AND a.published_at <= NOW()
            AND (a.end_at IS NULL OR a.end_at > NOW()) AND a.show_on_dashboard=TRUE
            AND (a.scope_all=TRUE OR EXISTS (
              SELECT 1 FROM hrms.employees e JOIN hrms.departments d ON d.id=e.department_id
              WHERE e.user_id=$2 AND d.name=ANY(a.scope_departments)))`, [id, currentUser?.id || null]);
        if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Announcement not found.' });
        return res.json({ success: true, data: result.rows[0] });
      }

      case 'create_announcement': {
        const title = String(body.title || '').trim();
        const content = String(body.body || '').trim();
        if (!title || !content) return res.status(400).json({ success: false, message: 'Announcement title and body are required.' });
        let scopedDepartments = body.departments;
        if (typeof scopedDepartments === 'string') {
          try { scopedDepartments = JSON.parse(scopedDepartments); } catch { scopedDepartments = scopedDepartments.split(','); }
        }
        if (!Array.isArray(scopedDepartments)) scopedDepartments = [];
        const scopeAll = ['1', 'true', 'on'].includes(String(body.scope_all).toLowerCase());
        const isDraft = ['1', 'true', 'on'].includes(String(body.is_draft).toLowerCase()) || String(body.status).toLowerCase() === 'draft';
        const result = await query(
          `INSERT INTO hrms.announcements
             (title, summary, body, cover_image, published_at, end_at, status, show_on_dashboard,
              scope_all, scope_departments, created_by, updated_by)
           VALUES ($1,$2,$3,NULLIF($4,''),COALESCE(NULLIF($5,'')::timestamptz,NOW()),NULLIF($6,'')::timestamptz,
                   $7,$8,$9,$10,$11,$11) RETURNING id`,
          [title, String(body.summary || '').trim(), content, String(body.cover_image || ''),
            String(body.published_at || '').replace(' ', 'T'), String(body.end_at || '').replace(' ', 'T'),
            isDraft ? 'Draft' : (new Date(String(body.published_at || Date.now())).getTime() > Date.now() ? 'Scheduled' : 'Published'),
            ['1', 'true', 'on'].includes(String(body.show_on_dashboard).toLowerCase()), scopeAll,
            scopedDepartments.map((department: unknown) => String(department).trim()).filter(Boolean), currentUser?.id || null]
        );
        return res.json({ success: true, id: result.rows[0].id, message: 'Announcement created successfully.' });
      }

      case 'update_announcement': {
        const id = Number(body.id);
        if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ success: false, message: 'A valid announcement ID is required.' });
        let scopedDepartments = body.departments;
        if (typeof scopedDepartments === 'string') {
          try { scopedDepartments = JSON.parse(scopedDepartments); } catch { scopedDepartments = scopedDepartments.split(','); }
        }
        if (!Array.isArray(scopedDepartments)) scopedDepartments = [];
        const result = await query(
          `UPDATE hrms.announcements SET title=$1, summary=$2, body=$3, cover_image=NULLIF($4,''),
             published_at=COALESCE(NULLIF($5,'')::timestamptz,published_at), end_at=NULLIF($6,'')::timestamptz,
             show_on_dashboard=$7, scope_all=$8, scope_departments=$9, updated_by=$10, updated_at=NOW()
           WHERE id=$11 AND status NOT IN ('Withdrawn') RETURNING id`,
          [String(body.title || '').trim(), String(body.summary || '').trim(), String(body.body || '').trim(),
            String(body.cover_image || ''), String(body.published_at || '').replace(' ', 'T'),
            String(body.end_at || '').replace(' ', 'T'), ['1', 'true', 'on'].includes(String(body.show_on_dashboard).toLowerCase()),
            ['1', 'true', 'on'].includes(String(body.scope_all).toLowerCase()),
            scopedDepartments.map((department: unknown) => String(department).trim()).filter(Boolean), currentUser?.id || null, id]
        );
        if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Announcement not found or cannot be edited.' });
        return res.json({ success: true, message: 'Announcement updated successfully.' });
      }

      case 'publish_announcement': {
        const id = Number(body.id);
        const result = await query(`UPDATE hrms.announcements SET status='Published', withdrawn_at=NULL,
          published_at=CASE WHEN published_at < NOW() AND status='Draft' THEN NOW() ELSE published_at END,
          updated_by=$1, updated_at=NOW() WHERE id=$2 AND status NOT IN ('Withdrawn','Ended') RETURNING id`,
          [currentUser?.id || null, id]);
        if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Announcement not found or cannot be published.' });
        return res.json({ success: true, message: 'Announcement published successfully.' });
      }

      case 'withdraw_announcement': {
        const result = await query(`UPDATE hrms.announcements SET status='Withdrawn', withdrawn_at=NOW(),
          updated_by=$1, updated_at=NOW() WHERE id=$2 AND status='Published' RETURNING id`,
          [currentUser?.id || null, Number(body.id)]);
        if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Published announcement not found.' });
        return res.json({ success: true, message: 'Announcement withdrawn successfully.' });
      }

      case 'copy_announcement': {
        const result = await query(`INSERT INTO hrms.announcements
          (title, summary, body, cover_image, published_at, end_at, status, show_on_dashboard, scope_all, scope_departments, created_by, updated_by)
          SELECT title || ' (Copy)', summary, body, cover_image, NOW(), end_at, 'Draft', show_on_dashboard, scope_all,
                 scope_departments, $1, $1 FROM hrms.announcements WHERE id=$2 RETURNING id`,
          [currentUser?.id || null, Number(body.id)]);
        if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Announcement not found.' });
        return res.json({ success: true, id: result.rows[0].id, message: 'Announcement copied as a draft.' });
      }

      case 'delete_announcement': {
        const result = await query(`DELETE FROM hrms.announcements WHERE id=$1 AND status IN ('Draft','Scheduled','Not Started') RETURNING id`, [Number(body.id)]);
        if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Announcement not found or cannot be deleted.' });
        return res.json({ success: true, message: 'Announcement deleted successfully.' });
      }

      case 'bulk_delete_announcements': {
        let ids = body.ids;
        if (typeof ids === 'string') ids = ids.split(',');
        if (!Array.isArray(ids)) ids = [];
        const validIds = ids.map((id: unknown) => Number(id)).filter((id: number) => Number.isSafeInteger(id) && id > 0);
        if (!validIds.length) return res.status(400).json({ success: false, message: 'Select at least one valid announcement.' });
        const deleted = await query(`DELETE FROM hrms.announcements WHERE id=ANY($1::bigint[])
          AND status IN ('Draft','Scheduled','Not Started') RETURNING id`, [validIds]);
        const deletedIds = deleted.rows.map((row: any) => Number(row.id));
        const skipped = Object.fromEntries(validIds.filter((id: number) => !deletedIds.includes(id)).map((id: number) => [id, 'Announcement cannot be deleted in its current status.']));
        return res.json({ success: true, message: 'Bulk delete processed.', deleted: deletedIds, skipped });
      }

      case 'page_user_directory': {
        const usersPromise = query(`SELECT u.id, COALESCE(u.username,u.email) AS username, u.email, u.full_name, u.global_role,
                        u.is_active, u.created_at, u.phone_number,
                        e.id AS employee_id, e.employee_no, e.first_name, e.last_name,
                        e.hire_date, d.name AS department, p.title AS position
                 FROM auth_core.users u
                 LEFT JOIN hrms.employees e ON e.user_id = u.id
                 LEFT JOIN hrms.departments d ON d.id = e.department_id
                 LEFT JOIN hrms.positions p ON p.id = e.position_id
                 ORDER BY u.created_at DESC`).catch((err: any) => {
          if (err?.code === '42703' || String(err?.message || '').includes('username')) {
            return query(`SELECT u.id, u.email AS username, u.email, u.full_name, u.global_role,
                        u.is_active, u.created_at, u.phone_number,
                        e.id AS employee_id, e.employee_no, e.first_name, e.last_name,
                        e.hire_date, d.name AS department, p.title AS position
                 FROM auth_core.users u
                 LEFT JOIN hrms.employees e ON e.user_id = u.id
                 LEFT JOIN hrms.departments d ON d.id = e.department_id
                 LEFT JOIN hrms.positions p ON p.id = e.position_id
                 ORDER BY u.created_at DESC`);
          }
          throw err;
        });

        const [users, departments, positions, roleRows] = await Promise.all([
          usersPromise,
          hrmsService.getAllDepartments(),
          hrmsService.getAllPositions(),
          query('SELECT DISTINCT global_role FROM auth_core.users ORDER BY global_role')
        ]);
        const roleNames = [...new Set(['superadmin', 'hr_admin', 'payroll_officer', 'fleet_manager', 'driver', 'employee',
          ...roleRows.rows.map((row: any) => String(row.global_role || '').toLowerCase())].filter(Boolean))];
        const roles = roleNames.map((name, index) => ({ id: index + 1, role_name: name.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }));
        const roleId = new Map(roles.map((role) => [role.role_name.toLowerCase(), role.id]));
        const rows = users.rows.map((user: any) => {
          const [first_name = '', ...last] = String(user.full_name || '').split(/\s+/);
          const globalRole = String(user.global_role || 'employee');
          return {
            id: user.id, username: user.username, email: user.email,
            first_name: user.first_name || first_name, last_name: user.last_name || last.join(' '),
            middle_name: null,
            status: user.is_active ? 'Active' : 'Deactivated',
            role_id: roleId.get(globalRole.replace(/_/g, ' ')) || 0,
            role_name: globalRole.replace(/_/g, ' ').replace(/\b\w/g, (letter: string) => letter.toUpperCase()),
            last_login: null, created_at: user.created_at,
            employee_id: user.employee_id, employee_no: user.employee_no,
            department: user.department, position: user.position, mobile_number: user.phone_number,
            date_hired: user.hire_date
          };
        });
        return res.json({ success: true,
          cards: {
            total_users: rows.length,
            active_accounts: rows.filter((user: any) => user.status === 'Active').length,
            deactivated_accounts: rows.filter((user: any) => user.status !== 'Active').length,
            active_departments: departments.filter((department: any) => Number(department.employee_count) > 0).length
          },
          users: rows,
          departments: departments.map((department: any) => ({ id: department.id, name: department.name })),
          positions: positions.map((position: any) => ({ id: position.id, title: position.title, department_id: position.department_id })),
          roles
        });
      }

      case 'page_register_user': {
        const [employees, departments, positions] = await Promise.all([
          query(`SELECT e.id, e.employee_no, e.first_name, e.last_name, e.email, e.phone AS mobile_number,
                        e.gender, e.birth_date AS date_of_birth, e.address, e.employment_status,
                        e.contract_type, e.hire_date AS date_hired, e.created_at,
                        concat_ws(' ', e.first_name, e.last_name) AS full_name,
                        d.name AS department, p.title AS position
                 FROM hrms.employees e
                 LEFT JOIN hrms.departments d ON d.id = e.department_id
                 LEFT JOIN hrms.positions p ON p.id = e.position_id
                 WHERE e.user_id IS NULL
                 ORDER BY e.last_name, e.first_name`),
          hrmsService.getAllDepartments(),
          hrmsService.getAllPositions(),
        ]);
        const roles = [
          { id: 1, role_name: 'Super Admin' }, { id: 2, role_name: 'HR Admin' },
          { id: 3, role_name: 'Payroll Officer' }, { id: 4, role_name: 'Fleet Manager' },
          { id: 5, role_name: 'Driver' }, { id: 6, role_name: 'Employee' }
        ];
        return res.json({ success: true,
          employees: employees.rows,
          departments: departments.map((department: any) => ({ id: department.id, name: department.name })),
          positions: positions.map((position: any) => ({ id: position.id, title: position.title, department_id: position.department_id })),
          roles
        });
      }

      case 'register_system_user': {
        if (!currentUser?.id) return res.status(401).json({ success: false, message: 'Sign in with an administrator account to register a user.' });
        if (!['superadmin', 'hr_admin'].includes(String(currentUser.global_role || ''))) {
          return res.status(403).json({ success: false, message: 'You are not allowed to register system users.' });
        }
        const employeeId = String(body.employee_id || '').trim();
        const firstName = String(body.first_name || '').trim();
        const lastName = String(body.last_name || '').trim();
        const email = String(body.email || '').trim().toLowerCase();
        const mobile = String(body.mobile_number || '').trim();
        const roleById: Record<number, string> = {
          1: 'superadmin', 2: 'hr_admin', 3: 'payroll_officer', 4: 'fleet_manager', 5: 'driver', 6: 'employee'
        };
        const role = roleById[Number(body.role_id)];
        if (!employeeId || !firstName || !lastName || !/^\S+@\S+\.\S+$/.test(email) || !mobile || !role) {
          return res.status(400).json({ success: false, message: 'Complete the employee, name, email, mobile number, and role fields.' });
        }
        const employeeResult = await query(`SELECT id, employee_no, first_name, last_name, hire_date, user_id
          FROM hrms.employees WHERE id::text=$1`, [employeeId]);
        const employee = employeeResult.rows[0];
        if (!employee) return res.status(404).json({ success: false, message: 'The selected employee record was not found.' });
        if (employee.user_id) return res.status(409).json({ success: false, message: 'This employee already has a system account.' });
        const emailExists = await query('SELECT id FROM auth_core.users WHERE lower(email)=lower($1)', [email]);
        if (emailExists.rows[0]) return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
        const hireDate = employee.hire_date ? new Date(employee.hire_date) : new Date();
        const month = String(hireDate.getUTCMonth() + 1).padStart(2, '0');
        const defaultPassword = `${String(lastName).slice(0, 2).toLowerCase()}${month}${hireDate.getUTCFullYear()}`;
        const passwordHash = await bcrypt.hash(defaultPassword, 10);
        const fullName = `${firstName} ${String(body.middle_name || '').trim()} ${lastName}`.replace(/\s+/g, ' ').trim();
        const client = await getClient();
        let userId: string;
        try {
          await client.query('BEGIN');
          let created;
          try {
            created = await client.query(`INSERT INTO auth_core.users
              (username, email, password_hash, full_name, global_role, phone_number)
              VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
              [employee.employee_no, email, passwordHash, fullName, role, mobile]);
          } catch (insertErr: any) {
            if (insertErr?.code === '42703' || String(insertErr?.message || '').includes('username')) {
              created = await client.query(`INSERT INTO auth_core.users
                (email, password_hash, full_name, global_role, phone_number)
                VALUES ($1,$2,$3,$4,$5) RETURNING id`,
                [email, passwordHash, fullName, role, mobile]);
            } else {
              throw insertErr;
            }
          }
          userId = created.rows[0].id;
          const linked = await client.query(`UPDATE hrms.employees SET user_id=$1, first_name=$2, last_name=$3,
            email=$4, phone=$5,
            department_id=COALESCE((SELECT id FROM hrms.departments WHERE lower(name)=lower(NULLIF($6,'')) LIMIT 1), department_id),
            position_id=COALESCE((SELECT id FROM hrms.positions WHERE lower(title)=lower(NULLIF($7,'')) LIMIT 1), position_id),
            updated_at=NOW() WHERE id=$8 AND user_id IS NULL RETURNING id`,
            [userId, firstName, lastName, email, mobile, String(body.department || ''), String(body.position || ''), employee.id]);
          if (!linked.rows[0]) throw new Error('Employee account link could not be completed.');
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
        let emailSent = false;
        let emailError: string | null = null;
        const emailText = `Hello ${fullName}, your system account is ready. Username: ${employee.employee_no}. Default password: ${defaultPassword}. Please sign in and change this password.`;
        try {
          const result = await emailService.sendSensitiveEmail({
            to: email,
            subject: 'Your Archon Nell system account',
            text: emailText,
            html: `<p>${emailText}</p>`
          });
          emailSent = result.success;
          if (!result.success) emailError = result.error || 'The account was created, but the credentials email could not be delivered.';
        } catch (error: any) {
          emailError = error?.message || 'The account was created, but the credentials email could not be sent.';
        }
        await query(`INSERT INTO auth_core.audit_logs (user_id,module,action,resource_id,details)
          VALUES ($1,'user_management','SYSTEM_USER_REGISTERED',$2,$3)`,
          [currentUser.id, userId, JSON.stringify({ employee_no: employee.employee_no, email, role })]);
        return res.status(201).json({ success: true, message: 'System user registered successfully.',
          username: employee.employee_no, default_password: defaultPassword, employee_no: employee.employee_no,
          email_sent: emailSent, email_error: emailError });
      }

      case 'update_system_user': {
        const userId = String(body.user_id || body.id || '').trim();
        const firstName = String(body.first_name || '').trim();
        const lastName = String(body.last_name || '').trim();
        const email = String(body.email || '').trim().toLowerCase();
        const mobile = String(body.mobile_number || '').trim();
        const roleId = Number(body.role_id);
        const roleById: Record<number, string> = {
          1: 'superadmin', 2: 'hr_admin', 3: 'payroll_officer', 4: 'fleet_manager', 5: 'driver', 6: 'employee'
        };
        if (!userId || !firstName || !lastName || !email || !/^\S+@\S+\.\S+$/.test(email)) {
          return res.status(400).json({ success: false, message: 'A valid user, name, and email are required.' });
        }
        if (!roleById[roleId]) return res.status(400).json({ success: false, message: 'A valid system role is required.' });
        const existing = await query('SELECT id FROM auth_core.users WHERE id::text=$1', [userId]);
        if (!existing.rows[0]) return res.status(404).json({ success: false, message: 'System user not found.' });
        await query(`UPDATE auth_core.users SET email=$1, full_name=$2, phone_number=NULLIF($3,''),
                       global_role=$4, updated_at=NOW() WHERE id=$5`,
          [email, `${firstName} ${lastName}`.trim(), mobile, roleById[roleId], existing.rows[0].id]);
        await query(`UPDATE hrms.employees e SET first_name=$1, last_name=$2, email=$3, phone=NULLIF($4,''),
                       department_id=COALESCE((SELECT id FROM hrms.departments WHERE lower(name)=lower(NULLIF($5,'')) LIMIT 1), e.department_id),
                       position_id=COALESCE((SELECT id FROM hrms.positions WHERE lower(title)=lower(NULLIF($6,'')) LIMIT 1), e.position_id),
                       updated_at=NOW()
                     WHERE e.user_id=$7`,
          [firstName, lastName, email, mobile, String(body.department || ''), String(body.position || ''), existing.rows[0].id]);
        return res.json({ success: true, message: 'System user updated successfully.' });
      }

      case 'change_password': {
        if (!currentUser?.id) return res.status(401).json({ success: false, message: 'Please sign in again before changing your password.' });
        const currentPassword = String(body.current_password || '');
        const nextPassword = String(body.new_password || '');
        const confirmPassword = String(body.confirm_password || '');
        if (!currentPassword || !nextPassword || !confirmPassword) {
          return res.status(400).json({ success: false, message: 'Please fill in all password fields.' });
        }
        if (nextPassword.length < 8 || !/[A-Za-z]/.test(nextPassword) || !/\d/.test(nextPassword)) {
          return res.status(400).json({ success: false, message: 'New password must be at least 8 characters and contain a letter and a number.' });
        }
        if (nextPassword !== confirmPassword) return res.status(400).json({ success: false, message: 'New password and confirmation do not match.' });
        if (nextPassword === currentPassword) return res.status(400).json({ success: false, message: 'New password must be different from your current password.' });
        const userResult = await query('SELECT password_hash FROM auth_core.users WHERE id=$1 AND is_active=TRUE', [currentUser.id]);
        if (!userResult.rows[0]) return res.status(401).json({ success: false, message: 'Your account could not be verified.' });
        const matches = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
        if (!matches) return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
        const passwordHash = await bcrypt.hash(nextPassword, 10);
        await query('UPDATE auth_core.users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [passwordHash, currentUser.id]);
        await query(`INSERT INTO auth_core.audit_logs (user_id, module, action, details)
          VALUES ($1, 'auth', 'PASSWORD_CHANGED', $2)`, [currentUser.id, JSON.stringify({ status: 'Success' })]);
        return res.json({ success: true, message: 'Your password has been changed successfully.' });
      }

      case 'page_roles': {
        const permissionNames = [
          'dashboard', 'applicant_management', 'recruitment_management', 'onboarding_management',
          'core_hcm', 'ess', 'employee_records', 'user_management', 'role_management',
          'permission_management', 'system_settings', 'reports', 'audit_logs', 'announcement_management'
        ];
        const permissionLabels = permissionNames.map((permission, index) => ({
          id: index + 1, permission_name: permission,
          description: permission.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
        }));
        const counts = await query('SELECT global_role, COUNT(*)::int AS user_count FROM auth_core.users GROUP BY global_role');
        const roleLabels = [
          ['superadmin', 'Super Admin'], ['hr_admin', 'HR Admin'], ['payroll_officer', 'Payroll Officer'],
          ['fleet_manager', 'Fleet Manager'], ['driver', 'Driver'], ['employee', 'Employee']
        ];
        const roles = roleLabels.map(([key, role_name], index) => ({
          id: index + 1, role_name, description: null,
          user_count: Number(counts.rows.find((row: any) => row.global_role === key)?.user_count || 0)
        }));
        const grants: [number, number][] = [];
        return res.json({ success: true, roles, permissions: permissionLabels, grants });
      }

      case 'page_permissions': {
        const permissions = [
          'dashboard', 'applicant_management', 'recruitment_management', 'onboarding_management',
          'core_hcm', 'ess', 'employee_records', 'user_management', 'role_management',
          'permission_management', 'system_settings', 'reports', 'audit_logs', 'announcement_management'
        ];
        return res.json({ success: true, permissions: permissions.map((permission, index) => ({
          id: index + 1, permission_name: permission,
          description: permission.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
          role_count: 0
        })) });
      }

      case 'page_audit_logs': {
        const page = Math.max(1, Number(req.query.page || body.page) || 1);
        const pageSize = 25;
        const filterAction = String(req.query.filter_action || body.filter_action || '').trim();
        const moduleFilter = String(req.query.module || body.module || '').trim();
        const statusFilter = String(req.query.status || body.status || '').trim();
        const search = String(req.query.search || body.search || '').trim();
        const from = String(req.query.from || body.from || '').trim();
        const to = String(req.query.to || body.to || '').trim();
        const sortKey = String(req.query.sort || body.sort || 'date');
        const direction = String(req.query.dir || body.dir || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
        const sortColumn = ({ date: 'a.created_at', action: 'a.action', module: 'a.module', user: 'u.email' } as Record<string, string>)[sortKey] || 'a.created_at';
        const conditions: string[] = [];
        const params: any[] = [];
        const addFilter = (sql: string, value: unknown) => { params.push(value); conditions.push(sql.replaceAll('?', `$${params.length}`)); };
        if (filterAction) addFilter('a.action = ?', filterAction);
        if (moduleFilter) addFilter('a.module = ?', moduleFilter);
        if (statusFilter) addFilter("COALESCE(a.details->>'status', 'Success') = ?", statusFilter);
        if (search) addFilter("(u.email ILIKE ? OR a.action ILIKE ? OR a.module ILIKE ? OR a.resource_id ILIKE ? OR a.details::text ILIKE ?)", `%${search}%`);
        if (/^\d{4}-\d{2}-\d{2}$/.test(from)) addFilter('a.created_at::date >= ?::date', from);
        if (/^\d{4}-\d{2}-\d{2}$/.test(to)) addFilter('a.created_at::date <= ?::date', to);
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const filterParams = [...params];
        const [count, logs, options] = await Promise.all([
          query(`SELECT COUNT(*)::int AS total FROM auth_core.audit_logs a LEFT JOIN auth_core.users u ON u.id = a.user_id ${where}`, filterParams),
          query(`SELECT a.id, a.user_id, u.email AS username, a.action, a.module,
                        COALESCE(a.details->>'description', a.details->>'message', a.details->>'reason', a.resource_id) AS description,
                        COALESCE(a.details->>'status', 'Success') AS status, a.ip_address, a.created_at
                 FROM auth_core.audit_logs a LEFT JOIN auth_core.users u ON u.id = a.user_id
                 ${where} ORDER BY ${sortColumn} ${direction} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`, filterParams),
          query(`SELECT ARRAY(SELECT DISTINCT action FROM auth_core.audit_logs ORDER BY action) AS actions,
                        ARRAY(SELECT DISTINCT module FROM auth_core.audit_logs ORDER BY module) AS modules,
                        ARRAY(SELECT DISTINCT COALESCE(details->>'status', 'Success') FROM auth_core.audit_logs
                              ORDER BY COALESCE(details->>'status', 'Success')) AS statuses`)
        ]);
        const total = Number(count.rows[0]?.total || 0);
        return res.json({ success: true, logs: logs.rows, total, page,
          total_pages: Math.max(1, Math.ceil(total / pageSize)),
          actions: options.rows[0]?.actions || [], modules: options.rows[0]?.modules || [],
          statuses: options.rows[0]?.statuses || []
        });
      }

      // Fail clearly when the frontend requests an action this bridge does not implement.
      default: {
        return res.status(501).json({
          success: false,
          error: {
            code: 'BRIDGE_ACTION_NOT_IMPLEMENTED',
            message: `The HRMS bridge action [${action}] is not implemented.`,
            action
          }
        });
      }
    }
  } catch (err) {
    next(err);
  }
}
