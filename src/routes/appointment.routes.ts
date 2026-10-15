import { Router, Request, Response, NextFunction } from 'express';
import { APPOINTMENT_ROUTES } from '../constants/routes';
import { ROLES } from '../constants/roles';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validateBody, validateQuery } from '../middlewares/validate.middleware';
import {
  createAppointmentSchema,
  cancelAppointmentSchema,
  appointmentQuerySchema,
} from '../validators/appointment.validator';
import { AppointmentRepository } from '../repositories/implementation/AppointmentRepository';
import { PatientRepository } from '../repositories/implementation/PatientRepository';
import { StaffRepository } from '../repositories/implementation/StaffRepository';
import { DepartmentRepository } from '../repositories/implementation/DepartmentRepository';
import { ScheduleRepository } from '../repositories/implementation/ScheduleRepository';
import { AppointmentService } from '../services/implementation/AppointmentService';
import { AppointmentController } from '../controllers/implementation/AppointmentController';

const router = Router();

// Composition Root
const appointmentRepo = new AppointmentRepository();
const patientRepo = new PatientRepository();
const staffRepo = new StaffRepository();
const departmentRepo = new DepartmentRepository();
const scheduleRepo = new ScheduleRepository();

const appointmentService = new AppointmentService(
  appointmentRepo,
  patientRepo,
  staffRepo,
  departmentRepo,
  scheduleRepo,
);

const appointmentController = new AppointmentController(appointmentService);

// 1. Get appointments list (SUPER_ADMIN, RECEPTIONIST, DOCTOR)
router.get(
  APPOINTMENT_ROUTES.ROOT,
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR),
  validateQuery(appointmentQuerySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await appointmentController.getAppointments(req, res);
    } catch (error) {
      next(error);
    }
  },
);

// 2. Book an appointment (SUPER_ADMIN, RECEPTIONIST)
router.post(
  APPOINTMENT_ROUTES.ROOT,
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.RECEPTIONIST),
  validateBody(createAppointmentSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await appointmentController.bookAppointment(req, res);
    } catch (error) {
      next(error);
    }
  },
);

// 3. Get appointment by ID (SUPER_ADMIN, RECEPTIONIST, DOCTOR)
router.get(
  APPOINTMENT_ROUTES.BY_ID,
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await appointmentController.getAppointmentById(req, res);
    } catch (error) {
      next(error);
    }
  },
);

// 4. Cancel appointment (SUPER_ADMIN, RECEPTIONIST) - support both PATCH and POST
router.patch(
  APPOINTMENT_ROUTES.CANCEL,
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.RECEPTIONIST),
  validateBody(cancelAppointmentSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await appointmentController.cancelAppointment(req, res);
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  APPOINTMENT_ROUTES.CANCEL,
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.RECEPTIONIST),
  validateBody(cancelAppointmentSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await appointmentController.cancelAppointment(req, res);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
