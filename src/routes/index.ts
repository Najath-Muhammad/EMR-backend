import { Router } from 'express';
import { ROUTES } from '../constants/routes';
import healthRouter from './health.routes';
import authRouter from './auth.routes';
import departmentRouter from './department.routes';
import staffRouter from './staff.routes';
import doctorRouter from './doctor.routes';
import slotRouter from './slot.routes';
import patientRouter from './patient.routes';

const router = Router();

// Mount health routes under /api/v1
router.use(ROUTES.BASE, healthRouter);

// Mount auth routes under /api/v1/auth
router.use(`${ROUTES.BASE}${ROUTES.AUTH}`, authRouter);

// Mount department routes under /api/v1/departments
router.use(`${ROUTES.BASE}${ROUTES.DEPARTMENTS}`, departmentRouter);

// Mount staff routes under /api/v1/staff
router.use(`${ROUTES.BASE}${ROUTES.STAFF}`, staffRouter);

// Mount doctor routes under /api/v1/doctors
router.use(`${ROUTES.BASE}${ROUTES.DOCTORS}`, doctorRouter);

// Mount slot routes under /api/v1/slots
router.use(`${ROUTES.BASE}${ROUTES.SLOTS}`, slotRouter);

// Mount patient routes under /api/v1/patients
router.use(`${ROUTES.BASE}${ROUTES.PATIENTS}`, patientRouter);

export default router;
