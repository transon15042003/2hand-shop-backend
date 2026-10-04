import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { requireCustomerAuth } from '../middlewares/auth.middleware.js';
import {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  resendOtpSchema,
} from '../dtos/auth.dto.js';

const router = Router();

router.post('/register', validate({ body: registerSchema }), authController.register);
router.post('/verify-otp', validate({ body: verifyOtpSchema }), authController.verifyOtp);
router.post('/resend-otp', validate({ body: resendOtpSchema }), authController.resendOtp);
router.post('/login', validate({ body: loginSchema }), authController.login);
router.post('/logout', authController.logout);
router.get('/me', requireCustomerAuth, authController.getMe);

export default router;
