import { Router, Request, Response, NextFunction } from 'express';
import { PATIENT_ROUTES } from '../constants/routes';
import { ROLES } from '../constants/roles';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validateBody, validateQuery } from '../middlewares/validate.middleware';
import {
  createPatientSchema,
  updatePatientSchema,
  checkDuplicatesSchema,
  searchPatientsQuerySchema,
} from '../validators/patient.validator';
import { PatientRepository } from '../repositories/implementation/PatientRepository';
import { DepartmentRepository } from '../repositories/implementation/DepartmentRepository';
import { PatientService } from '../services/implementation/PatientService';
import { PatientController } from '../controllers/implementation/PatientController';

const router = Router();

// Dependency Injection
const patientRepo = new PatientRepository();
const deptRepo = new DepartmentRepository();
const patientService = new PatientService(patientRepo, deptRepo);
const patientController = new PatientController(patientService);

// Search and List patients (Super Admin, Receptionist, Doctor)
router.get(
  PATIENT_ROUTES.ROOT,
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR),
  validateQuery(searchPatientsQuerySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await patientController.getPatients(req, res);
    } catch (error) {
      next(error);
    }
  },
);

// Check potential duplicates before registration (Super Admin, Receptionist)
router.post(
  PATIENT_ROUTES.CHECK_DUPLICATES,
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.RECEPTIONIST),
  validateBody(checkDuplicatesSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await patientController.checkDuplicates(req, res);
    } catch (error) {
      next(error);
    }
  },
);

// Register a new patient (Super Admin, Receptionist)
router.post(
  PATIENT_ROUTES.ROOT,
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.RECEPTIONIST),
  validateBody(createPatientSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await patientController.createPatient(req, res);
    } catch (error) {
      next(error);
    }
  },
);

// Get patient profile by ID or patientId (Super Admin, Receptionist, Doctor)
router.get(
  PATIENT_ROUTES.BY_ID,
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await patientController.getPatientById(req, res);
    } catch (error) {
      next(error);
    }
  },
);

// Update patient details (Super Admin, Receptionist)
router.put(
  PATIENT_ROUTES.BY_ID,
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.RECEPTIONIST),
  validateBody(updatePatientSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await patientController.updatePatient(req, res);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
