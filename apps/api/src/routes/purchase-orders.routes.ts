import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { InventoryService } from '../services/inventory.service.js';

export const purchaseOrdersRouter = Router();

purchaseOrdersRouter.use(requireAuth);

const poItemSchema = z.object({
  raw_material_id: z.string().min(1, 'Raw material is required'),
  quantity: z.number().positive('Quantity must be greater than zero'),
  unit: z.string().min(1, 'Unit is required'),
  unit_cost: z.number().min(0, 'Unit cost must be non-negative'),
});

const createPOSchema = z.object({
  supplier_id: z.string().min(1, 'Supplier is required'),
  notes: z.string().optional(),
  items: z.array(poItemSchema).min(1, 'Purchase order must have at least one line item'),
});

const rejectPOSchema = z.object({
  reason: z.string().min(3, 'Rejection reason must be provided (min 3 chars)'),
});

// GET /api/v1/purchase-orders
purchaseOrdersRouter.get(
  '/purchase-orders',
  requireRole('admin', 'inventory_manager'),
  async (req: Request, res: Response) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const supplier_id = typeof req.query.supplier_id === 'string' ? req.query.supplier_id : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const result = await InventoryService.getPurchaseOrders({
      status,
      supplierId: supplier_id,
      search,
    });
    return sendSuccess(res, result.data, { total: result.total });
  },
);

// GET /api/v1/purchase-orders/:id
purchaseOrdersRouter.get(
  '/purchase-orders/:id',
  requireRole('admin', 'inventory_manager'),
  async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const po = await InventoryService.getPurchaseOrderById(id);
    if (!po) {
      return sendError(res, 'Purchase order not found', 404);
    }
    return sendSuccess(res, po);
  },
);

// POST /api/v1/purchase-orders (Draft creation)
purchaseOrdersRouter.post(
  '/purchase-orders',
  requireRole('admin', 'inventory_manager'),
  validate({ body: createPOSchema }),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || 'usr-inventory';
      const po = await InventoryService.createPurchaseOrder(req.body, userId);
      return sendSuccess(res, po, null, 201);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  },
);

// POST /api/v1/purchase-orders/:id/submit (Draft -> Pending Approval)
purchaseOrdersRouter.post(
  '/purchase-orders/:id/submit',
  requireRole('admin', 'inventory_manager'),
  async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const po = await InventoryService.submitPurchaseOrder(id);
      return sendSuccess(res, po);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  },
);

// POST /api/v1/purchase-orders/:id/approve (Admin ONLY)
purchaseOrdersRouter.post(
  '/purchase-orders/:id/approve',
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const userId = (req as any).user?.id || 'usr-admin';
      const po = await InventoryService.approvePurchaseOrder(id, userId);
      return sendSuccess(res, po);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  },
);

// POST /api/v1/purchase-orders/:id/reject (Admin ONLY)
purchaseOrdersRouter.post(
  '/purchase-orders/:id/reject',
  requireRole('admin'),
  validate({ body: rejectPOSchema }),
  async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const po = await InventoryService.rejectPurchaseOrder(id, req.body.reason);
      return sendSuccess(res, po);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  },
);

// POST /api/v1/purchase-orders/:id/confirm (Receive & Confirm PO)
// Atomically executes stock increase, calculates weighted average cost, records stock movements
purchaseOrdersRouter.post(
  '/purchase-orders/:id/confirm',
  requireRole('admin', 'inventory_manager'),
  async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const userId = (req as any).user?.id || 'usr-inventory';
      const result = await InventoryService.confirmPurchase(id, userId);
      return sendSuccess(res, result);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  },
);
