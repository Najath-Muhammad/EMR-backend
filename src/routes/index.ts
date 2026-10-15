import { Router } from 'express';
import { ROUTES } from '../constants/routes';
import healthRouter from './health.routes';
import authRouter from './auth.routes';

const router = Router();

// Mount health routes under /api/v1
router.use(ROUTES.BASE, healthRouter);

// Mount auth routes under /api/v1/auth
router.use(`${ROUTES.BASE}${ROUTES.AUTH}`, authRouter);

export default router;
