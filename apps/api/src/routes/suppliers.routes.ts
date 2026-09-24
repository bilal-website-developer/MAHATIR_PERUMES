import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { InventoryService } from '../services/inventory.service.js';

export const suppliersRouter = Router();

suppliersRouter.use(requireAuth);

const createSupplierSchema = z.object({
  name: z.string().min(2, 'Supplier name must be at least 2 characters'),
  contact_person: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  payment_terms: z.string().default('Net 30'),
});

const updateSupplierSchema = createSupplierSchema.partial();

// GET /api/v1/suppliers
suppliersRouter.get(
  '/suppliers',
  requireRole('admin', 'inventory_manager'),
  async (req: Request, res: Response) => {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const result = await InventoryService.getSuppliers(search);
    return sendSuccess(res, result.data, { total: result.total });
  },
);

// POST /api/v1/suppliers
suppliersRouter.post(
  '/suppliers',
  requireRole('admin', 'inventory_manager'),
  validate({ body: createSupplierSchema }),
  async (req: Request, res: Response) => {
    try {
      const supplier = await InventoryService.createSupplier({
        ...req.body,
        branch_id: (req as any).user?.branchId,
      });
      return sendSuccess(res, supplier, null, 201);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  },
);

// PATCH /api/v1/suppliers/:id
suppliersRouter.patch(
  '/suppliers/:id',
  requireRole('admin', 'inventory_manager'),
  validate({ body: updateSupplierSchema }),
  async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const updated = await InventoryService.updateSupplier(id, req.body);
      return sendSuccess(res, updated);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  },
);
