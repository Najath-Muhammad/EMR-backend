import { Router } from 'express';
import { ROUTES } from '../constants/routes';
import healthRouter from './health.routes';
import authRouter from './auth.routes';
import departmentRouter from './department.routes';
import staffRouter from './staff.routes';

const router = Router();

// Mount health routes under /api/v1
router.use(ROUTES.BASE, healthRouter);

// Mount auth routes under /api/v1/auth
router.use(`${ROUTES.BASE}${ROUTES.AUTH}`, authRouter);

// Mount department routes under /api/v1/departments
router.use(`${ROUTES.BASE}${ROUTES.DEPARTMENTS}`, departmentRouter);

// Mount staff routes under /api/v1/staff
router.use(`${ROUTES.BASE}${ROUTES.STAFF}`, staffRouter);

export default router;
