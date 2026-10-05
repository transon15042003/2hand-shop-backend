import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { optionalCustomerAuth, requireCustomerAuth } from '../middlewares/auth.middleware.js';
import { authRateLimiter } from '../middlewares/rate-limit.middleware.js';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendCodeSchema,
  updateProfileSchema,
  changePasswordSchema,
} from '../dtos/auth.dto.js';

const router = Router();

router.post('/register', authRateLimiter, validate({ body: registerSchema }), (req, res, next) =>
  authController.register(req, res, next)
);
router.post('/verify-email', authRateLimiter, validate({ body: verifyEmailSchema }), (req, res, next) =>
  authController.verifyEmail(req, res, next)
);
router.post('/resend-code', authRateLimiter, validate({ body: resendCodeSchema }), (req, res, next) =>
  authController.resendCode(req, res, next)
);
router.post('/login', authRateLimiter, validate({ body: loginSchema }), (req, res, next) =>
  authController.login(req, res, next)
);
router.post('/logout', (req, res, next) => authController.logout(req, res, next));
router.get('/session', optionalCustomerAuth, (req, res, next) => authController.getSession(req, res, next));
router.post('/logout-all', requireCustomerAuth, (req, res, next) => authController.logoutAll(req, res, next));
router.get('/me', requireCustomerAuth, (req, res, next) => authController.getMe(req, res, next));
router.put('/me', requireCustomerAuth, validate({ body: updateProfileSchema }), (req, res, next) =>
  authController.updateMe(req, res, next)
);
router.post('/change-password', requireCustomerAuth, validate({ body: changePasswordSchema }), (req, res, next) =>
  authController.changePassword(req, res, next)
);

export default router;
