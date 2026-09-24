import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { BatchService } from '../services/batch.service.js';

export const batchRouter = Router();

batchRouter.use(requireAuth);

const createBatchSchema = z.object({
  formula_id: z.string().min(1, 'Formula is required'),
  expected_volume: z.number().positive('Expected volume must be greater than zero'),
  notes: z.string().optional(),
});

const confirmBatchSchema = z.object({
  actual_volume: z.number().positive('Actual volume produced must be greater than zero'),
  loss_reason: z.string().optional().default(''),
});

const reverseBatchSchema = z.object({
  reason: z.string().min(3, 'Reversal reason is mandatory (minimum 3 characters)'),
});

// GET /api/v1/batches
batchRouter.get(
  '/batches',
  requireRole('admin', 'production_manager', 'inventory_manager'),
  async (req: Request, res: Response) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const result = await BatchService.getBatches({ status, search });
    return sendSuccess(res, result.data, { total: result.total });
  },
);

// GET /api/v1/batches/bulk-inventory and GET /api/v1/bulk-inventory
batchRouter.get(
  ['/batches/bulk-inventory', '/bulk-inventory'],
  requireRole('admin', 'production_manager', 'inventory_manager', 'sales_staff'),
  async (_req: Request, res: Response) => {
    const result = await BatchService.getBulkInventory();
    return sendSuccess(res, result.data, { total: result.total });
  },
);

// GET /api/v1/batches/:id
batchRouter.get(
  '/batches/:id',
  requireRole('admin', 'production_manager', 'inventory_manager'),
  async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const batch = await BatchService.getBatchById(id);
    if (!batch) {
      return sendError(res, 'Batch not found', 404);
    }
    return sendSuccess(res, batch);
  },
);

// POST /api/v1/batches (Create draft batch)
batchRouter.post(
  '/batches',
  requireRole('admin', 'production_manager'),
  validate({ body: createBatchSchema }),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || 'usr-production';
      const batch = await BatchService.createDraftBatch(req.body, userId);
      return sendSuccess(res, batch, null, 201);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  },
);

// POST /api/v1/batches/:id/confirm (Atomic batch execution)
batchRouter.post(
  '/batches/:id/confirm',
  requireRole('admin', 'production_manager'),
  validate({ body: confirmBatchSchema }),
  async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const userId = (req as any).user?.id || 'usr-production';
      const result = await BatchService.confirmBatch(
        id,
        req.body.actual_volume,
        req.body.loss_reason,
        userId,
      );
      return sendSuccess(res, result);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  },
);

// POST /api/v1/batches/:id/reverse (Atomic reversal)
batchRouter.post(
  '/batches/:id/reverse',
  requireRole('admin', 'production_manager'),
  validate({ body: reverseBatchSchema }),
  async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const userId = (req as any).user?.id || 'usr-admin';
      const result = await BatchService.reverseBatch(id, req.body.reason, userId);
      return sendSuccess(res, result);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  },
);

// GET /api/v1/bulk-inventory (Available bulk liquid lots)
batchRouter.get(
  '/bulk-inventory',
  requireRole('admin', 'production_manager', 'inventory_manager', 'sales_staff'),
  async (_req: Request, res: Response) => {
    const result = await BatchService.getBulkInventory();
    return sendSuccess(res, result.data, { total: result.total });
  },
);
