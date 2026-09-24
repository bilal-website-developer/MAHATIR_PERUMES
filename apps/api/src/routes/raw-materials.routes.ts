import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { InventoryService } from '../services/inventory.service.js';

export const rawMaterialsRouter = Router();

rawMaterialsRouter.use(requireAuth);

const createMaterialSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  sku: z.string().min(2, 'SKU must be at least 2 characters'),
  category: z.enum(['oil', 'alcohol', 'fixative', 'packaging']),
  base_unit: z.enum(['ml', 'g', 'pcs']),
  secondary_unit: z.enum(['l', 'kg', 'pcs']).optional(),
  conversion_rate: z.number().positive().optional().default(1),
  cost_per_unit: z.number().min(0).optional().default(0),
  min_stock_level: z.number().min(0).optional().default(0),
  current_stock: z.number().min(0).optional().default(0),
});

const updateMaterialSchema = z.object({
  name: z.string().min(2).optional(),
  category: z.enum(['oil', 'alcohol', 'fixative', 'packaging']).optional(),
  secondary_unit: z.enum(['l', 'kg', 'pcs']).optional(),
  conversion_rate: z.number().positive().optional(),
  min_stock_level: z.number().min(0).optional(),
});

// GET /api/v1/raw-materials (Admin, Inventory Manager, Production Manager)
rawMaterialsRouter.get('/raw-materials', async (req: Request, res: Response) => {
  const userRole = (req as any).user?.role;
  if (!['admin', 'inventory_manager', 'production_manager'].includes(userRole)) {
    return sendError(res, 'Access denied. You do not have permission to view raw materials.', 403);
  }

  const category = typeof req.query.category === 'string' ? req.query.category : undefined;
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const result = await InventoryService.getRawMaterials({
    category,
    lowStock: req.query.low_stock === 'true',
    search,
  });

  return sendSuccess(res, result.data, { total: result.total });
});

// GET /api/v1/raw-materials/:id
rawMaterialsRouter.get('/raw-materials/:id', async (req: Request, res: Response) => {
  const userRole = (req as any).user?.role;
  if (!['admin', 'inventory_manager', 'production_manager'].includes(userRole)) {
    return sendError(res, 'Access denied.', 403);
  }

  const id = req.params.id as string;
  const item = await InventoryService.getRawMaterialById(id);
  if (!item) {
    return sendError(res, 'Raw material not found', 404);
  }
  return sendSuccess(res, item);
});

// GET /api/v1/raw-materials/:id/ledger
rawMaterialsRouter.get('/raw-materials/:id/ledger', async (req: Request, res: Response) => {
  const userRole = (req as any).user?.role;
  if (!['admin', 'inventory_manager', 'production_manager'].includes(userRole)) {
    return sendError(res, 'Access denied.', 403);
  }

  const id = req.params.id as string;
  const result = await InventoryService.getStockMovements({ materialId: id });
  return sendSuccess(res, result.data, { total: result.total });
});

// POST /api/v1/raw-materials (Admin and Inventory Manager only)
rawMaterialsRouter.post(
  '/raw-materials',
  requireRole('admin', 'inventory_manager'),
  validate({ body: createMaterialSchema }),
  async (req: Request, res: Response) => {
    try {
      const material = await InventoryService.createRawMaterial({
        ...req.body,
        branch_id: (req as any).user?.branchId,
      });
      return sendSuccess(res, material, null, 201);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  },
);

// PATCH /api/v1/raw-materials/:id
rawMaterialsRouter.patch(
  '/raw-materials/:id',
  requireRole('admin', 'inventory_manager'),
  validate({ body: updateMaterialSchema }),
  async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const updated = await InventoryService.updateRawMaterial(id, req.body);
      return sendSuccess(res, updated);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  },
);

// DELETE /api/v1/raw-materials/:id
rawMaterialsRouter.delete(
  '/raw-materials/:id',
  requireRole('admin', 'inventory_manager'),
  async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const success = await InventoryService.deleteRawMaterial(id);
    if (!success) {
      return sendError(res, 'Raw material not found', 404);
    }
    return sendSuccess(res, { message: 'Raw material deactivated successfully' });
  },
);
