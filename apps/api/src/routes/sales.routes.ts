import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { SalesService } from '../services/sales.service.js';

export const salesRouter = Router();

salesRouter.use(requireAuth);

const customerSchema = z.object({
  name: z.string().min(2, 'Customer name is required'),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

const createSaleSchema = z.object({
  customer_id: z.string().optional(),
  discount_amount: z.number().nonnegative().optional().default(0),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      item_type: z.enum(['bottled', 'decant']),
      variant_id: z.string().optional(),
      batch_id: z.string().optional(),
      lot_id: z.string().optional(),
      item_name: z.string().optional(),
      quantity: z.number().positive('Quantity must be greater than zero'),
      unit_price: z.number().nonnegative('Unit price cannot be negative'),
      line_discount: z.number().nonnegative().optional().default(0),
    }),
  ).min(1, 'Sale must contain at least one item'),
  payments: z.array(
    z.object({
      payment_method: z.enum(['cash', 'card', 'bank_transfer', 'split']),
      amount: z.number().positive('Payment amount must be greater than zero'),
      reference_code: z.string().optional(),
    }),
  ).min(1, 'At least one payment is required'),
});

const voidSaleSchema = z.object({
  reason: z.string().min(3, 'Mandatory void reason is required (minimum 3 characters)'),
});

// GET /api/v1/customers
salesRouter.get(
  '/customers',
  requireRole('admin', 'sales_staff', 'production_manager', 'inventory_manager'),
  async (_req: Request, res: Response) => {
    const result = await SalesService.getCustomers();
    return sendSuccess(res, result.data, { total: result.total });
  },
);

// POST /api/v1/customers
salesRouter.post(
  '/customers',
  requireRole('admin', 'sales_staff'),
  validate({ body: customerSchema }),
  async (req: Request, res: Response) => {
    try {
      const customer = await SalesService.createCustomer(req.body);
      return sendSuccess(res, customer, null, 201);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  },
);

// GET /api/v1/sales
salesRouter.get(
  '/sales',
  requireRole('admin', 'sales_staff', 'production_manager', 'inventory_manager'),
  async (req: Request, res: Response) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const result = await SalesService.getSales({ status, search });
    return sendSuccess(res, result.data, { total: result.total });
  },
);

// GET /api/v1/sales/:id
salesRouter.get(
  '/sales/:id',
  requireRole('admin', 'sales_staff', 'production_manager', 'inventory_manager'),
  async (req: Request, res: Response) => {
    const sale = await SalesService.getSaleById(req.params.id as string);
    if (!sale) {
      return sendError(res, 'Invoice not found', 404);
    }
    return sendSuccess(res, sale);
  },
);

// POST /api/v1/sales (Create atomic POS sale)
salesRouter.post(
  '/sales',
  requireRole('admin', 'sales_staff'),
  validate({ body: createSaleSchema }),
  async (req: Request, res: Response) => {
    try {
      const cashierId = (req as any).user?.id || 'usr-sales';
      const result = await SalesService.createSale(req.body, cashierId);
      return sendSuccess(res, result.sale, null, 201);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  },
);

// POST /api/v1/sales/:id/void (Void sale and restore stock)
salesRouter.post(
  '/sales/:id/void',
  requireRole('admin'),
  validate({ body: voidSaleSchema }),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || 'usr-admin';
      const result = await SalesService.voidSale(req.params.id as string, req.body.reason, userId);
      return sendSuccess(res, result.sale);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  },
);
