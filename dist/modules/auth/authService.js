"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginUser = loginUser;
exports.registerUser = registerUser;
exports.getUserProfile = getUserProfile;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const connection_js_1 = require("../../db/connection.js");
const env_js_1 = require("../../config/env.js");
async function loginUser(email, passwordPlain) {
    const result = await (0, connection_js_1.query)(`SELECT id, username, email, password_hash, full_name, global_role, is_active
     FROM auth_core.users
     WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)`, [email]);
    if (result.rows.length === 0) {
        throw { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' };
    }
    const user = result.rows[0];
    if (!user.is_active) {
        throw { statusCode: 403, code: 'ACCOUNT_DEACTIVATED', message: 'This account has been deactivated.' };
    }
    const isPasswordMatch = await bcryptjs_1.default.compare(passwordPlain, user.password_hash);
    if (!isPasswordMatch) {
        throw { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' };
    }
    const nameParts = (user.full_name || 'Admin User').trim().split(' ');
    const firstName = nameParts[0] || 'User';
    const lastName = nameParts.slice(1).join(' ') || '';
    const payload = {
        id: user.id,
        username: user.username || user.email,
        email: user.email,
        full_name: user.full_name,
        firstName,
        lastName,
        name: user.full_name,
        role: user.global_role,
        global_role: user.global_role
    };
    const token = jsonwebtoken_1.default.sign(payload, env_js_1.env.JWT_SECRET, { expiresIn: '7d' });
    // Log to audit log
    await (0, connection_js_1.query)(`INSERT INTO auth_core.audit_logs (user_id, module, action, details)
     VALUES ($1, 'auth', 'USER_LOGIN', $2)`, [user.id, JSON.stringify({ email: user.email, role: user.global_role })]);
    return {
        token,
        user: payload
    };
}
async function registerUser(email, passwordPlain, fullName, role = 'customer') {
    const existing = await (0, connection_js_1.query)('SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER($1)', [email]);
    if (existing.rows.length > 0) {
        throw { statusCode: 409, code: 'EMAIL_ALREADY_EXISTS', message: 'An account with this email already exists.' };
    }
    const passwordHash = await bcryptjs_1.default.hash(passwordPlain, 10);
    const result = await (0, connection_js_1.query)(`INSERT INTO auth_core.users (email, password_hash, full_name, global_role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, full_name, global_role, created_at`, [email, passwordHash, fullName, role]);
    const newUser = result.rows[0];
    const token = jsonwebtoken_1.default.sign({ id: newUser.id, email: newUser.email, full_name: newUser.full_name, global_role: newUser.global_role }, env_js_1.env.JWT_SECRET, { expiresIn: '7d' });
    return {
        token,
        user: newUser
    };
}
async function getUserProfile(userId) {
    const userResult = await (0, connection_js_1.query)(`SELECT u.id, u.email, u.full_name, u.global_role, u.avatar_url, u.phone_number, u.created_at,
            e.employee_no, e.employment_status, d.name AS department_name, p.title AS position_title
     FROM auth_core.users u
     LEFT JOIN hrms.employees e ON e.user_id = u.id
     LEFT JOIN hrms.departments d ON d.id = e.department_id
     LEFT JOIN hrms.positions p ON p.id = e.position_id
     WHERE u.id = $1`, [userId]);
    if (userResult.rows.length === 0) {
        throw { statusCode: 404, code: 'USER_NOT_FOUND', message: 'User record not found.' };
    }
    return userResult.rows[0];
}
