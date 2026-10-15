import { Router } from 'express';
import { AUTH_ROUTES } from '../constants/routes';
import { ROLES } from '../constants/roles';
import { UserRepository } from '../repositories/implementation/UserRepository';
import { RefreshTokenRepository } from '../repositories/implementation/RefreshTokenRepository';
import { AuthService } from '../services/implementation/AuthService';
import { AuthController } from '../controllers/implementation/AuthController';
import { validateBody } from '../middlewares/validate.middleware';
import { loginSchema } from '../validators/auth.validator';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { successResponse } from '../dtos/ApiResponse';

const router = Router();

// Composition root for auth module
const userRepository = new UserRepository();
const refreshTokenRepository = new RefreshTokenRepository();
const authService = new AuthService(userRepository, refreshTokenRepository);
const authController = new AuthController(authService);

router.post(
  AUTH_ROUTES.LOGIN,
  validateBody(loginSchema),
  (req, res, next) => {
    authController.login(req, res).catch(next);
  },
);

router.post(
  AUTH_ROUTES.REFRESH,
  (req, res, next) => {
    authController.refresh(req, res).catch(next);
  },
);

router.post(
  AUTH_ROUTES.LOGOUT,
  (req, res, next) => {
    authController.logout(req, res).catch(next);
  },
);

router.get(
  AUTH_ROUTES.ME,
  authenticate,
  (req, res, next) => {
    authController.getMe(req, res).catch(next);
  },
);

// Protected endpoint to verify role authorization
router.get(
  '/admin-only',
  authenticate,
  authorize(ROLES.SUPER_ADMIN),
  (_req, res) => {
    res.json(successResponse('Admin area accessed', { secret: 'admin_data' }));
  },
);

export default router;
