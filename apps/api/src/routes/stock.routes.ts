import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { InventoryService } from '../services/inventory.service.js';

export const stockRouter = Router();

stockRouter.use(requireAuth);

const adjustStockSchema = z.object({
  raw_material_id: z.string().min(1, 'Raw material ID is required'),
  delta: z.number().refine((val) => val !== 0, 'Delta cannot be zero'),
  reason: z.string().min(3, 'Adjustment reason is mandatory (min 3 chars)'),
});

// POST /api/v1/stock/adjust
stockRouter.post(
  '/stock/adjust',
  requireRole('admin', 'inventory_manager'),
  validate({ body: adjustStockSchema }),
  async (req: Request, res: Response) => {
    try {
      const { raw_material_id, delta, reason } = req.body;
      const userId = (req as any).user?.id || 'usr-inventory';
      const result = await InventoryService.adjustStock(raw_material_id, delta, reason, userId);
      return sendSuccess(res, result);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  },
);

// GET /api/v1/stock/ledger
stockRouter.get(
  '/stock/ledger',
  requireRole('admin', 'inventory_manager', 'production_manager'),
  async (req: Request, res: Response) => {
    const { material_id, reference_type } = req.query;
    const result = await InventoryService.getStockMovements({
      materialId: material_id as string,
      referenceType: reference_type as string,
    });
    return sendSuccess(res, result.data, { total: result.total });
  },
);

// GET /api/v1/stock/integrity
stockRouter.get(
  '/stock/integrity',
  requireRole('admin', 'inventory_manager'),
  async (_req: Request, res: Response) => {
    try {
      const { runInventoryIntegrityAudit } = await import('../scripts/integrity-check.js');
      const audit = await runInventoryIntegrityAudit();
      return sendSuccess(res, audit);
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  },
);

