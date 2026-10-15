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

// Composition root
const scheduleRepo = new ScheduleRepository();
const staffRepo = new StaffRepository();
const appointmentRepo = new AppointmentRepository();
const slotService = new SlotService(scheduleRepo, staffRepo, appointmentRepo);
const slotController = new SlotController(slotService);

// GET /api/v1/slots?doctorId=...&date=YYYY-MM-DD
router.get('/', authenticate, validateQuery(getSlotsQuerySchema), (req, res, next) => {
  slotController.getSlots(req, res).catch(next);
});

// POST /api/v1/slots/preview (Super Admin live preview)
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
