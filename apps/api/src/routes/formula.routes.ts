import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { FormulaService } from '../services/formula.service.js';

export const formulaRouter = Router();

formulaRouter.use(requireAuth);

const ingredientSchema = z.object({
  raw_material_id: z.string().min(1, 'Raw material is required'),
  quantity_type: z.enum(['percent', 'fixed_ml']),
  value: z.number().positive('Value must be positive'),
  notes: z.string().optional(),
});

const createFormulaSchema = z.object({
  perfume_name: z.string().min(2, 'Perfume name must be at least 2 characters'),
  code: z.string().min(2, 'Formula code must be at least 2 characters'),
  target_concentration: z.string().default('EDP'),
  notes: z.string().optional(),
  description: z.string().optional(),
  ingredients: z.array(ingredientSchema).min(1, 'Formula must contain at least one ingredient'),
});

const scaleFormulaSchema = z.object({
  total_ml: z.number().positive('Target volume must be greater than zero'),
});

const lockFormulaSchema = z.object({
  reason: z.string().min(3, 'Lock reason must be specified'),
});

// GET /api/v1/formulas (Production Manager, Admin, Inventory Manager)
formulaRouter.get(
  '/formulas',
  requireRole('admin', 'production_manager', 'inventory_manager'),
  async (req: Request, res: Response) => {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const result = await FormulaService.getFormulas({ search, status });
    return sendSuccess(res, result.data, { total: result.total });
  },
);

// GET /api/v1/formulas/:id
formulaRouter.get(
  '/formulas/:id',
  requireRole('admin', 'production_manager', 'inventory_manager'),
  async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const formula = await FormulaService.getFormulaById(id);
    if (!formula) {
      return sendError(res, 'Formula not found', 404);
    }
    return sendSuccess(res, formula);
  },
);

// POST /api/v1/formulas (Production Manager & Admin only)
formulaRouter.post(
  '/formulas',
  requireRole('admin', 'production_manager'),
  validate({ body: createFormulaSchema }),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || 'usr-production';
      const formula = await FormulaService.createFormula(req.body, userId);
      return sendSuccess(res, formula, null, 201);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  },
);

// POST /api/v1/formulas/:id/scale (Scale BOM calculations)
formulaRouter.post(
  '/formulas/:id/scale',
  requireRole('admin', 'production_manager', 'inventory_manager'),
  validate({ body: scaleFormulaSchema }),
  async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const result = await FormulaService.scaleFormula(id, req.body.total_ml);
      return sendSuccess(res, result);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  },
);

// POST /api/v1/formulas/:id/version (Clone to V+1)
formulaRouter.post(
  '/formulas/:id/version',
  requireRole('admin', 'production_manager'),
  async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const userId = (req as any).user?.id || 'usr-production';
      const newVersion = await FormulaService.cloneToNewVersion(id, true, userId);
      return sendSuccess(res, newVersion, null, 201);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  },
);

// POST /api/v1/formulas/:id/lock (Manual or batch auto-lock)
formulaRouter.post(
  '/formulas/:id/lock',
  requireRole('admin', 'production_manager'),
  validate({ body: lockFormulaSchema }),
  async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const locked = await FormulaService.lockFormula(id, req.body.reason);
      return sendSuccess(res, locked);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  },
);

// POST /api/v1/formulas/:id/archive
formulaRouter.post(
  '/formulas/:id/archive',
  requireRole('admin', 'production_manager'),
  async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const archived = await FormulaService.archiveFormula(id);
      return sendSuccess(res, archived);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  },
);

// PATCH /api/v1/formulas/:id (Edit - strictly blocked if locked)
formulaRouter.patch(
  '/formulas/:id',
  requireRole('admin', 'production_manager'),
  async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const updated = await FormulaService.updateFormula(id, req.body);
      return sendSuccess(res, updated);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  },
);
