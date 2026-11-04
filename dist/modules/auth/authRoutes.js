import { Router } from 'express';
import * as authController from './authController.js';
import { authenticate } from '../../middleware/authenticate.js';
const router = Router();
router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.me);
export default router;
