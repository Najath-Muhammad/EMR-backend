export interface HealthStatus {
  status: 'ok' | 'degraded';
  uptime: number;
  timestamp: string;
  version: string;
  environment: string;
}

export interface IHealthService {
  getStatus(): HealthStatus;
}
