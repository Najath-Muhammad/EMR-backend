import { Router } from 'express';
import { DoctorController } from '../controllers/implementation/DoctorController';
import { ScheduleController } from '../controllers/implementation/ScheduleController';
import { ScheduleService } from '../services/implementation/ScheduleService';
import { StaffRepository } from '../repositories/implementation/StaffRepository';
import { ScheduleRepository } from '../repositories/implementation/ScheduleRepository';
import { AppointmentRepository } from '../repositories/implementation/AppointmentRepository';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validateBody, validateQuery } from '../middlewares/validate.middleware';
import { saveScheduleSchema } from '../validators/schedule.validator';
import { paginationSchema } from '../validators/pagination.validator';
import { ROLES } from '../constants/roles';

const router = Router();

import { AuditLogRepository } from '../repositories/implementation/AuditLogRepository';
import { AuditLogService } from '../services/implementation/AuditLogService';

// Composition root
const staffRepo = new StaffRepository();
const scheduleRepo = new ScheduleRepository();
const appointmentRepo = new AppointmentRepository();
const auditLogRepo = new AuditLogRepository();
const auditLogService = new AuditLogService(auditLogRepo);
const scheduleService = new ScheduleService(scheduleRepo, staffRepo, appointmentRepo, auditLogService);

const doctorController = new DoctorController(staffRepo, scheduleRepo);
const scheduleController = new ScheduleController(scheduleService);

// 1. Doctor listing & details
router.get('/', authenticate, validateQuery(paginationSchema), (req, res, next) => {
  doctorController.list(req, res).catch(next);
});

router.get('/:id', authenticate, (req, res, next) => {
  doctorController.getById(req, res).catch(next);
});

// 2. Doctor Schedule endpoints
router.get('/:id/schedule', authenticate, (req, res, next) => {
  scheduleController.getSchedule(req, res).catch(next);
});

// Only Super Admin can configure or modify official schedules
router.put(
  '/:id/schedule',
  authenticate,
  authorize(ROLES.SUPER_ADMIN),
  validateBody(saveScheduleSchema),
  (req, res, next) => {
    scheduleController.saveSchedule(req, res).catch(next);
  },
);

router.patch(
  '/:id/schedule/status',
  authenticate,
  authorize(ROLES.SUPER_ADMIN),
  (req, res, next) => {
    scheduleController.toggleStatus(req, res).catch(next);
  },
);

export default router;
