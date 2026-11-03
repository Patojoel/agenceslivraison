import { NextFunction, Request, Response } from 'express';
import { HealthController } from './health.controller';
import { sendProblem } from './problem-details';

/** Keep probes accessible while preventing traffic before migrations are ready. */
export function readinessMiddleware(health: HealthController) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.path === '/api/v1/health/live' || req.path === '/api/v1/health/ready') {
      next();
      return;
    }
    try {
      await health.ready();
      next();
    } catch {
      sendProblem(res, req, 503, 'Service Unavailable', 'Database not ready');
    }
  };
}
