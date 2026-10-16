import { Router } from 'express';
import { AUTH_ROUTES } from '../constants/routes';
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
import { authenticate } from '../middlewares/auth.middleware';
import { AuditLogRepository } from '../repositories/implementation/AuditLogRepository';
import { AuditLogService } from '../services/implementation/AuditLogService';

const router = Router();

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
    authController.login(req, res, next).catch(next);
  },
);

router.post(
  AUTH_ROUTES.REFRESH,
  (req, res, next) => {
    authController.refresh(req, res, next).catch(next);
  },
);

router.post(
  AUTH_ROUTES.LOGOUT,
  (req, res, next) => {
    authController.logout(req, res, next).catch(next);
  },
);

router.get(
  AUTH_ROUTES.ME,
  authenticate,
  (req, res, next) => {
    authController.getMe(req, res, next).catch(next);
  },
);

router.post(
  AUTH_ROUTES.ACTIVATE,
  validateBody(activateAccountSchema),
  (req, res, next) => {
    staffController.activate(req, res, next).catch(next);
  },
);

export default router;
