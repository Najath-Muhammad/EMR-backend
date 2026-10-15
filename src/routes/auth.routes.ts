import { Router } from 'express';
import { AUTH_ROUTES } from '../constants/routes';
import { ROLES } from '../constants/roles';
import { UserRepository } from '../repositories/implementation/UserRepository';
import { RefreshTokenRepository } from '../repositories/implementation/RefreshTokenRepository';
import { StaffRepository } from '../repositories/implementation/StaffRepository';
import { DepartmentRepository } from '../repositories/implementation/DepartmentRepository';
import { AuthService } from '../services/implementation/AuthService';
import { StaffService } from '../services/implementation/StaffService';
import { AuthController } from '../controllers/implementation/AuthController';
import { StaffController } from '../controllers/implementation/StaffController';
import { validateBody } from '../middlewares/validate.middleware';
import { loginSchema } from '../validators/auth.validator';
import { activateAccountSchema } from '../validators/staff.validator';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { successResponse } from '../dtos/ApiResponse';

import { AuditLogRepository } from '../repositories/implementation/AuditLogRepository';
import { AuditLogService } from '../services/implementation/AuditLogService';

const router = Router();

// Composition root for auth & staff activation
const userRepository = new UserRepository();
const refreshTokenRepository = new RefreshTokenRepository();
const auditLogRepo = new AuditLogRepository();
const auditLogService = new AuditLogService(auditLogRepo);
const authService = new AuthService(userRepository, refreshTokenRepository, auditLogService);
const authController = new AuthController(authService);

const staffRepository = new StaffRepository();
const departmentRepository = new DepartmentRepository();
const staffService = new StaffService(staffRepository, departmentRepository);
const staffController = new StaffController(staffService);

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

// Public account activation for invited staff
router.post(
  AUTH_ROUTES.ACTIVATE,
  validateBody(activateAccountSchema),
  (req, res, next) => {
    staffController.activate(req, res).catch(next);
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
