import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../../db/connection.js';
import { env } from '../../config/env.js';

export async function loginUser(email: string, passwordPlain: string) {
  const result = await query(
    `SELECT id, email, password_hash, full_name, global_role, is_active
     FROM auth_core.users
     WHERE LOWER(email) = LOWER($1)`,
    [email]
  );

  if (result.rows.length === 0) {
    throw { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' };
  }

  const user = result.rows[0];

  if (!user.is_active) {
    throw { statusCode: 403, code: 'ACCOUNT_DEACTIVATED', message: 'This account has been deactivated.' };
  }

  const isPasswordMatch = await bcrypt.compare(passwordPlain, user.password_hash);
  if (!isPasswordMatch) {
    throw { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' };
  }

  const nameParts = (user.full_name || 'Admin User').trim().split(' ');
  const firstName = nameParts[0] || 'User';
  const lastName = nameParts.slice(1).join(' ') || '';

  const payload = {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    firstName,
    lastName,
    name: user.full_name,
    role: user.global_role,
    global_role: user.global_role
  };

  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });

  // Log to audit log
  await query(
    `INSERT INTO auth_core.audit_logs (user_id, module, action, details)
     VALUES ($1, 'auth', 'USER_LOGIN', $2)`,
    [user.id, JSON.stringify({ email: user.email, role: user.global_role })]
  );

  return {
    token,
    user: payload
  };
}

export async function registerUser(email: string, passwordPlain: string, fullName: string, role: string = 'customer') {
  const existing = await query('SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER($1)', [email]);
  if (existing.rows.length > 0) {
    throw { statusCode: 409, code: 'EMAIL_ALREADY_EXISTS', message: 'An account with this email already exists.' };
  }

  const passwordHash = await bcrypt.hash(passwordPlain, 10);
  const result = await query(
    `INSERT INTO auth_core.users (email, password_hash, full_name, global_role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, full_name, global_role, created_at`,
    [email, passwordHash, fullName, role]
  );

  const newUser = result.rows[0];
  const token = jwt.sign(
    { id: newUser.id, email: newUser.email, full_name: newUser.full_name, global_role: newUser.global_role },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    token,
    user: newUser
  };
}

export async function getUserProfile(userId: string) {
  const userResult = await query(
    `SELECT u.id, u.email, u.full_name, u.global_role, u.avatar_url, u.phone_number, u.created_at,
            e.employee_no, e.employment_status, d.name AS department_name, p.title AS position_title
     FROM auth_core.users u
     LEFT JOIN hrms.employees e ON e.user_id = u.id
     LEFT JOIN hrms.departments d ON d.id = e.department_id
     LEFT JOIN hrms.positions p ON p.id = e.position_id
     WHERE u.id = $1`,
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw { statusCode: 404, code: 'USER_NOT_FOUND', message: 'User record not found.' };
  }

  return userResult.rows[0];
}
