import { Router } from 'express';
import { StaffRepository } from '../repositories/implementation/StaffRepository';
import { DepartmentRepository } from '../repositories/implementation/DepartmentRepository';
import { StaffService } from '../services/implementation/StaffService';
import { StaffController } from '../controllers/implementation/StaffController';
import { validateBody, validateQuery } from '../middlewares/validate.middleware';
import {
  createStaffSchema,
  updateStaffSchema,
  toggleStaffStatusSchema,
} from '../validators/staff.validator';
import { paginationSchema } from '../validators/pagination.validator';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { ROLES } from '../constants/roles';

const router = Router();

// Composition root for staff module
const staffRepo = new StaffRepository();
const departmentRepo = new DepartmentRepository();
const staffService = new StaffService(staffRepo, departmentRepo);
const staffController = new StaffController(staffService);

// Super Admin exclusive staff management routes
router.get(
  '/',
  authenticate,
  authorize(ROLES.SUPER_ADMIN),
  validateQuery(paginationSchema),
  (req, res, next) => {
    staffController.list(req, res).catch(next);
  },
);

router.get(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN),
  (req, res, next) => {
    staffController.getById(req, res).catch(next);
  },
);

router.post(
  '/',
  authenticate,
  authorize(ROLES.SUPER_ADMIN),
  validateBody(createStaffSchema),
  (req, res, next) => {
    staffController.create(req, res).catch(next);
  },
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN),
  validateBody(updateStaffSchema),
  (req, res, next) => {
    staffController.update(req, res).catch(next);
  },
);

router.patch(
  '/:id/status',
  authenticate,
  authorize(ROLES.SUPER_ADMIN),
  validateBody(toggleStaffStatusSchema),
  (req, res, next) => {
    staffController.toggleStatus(req, res).catch(next);
  },
);

router.post(
  '/:id/resend-activation',
  authenticate,
  authorize(ROLES.SUPER_ADMIN),
  (req, res, next) => {
    staffController.resendActivation(req, res).catch(next);
  },
);

export default router;
