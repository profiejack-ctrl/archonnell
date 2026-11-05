import { query } from '../../db/connection.js';
import { env } from '../../config/env.js';
import * as emailService from '../../services/emailService.js';
// In-memory fallback map (email_purpose -> OtpMemoryRecord) to guarantee resilience
const memoryOtpStore = new Map();
/**
 * Generate and dispatch a 6-digit OTP to the recipient email.
 */
export async function sendOtp(email, purpose, moduleName = 'auth') {
    const normalizedEmail = email.trim().toLowerCase();
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + env.OTP_EXPIRATION_MINUTES * 60 * 1000);
    // Store in memory cache for instant lookup & offline fallback
    const memoryKey = `${normalizedEmail}_${purpose.toUpperCase()}`;
    memoryOtpStore.set(memoryKey, {
        code,
        purpose: purpose.toUpperCase(),
        module: moduleName.toLowerCase(),
        expiresAt,
        isUsed: false
    });
    // Persist to PostgreSQL auth_core.otps table
    try {
        // Invalidate previous active OTPs for same email + purpose
        await query(`UPDATE auth_core.otps
       SET is_used = TRUE
       WHERE LOWER(email) = LOWER($1) AND purpose = $2 AND is_used = FALSE`, [normalizedEmail, purpose.toUpperCase()]);
        // Insert new record
        await query(`INSERT INTO auth_core.otps (email, code, purpose, module, expires_at)
       VALUES ($1, $2, $3, $4, $5)`, [normalizedEmail, code, purpose.toUpperCase(), moduleName.toLowerCase(), expiresAt]);
        // Log to audit log
        await query(`INSERT INTO auth_core.audit_logs (module, action, details)
       VALUES ('auth', 'OTP_GENERATED', $1)`, [JSON.stringify({ email: normalizedEmail, purpose, module: moduleName })]);
    }
    catch (dbErr) {
        console.warn('[OtpService] Database storage notice (using in-memory fallback):', dbErr.message);
    }
    // Dispatch email notification
    const emailResult = await emailService.sendOtpEmail(normalizedEmail, code, purpose, moduleName);
    return {
        email: normalizedEmail,
        purpose: purpose.toUpperCase(),
        module: moduleName.toLowerCase(),
        expiresInMinutes: env.OTP_EXPIRATION_MINUTES,
        simulated: !!emailResult.simulated,
        // Include devCode when in development mode for easy API inspection and testing
        devCode: env.NODE_ENV !== 'production' ? code : undefined
    };
}
/**
 * Verify a submitted 6-digit OTP.
 */
export async function verifyOtp(email, code, purpose, moduleName) {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.trim();
    const normalizedPurpose = purpose.toUpperCase();
    const memoryKey = `${normalizedEmail}_${normalizedPurpose}`;
    let matchedFromDb = false;
    let otpRecord = null;
    // 1. Try checking PostgreSQL
    try {
        const res = await query(`SELECT id, code, expires_at, is_used
       FROM auth_core.otps
       WHERE LOWER(email) = LOWER($1) AND purpose = $2 AND is_used = FALSE
       ORDER BY created_at DESC
       LIMIT 1`, [normalizedEmail, normalizedPurpose]);
        if (res.rows.length > 0) {
            otpRecord = res.rows[0];
            matchedFromDb = true;
        }
    }
    catch (dbErr) {
        console.warn('[OtpService] Database query notice during verification, trying memory fallback:', dbErr.message);
    }
    // 2. Fall back to memory cache if DB check was empty or DB is offline
    if (!otpRecord) {
        const memRecord = memoryOtpStore.get(memoryKey);
        if (memRecord && !memRecord.isUsed) {
            otpRecord = {
                code: memRecord.code,
                expires_at: memRecord.expiresAt,
                is_used: memRecord.isUsed
            };
        }
    }
    if (!otpRecord) {
        throw {
            statusCode: 400,
            code: 'INVALID_OR_EXPIRED_OTP',
            message: 'No valid OTP found for this email and purpose. Please request a new code.'
        };
    }
    // Check expiration
    if (new Date() > new Date(otpRecord.expires_at)) {
        throw {
            statusCode: 400,
            code: 'OTP_EXPIRED',
            message: 'The verification code has expired. Please request a new one.'
        };
    }
    // Check code match
    if (otpRecord.code !== normalizedCode) {
        throw {
            statusCode: 400,
            code: 'INVALID_OTP_CODE',
            message: 'Incorrect verification code. Please check your email and try again.'
        };
    }
    // Mark as used in DB
    if (matchedFromDb && otpRecord.id) {
        try {
            await query(`UPDATE auth_core.otps SET is_used = TRUE WHERE id = $1`, [otpRecord.id]);
            await query(`INSERT INTO auth_core.audit_logs (module, action, details)
         VALUES ('auth', 'OTP_VERIFIED', $1)`, [JSON.stringify({ email: normalizedEmail, purpose: normalizedPurpose, module: moduleName })]);
        }
        catch (e) {
            console.warn('[OtpService] Failed to mark OTP as used in DB:', e.message);
        }
    }
    // Mark as used in memory
    const memRecord = memoryOtpStore.get(memoryKey);
    if (memRecord) {
        memRecord.isUsed = true;
    }
    return {
        verified: true,
        email: normalizedEmail,
        purpose: normalizedPurpose,
        module: moduleName || 'auth',
        verifiedAt: new Date().toISOString()
    };
}
