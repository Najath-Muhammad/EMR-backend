import { Router } from 'express';
import { DepartmentRepository } from '../repositories/implementation/DepartmentRepository';
import { StaffRepository } from '../repositories/implementation/StaffRepository';
import { DepartmentService } from '../services/implementation/DepartmentService';
import { DepartmentController } from '../controllers/implementation/DepartmentController';
import { validateBody, validateQuery } from '../middlewares/validate.middleware';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  toggleDepartmentStatusSchema,
} from '../validators/department.validator';
import { paginationSchema } from '../validators/pagination.validator';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { ROLES } from '../constants/roles';

const router = Router();

const departmentRepo = new DepartmentRepository();
const staffRepo = new StaffRepository();
const departmentService = new DepartmentService(departmentRepo, staffRepo);
const departmentController = new DepartmentController(departmentService);

router.get('/active', authenticate, (req, res, next) => {
  departmentController.listActive(req, res).catch(next);
});

router.get(
  '/',
  authenticate,
  validateQuery(paginationSchema),
  (req, res, next) => {
    departmentController.list(req, res).catch(next);
  },
);

router.get('/:id', authenticate, (req, res, next) => {
  departmentController.getById(req, res).catch(next);
});

router.post(
  '/',
  authenticate,
  authorize(ROLES.SUPER_ADMIN),
  validateBody(createDepartmentSchema),
  (req, res, next) => {
    departmentController.create(req, res).catch(next);
  },
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.SUPER_ADMIN),
  validateBody(updateDepartmentSchema),
  (req, res, next) => {
    departmentController.update(req, res).catch(next);
  },
);

router.patch(
  '/:id/status',
  authenticate,
  authorize(ROLES.SUPER_ADMIN),
  validateBody(toggleDepartmentStatusSchema),
  (req, res, next) => {
    departmentController.toggleStatus(req, res).catch(next);
  },
);

export default router;
