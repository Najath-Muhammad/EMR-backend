import { Router } from 'express';
import { ROUTES } from '../constants/routes';
import healthRouter from './health.routes';
import authRouter from './auth.routes';
import departmentRouter from './department.routes';
import staffRouter from './staff.routes';
import doctorRouter from './doctor.routes';
import slotRouter from './slot.routes';
import patientRouter from './patient.routes';
import appointmentRouter from './appointment.routes';
import auditLogRouter from './auditLog.routes';

const router = Router();

router.use(ROUTES.BASE, healthRouter);

router.use(`${ROUTES.BASE}${ROUTES.AUTH}`, authRouter);

router.use(`${ROUTES.BASE}${ROUTES.DEPARTMENTS}`, departmentRouter);

router.use(`${ROUTES.BASE}${ROUTES.STAFF}`, staffRouter);

router.use(`${ROUTES.BASE}${ROUTES.DOCTORS}`, doctorRouter);

router.use(`${ROUTES.BASE}${ROUTES.SLOTS}`, slotRouter);

router.use(`${ROUTES.BASE}${ROUTES.PATIENTS}`, patientRouter);

router.use(`${ROUTES.BASE}${ROUTES.APPOINTMENTS}`, appointmentRouter);

router.use(`${ROUTES.BASE}${ROUTES.AUDIT_LOGS}`, auditLogRouter);

export default router;
