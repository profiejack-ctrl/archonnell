import { z } from 'zod';
import * as authService from './authService.js';
import * as otpService from './otpService.js';
import { env } from '../../config/env.js';
const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1)
});
const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    fullName: z.string().min(2),
    role: z.string().optional()
});
const sendOtpSchema = z.object({
    email: z.string().email(),
    purpose: z.string().default('LOGIN'), // 'LOGIN', 'CHECKOUT', 'PASSWORD_RESET', 'APPLICANT', 'DRIVER', etc.
    module: z.string().default('auth')
});
const verifyOtpSchema = z.object({
    email: z.string().email(),
    code: z.string().min(4).max(10),
    purpose: z.string().default('LOGIN'),
    module: z.string().optional()
});
export async function login(req, res, next) {
    try {
        const { email, password } = loginSchema.parse(req.body);
        const result = await authService.loginUser(email, password);
        // Set cross-subdomain cookie if domain configured
        res.cookie('archon_token', result.token, {
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
            domain: env.COOKIE_DOMAIN === 'localhost' ? undefined : env.COOKIE_DOMAIN,
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
        res.json({
            success: true,
            data: result
        });
    }
    catch (err) {
        next(err);
    }
}
export async function register(req, res, next) {
    try {
        const { email, password, fullName, role } = registerSchema.parse(req.body);
        const result = await authService.registerUser(email, password, fullName, role || 'customer');
        res.status(201).json({
            success: true,
            data: result
        });
    }
    catch (err) {
        next(err);
    }
}
export async function me(req, res, next) {
    try {
        const userId = req.user.id;
        const profile = await authService.getUserProfile(userId);
        res.json({
            success: true,
            data: profile
        });
    }
    catch (err) {
        next(err);
    }
}
export async function logout(req, res) {
    res.clearCookie('archon_token', {
        domain: env.COOKIE_DOMAIN === 'localhost' ? undefined : env.COOKIE_DOMAIN
    });
    res.json({
        success: true,
        message: 'Logged out successfully.'
    });
}
export async function sendOtp(req, res, next) {
    try {
        const { email, purpose, module } = sendOtpSchema.parse(req.body);
        const result = await otpService.sendOtp(email, purpose, module);
        res.json({
            success: true,
            message: `Verification code sent to ${email}.`,
            data: result
        });
    }
    catch (err) {
        next(err);
    }
}
export async function verifyOtp(req, res, next) {
    try {
        const { email, code, purpose, module } = verifyOtpSchema.parse(req.body);
        const result = await otpService.verifyOtp(email, code, purpose, module);
        res.json({
            success: true,
            message: 'OTP verified successfully.',
            data: result
        });
    }
    catch (err) {
        next(err);
    }
}
