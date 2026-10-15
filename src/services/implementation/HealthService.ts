import { IHealthService, HealthStatus } from '../interfaces/IHealthService';
import { env } from '../../config/env';

export class HealthService implements IHealthService {
  getStatus(): HealthStatus {
    return {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      version: process.env['npm_package_version'] ?? '0.1.0',
      environment: env.NODE_ENV,
    };
  }
}
