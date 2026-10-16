import { Router } from 'express';
import { SlotController } from '../controllers/implementation/SlotController';
import { SlotService } from '../services/implementation/SlotService';
import { ScheduleRepository } from '../repositories/implementation/ScheduleRepository';
import { StaffRepository } from '../repositories/implementation/StaffRepository';
import { AppointmentRepository } from '../repositories/implementation/AppointmentRepository';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validateBody, validateQuery } from '../middlewares/validate.middleware';
import { getSlotsQuerySchema, previewSlotsSchema } from '../validators/slot.validator';
import { ROLES } from '../constants/roles';

const router = Router();

const scheduleRepo = new ScheduleRepository();
const staffRepo = new StaffRepository();
const appointmentRepo = new AppointmentRepository();
const slotService = new SlotService(scheduleRepo, staffRepo, appointmentRepo);
const slotController = new SlotController(slotService);

router.get('/', authenticate, validateQuery(getSlotsQuerySchema), (req, res, next) => {
  slotController.getSlots(req, res).catch(next);
});

router.post(
  '/preview',
  authenticate,
  authorize(ROLES.SUPER_ADMIN),
  validateBody(previewSlotsSchema),
  (req, res, next) => {
    slotController.previewSlots(req, res).catch(next);
  },
);

export default router;
