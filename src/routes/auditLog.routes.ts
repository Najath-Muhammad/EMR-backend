import { Router, Request, Response, NextFunction } from 'express';
import { AUDIT_LOG_ROUTES } from '../constants/routes';
import { ROLES } from '../constants/roles';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validateQuery } from '../middlewares/validate.middleware';
import { auditLogQuerySchema } from '../validators/auditLog.validator';
import { AuditLogRepository } from '../repositories/implementation/AuditLogRepository';
import { AuditLogService } from '../services/implementation/AuditLogService';
import { AuditLogController } from '../controllers/implementation/AuditLogController';

const router = Router();

// Composition root
const auditLogRepo = new AuditLogRepository();
const auditLogService = new AuditLogService(auditLogRepo);
const auditLogController = new AuditLogController(auditLogService);

// 1. Get paginated audit logs (SUPER_ADMIN only)
router.get(
  AUDIT_LOG_ROUTES.ROOT,
  authenticate,
  authorize(ROLES.SUPER_ADMIN),
  validateQuery(auditLogQuerySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await auditLogController.getAuditLogs(req, res);
    } catch (error) {
      next(error);
    }
  },
);

// 2. Get audit log by ID (SUPER_ADMIN only)
router.get(
  AUDIT_LOG_ROUTES.BY_ID,
  authenticate,
  authorize(ROLES.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await auditLogController.getAuditLogById(req, res);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
