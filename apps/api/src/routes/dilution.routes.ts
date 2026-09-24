import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { DilutionService } from '../services/dilution.service.js';

export const dilutionRouter = Router();

dilutionRouter.use(requireAuth);

const calculateSchema = z.object({
  target_volume: z.number().positive('Target volume must be greater than zero'),
  concentration_type: z.enum(['extrait', 'edp', 'edt', 'edc', 'custom']),
  oil_percentage: z.number().positive('Oil percentage must be positive').max(100, 'Oil percentage cannot exceed 100%'),
  oil_material_id: z.string().optional(),
  alcohol_material_id: z.string().optional(),
  additives: z
    .array(
      z.object({
        raw_material_id: z.string().min(1, 'Raw material ID is required'),
        percentage: z.number().nonnegative('Percentage cannot be negative'),
        notes: z.string().optional(),
      }),
    )
    .optional(),
});

const saveFormulaSchema = z.object({
  perfume_name: z.string().min(2, 'Perfume name must be at least 2 characters'),
  code: z.string().min(2, 'Formula code must be at least 2 characters'),
  target_concentration: z.string().optional(),
  notes: z.string().optional(),
  description: z.string().optional(),
  calculation: z.object({
    target_volume_ml: z.string(),
    concentration_type: z.enum(['extrait', 'edp', 'edt', 'edc', 'custom']),
    oil_percentage: z.string(),
    alcohol_percentage: z.string(),
    total_percentage: z.string(),
    is_fulfillable: z.boolean(),
    total_cost: z.string(),
    cost_per_ml: z.string(),
    components: z.array(
      z.object({
        component_type: z.enum(['oil', 'alcohol', 'fixative', 'additive']),
        raw_material_id: z.string(),
        material_name: z.string(),
        material_sku: z.string(),
        material_category: z.string(),
        base_unit: z.string(),
        percentage: z.string(),
        required_volume_ml: z.string(),
        available_stock: z.string(),
        shortage: z.string(),
        unit_cost: z.string(),
        line_cost: z.string(),
        notes: z.string().optional(),
      }),
    ),
  }),
});

const toBatchSchema = z.object({
  formula_id: z.string().optional(),
  perfume_name: z.string().optional(),
  code: z.string().optional(),
  target_volume: z.number().positive('Target volume must be greater than zero'),
  calculation: saveFormulaSchema.shape.calculation.optional(),
  notes: z.string().optional(),
});

// GET /api/v1/dilution/presets
dilutionRouter.get(
  '/dilution/presets',
  requireRole('admin', 'production_manager', 'inventory_manager', 'sales_staff'),
  async (_req: Request, res: Response) => {
    const presets = await DilutionService.getPresets();
    return sendSuccess(res, presets);
  },
);

// POST /api/v1/dilution/calculate
dilutionRouter.post(
  '/dilution/calculate',
  requireRole('admin', 'production_manager', 'inventory_manager', 'sales_staff'),
  validate({ body: calculateSchema }),
  async (req: Request, res: Response) => {
    try {
      const result = await DilutionService.calculate(req.body);
      return sendSuccess(res, result);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  },
);

// POST /api/v1/dilution/save-formula
dilutionRouter.post(
  '/dilution/save-formula',
  requireRole('admin', 'production_manager'),
  validate({ body: saveFormulaSchema }),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || 'usr-prod-mgr';
      const formula = await DilutionService.saveAsFormula(req.body, userId);
      return sendSuccess(res, formula, null, 201);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  },
);

// POST /api/v1/dilution/to-batch
dilutionRouter.post(
  '/dilution/to-batch',
  requireRole('admin', 'production_manager'),
  validate({ body: toBatchSchema }),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || 'usr-prod-mgr';
      const batch = await DilutionService.convertToBatch(req.body, userId);
      return sendSuccess(res, batch, null, 201);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  },
);
