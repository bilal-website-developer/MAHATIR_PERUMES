import { Router, Request, Response } from 'express';
import { checkDatabaseHealth } from '../config/db.js';
import { sendSuccess } from '../utils/response.js';

export const healthRouter = Router();

// Basic health check
healthRouter.get('/health', (_req: Request, res: Response) => {
  sendSuccess(res, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    version: '1.0.0',
    service: 'Mahatir Perfumes ERP API',
  });
});

// Database connectivity health check
healthRouter.get('/health/db', async (_req: Request, res: Response) => {
  const result = await checkDatabaseHealth();
  sendSuccess(res, {
    database: result.connected ? 'reachable' : 'standby',
    connected: result.connected,
    latencyMs: result.latencyMs,
    source: result.source,
    message: result.message || 'Database status reported',
  });
});
