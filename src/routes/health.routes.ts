import { Router } from 'express';
import { ROUTES } from '../constants/routes';
import { HealthService } from '../services/implementation/HealthService';
import { HealthController } from '../controllers/implementation/HealthController';

const router = Router();
const controller = new HealthController(new HealthService());

router.get(ROUTES.HEALTH, (req, res) => controller.getHealth(req, res));

export default router;
