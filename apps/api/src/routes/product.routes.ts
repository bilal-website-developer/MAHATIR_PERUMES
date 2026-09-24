import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { ProductService } from '../services/product.service.js';

export const productRouter = Router();

productRouter.use(requireAuth);

const packagingRecipeSchema = z.object({
  name: z.string().min(2, 'Recipe name is required'),
  size_ml: z.number().positive('Size in ml must be greater than zero'),
  description: z.string().optional(),
  items: z.array(
    z.object({
      raw_material_id: z.string().min(1, 'Raw material is required'),
      quantity_per_unit: z.number().positive('Quantity per unit must be greater than zero'),
    }),
  ).min(1, 'At least one packaging material is required'),
});

const productSchema = z.object({
  name: z.string().min(2, 'Product name is required'),
  code: z.string().min(2, 'Product code is required'),
  category: z.string().optional().default('Extrait de Parfum'),
  formula_id: z.string().optional(),
  description: z.string().optional(),
});

const variantSchema = z.object({
  product_id: z.string().min(1, 'Product is required'),
  packaging_recipe_id: z.string().optional(),
  sku: z.string().min(2, 'SKU is required'),
  name: z.string().min(2, 'Variant name is required'),
  size_ml: z.number().positive('Size in ml must be greater than zero'),
  selling_price: z.number().nonnegative('Selling price cannot be negative'),
  barcode: z.string().optional(),
  min_stock_level: z.number().nonnegative().optional(),
});

// GET /api/v1/packaging-recipes
productRouter.get(
  '/packaging-recipes',
  requireRole('admin', 'production_manager', 'inventory_manager'),
  async (_req: Request, res: Response) => {
    const result = await ProductService.getPackagingRecipes();
    return sendSuccess(res, result.data, { total: result.total });
  },
);

// POST /api/v1/packaging-recipes
productRouter.post(
  '/packaging-recipes',
  requireRole('admin', 'production_manager', 'inventory_manager'),
  validate({ body: packagingRecipeSchema }),
  async (req: Request, res: Response) => {
    try {
      const recipe = await ProductService.createPackagingRecipe(req.body);
      return sendSuccess(res, recipe, null, 201);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  },
);

// GET /api/v1/products
productRouter.get(
  '/products',
  requireRole('admin', 'production_manager', 'inventory_manager', 'sales_staff'),
  async (_req: Request, res: Response) => {
    const result = await ProductService.getProducts();
    return sendSuccess(res, result.data, { total: result.total });
  },
);

// POST /api/v1/products
productRouter.post(
  '/products',
  requireRole('admin', 'production_manager'),
  validate({ body: productSchema }),
  async (req: Request, res: Response) => {
    try {
      const product = await ProductService.createProduct(req.body);
      return sendSuccess(res, product, null, 201);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  },
);

// GET /api/v1/product-variants
productRouter.get(
  '/product-variants',
  requireRole('admin', 'production_manager', 'inventory_manager', 'sales_staff'),
  async (_req: Request, res: Response) => {
    const result = await ProductService.getProductVariants();
    return sendSuccess(res, result.data, { total: result.total });
  },
);

// POST /api/v1/product-variants
productRouter.post(
  '/product-variants',
  requireRole('admin', 'production_manager'),
  validate({ body: variantSchema }),
  async (req: Request, res: Response) => {
    try {
      const variant = await ProductService.createProductVariant(req.body);
      return sendSuccess(res, variant, null, 201);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  },
);
