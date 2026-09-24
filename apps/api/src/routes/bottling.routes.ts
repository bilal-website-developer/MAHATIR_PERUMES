import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { BottlingService } from '../services/bottling.service.js';

export const bottlingRouter = Router();

bottlingRouter.use(requireAuth);

const bottlingPreviewSchema = z.object({
  batch_id: z.string().min(1, 'Batch ID is required'),
  variant_id: z.string().min(1, 'Variant ID is required'),
  quantity: z.number().positive('Quantity must be greater than zero'),
});

const executeBottlingSchema = z.object({
  batch_id: z.string().min(1, 'Batch ID is required'),
  variant_id: z.string().min(1, 'Variant ID is required'),
  quantity: z.number().positive('Quantity must be greater than zero'),
});

// POST /api/v1/bottling/preview (Preview calculations and stock sufficiency)
bottlingRouter.post(
  '/bottling/preview',
  requireRole('admin', 'production_manager'),
  validate({ body: bottlingPreviewSchema }),
  async (req: Request, res: Response) => {
    try {
      const { batch_id, variant_id, quantity } = req.body;
      const preview = await BottlingService.previewBottling(batch_id, variant_id, quantity);
      return sendSuccess(res, preview);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  },
);

// POST /api/v1/bottling (Atomic execution)
bottlingRouter.post(
  '/bottling',
  requireRole('admin', 'production_manager'),
  validate({ body: executeBottlingSchema }),
  async (req: Request, res: Response) => {
    try {
      const { batch_id, variant_id, quantity } = req.body;
      const userId = (req as any).user?.id || 'usr-admin';
      const result = await BottlingService.executeBottlingRun(batch_id, variant_id, quantity, userId);
      return sendSuccess(res, result, null, 201);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  },
);

// GET /api/v1/bottling/runs (List execution history)
bottlingRouter.get(
  '/bottling/runs',
  requireRole('admin', 'production_manager', 'inventory_manager'),
  async (_req: Request, res: Response) => {
    const result = await BottlingService.getBottlingRuns();
    return sendSuccess(res, result.data, { total: result.total });
  },
);

// GET /api/v1/finished-goods (List lots and stocks)
bottlingRouter.get(
  '/finished-goods',
  requireRole('admin', 'production_manager', 'inventory_manager', 'sales_staff'),
  async (_req: Request, res: Response) => {
    const result = await BottlingService.getFinishedGoodsLots();
    return sendSuccess(res, result.data, { total: result.total });
  },
);
