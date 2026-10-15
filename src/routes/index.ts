import { Router } from 'express';
import { ROUTES } from '../constants/routes';
import healthRouter from './health.routes';

const router = Router();

router.use(ROUTES.BASE, healthRouter);

export default router;
