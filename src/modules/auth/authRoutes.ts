import { Router } from 'express';
import * as authController from './authController.js';
import { authenticate } from '../../middleware/authenticate.js';

const router = Router();

router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.me);

// Universal OTP verification routes for all subsystems
router.post('/otp/send', authController.sendOtp);
router.post('/otp/verify', authController.verifyOtp);

export default router;
