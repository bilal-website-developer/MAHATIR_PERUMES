import { Decimal } from 'decimal.js';
import { supabaseAdmin } from '../config/supabase.js';
import { InventoryService } from './inventory.service.js';

export interface PackagingRecipeItem {
  id: string;
  recipe_id: string;
  raw_material_id: string;
  raw_material_name?: string;
  raw_material_sku?: string;
  quantity_per_unit: string;
  unit_cost?: string;
  line_cost?: string;
}

export interface PackagingRecipe {
  id: string;
  branch_id: string;
  name: string;
  size_ml: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  items?: PackagingRecipeItem[];
  total_packaging_cost?: string;
}

export interface Product {
  id: string;
  branch_id: string;
  formula_id?: string;
  name: string;
  code: string;
  category: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  variants?: ProductVariant[];
}

export interface ProductVariant {
  id: string;
  product_id: string;
  product_name?: string;
  packaging_recipe_id?: string;
  packaging_recipe_name?: string;
  sku: string;
  name: string;
  size_ml: string;
  selling_price: string;
  barcode?: string;
  current_stock: string;
  min_stock_level: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// In-Memory Seed Storage for fallback and tests
let memoryPackagingRecipes: PackagingRecipe[] = [
  {
    id: 'pkg-recipe-50ml',
    branch_id: '00000000-0000-0000-0000-000000000001',
    name: '50ml Signature Luxury Presentation Flacon',
    size_ml: '50.0000',
    description: 'Heavy flint glass 50ml flacon with gold magnetic cap, velvet foil label, and embossed presentation box',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    items: [
      {
        id: 'pri-1',
        recipe_id: 'pkg-recipe-50ml',
        raw_material_id: 'rm-00000001-0000-0000-0000-000000000005',
        raw_material_name: '50ml Heavy Flacon Glass Bottle',
        raw_material_sku: 'RM-PKG-BTL-50',
        quantity_per_unit: '1.0000',
        unit_cost: '3.5000',
        line_cost: '3.5000',
      },
      {
        id: 'pri-2',
        recipe_id: 'pkg-recipe-50ml',
        raw_material_id: 'rm-00000001-0000-0000-0000-000000000006',
        raw_material_name: 'Gold Magnetic Flacon Cap 50ml',
        raw_material_sku: 'RM-PKG-CAP-50',
        quantity_per_unit: '1.0000',
        unit_cost: '1.2000',
        line_cost: '1.2000',
      },
      {
        id: 'pri-3',
        recipe_id: 'pkg-recipe-50ml',
        raw_material_id: 'rm-00000001-0000-0000-0000-000000000007',
        raw_material_name: 'Velvet Soft-Touch Foil Label 50ml',
        raw_material_sku: 'RM-PKG-LBL-50',
        quantity_per_unit: '1.0000',
        unit_cost: '0.4500',
        line_cost: '0.4500',
      },
      {
        id: 'pri-4',
        recipe_id: 'pkg-recipe-50ml',
        raw_material_id: 'rm-00000001-0000-0000-0000-000000000008',
        raw_material_name: 'Embossed Rigid Presentation Box 50ml',
        raw_material_sku: 'RM-PKG-BOX-50',
        quantity_per_unit: '1.0000',
        unit_cost: '2.8000',
        line_cost: '2.8000',
      },
    ],
  },
  {
    id: 'pkg-recipe-100ml',
    branch_id: '00000000-0000-0000-0000-000000000001',
    name: '100ml Grand Prestige Presentation Set',
    size_ml: '100.0000',
    description: '100ml Grand Prestige Flacon Bottle & Box Set',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    items: [
      {
        id: 'pri-5',
        recipe_id: 'pkg-recipe-100ml',
        raw_material_id: 'rm-00000001-0000-0000-0000-000000000009',
        raw_material_name: '100ml Grand Prestige Flacon Bottle & Box Set',
        raw_material_sku: 'RM-PKG-BTL-100',
        quantity_per_unit: '1.0000',
        unit_cost: '7.5000',
        line_cost: '7.5000',
      },
    ],
  },
];

let memoryProducts: Product[] = [
  {
    id: 'prod-00000001-0000-0000-0000-000000000001',
    branch_id: '00000000-0000-0000-0000-000000000001',
    formula_id: 'f-00000001-0000-0000-0000-000000000002',
    name: 'Imperial Cambodi Oud Extrait',
    code: 'MP-OUD-01',
    category: 'Extrait de Parfum',
    description: 'Masterwork agarwood fragrance macerated with Royal Ambergris and Moroccan Rose.',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'prod-00000001-0000-0000-0000-000000000002',
    branch_id: '00000000-0000-0000-0000-000000000001',
    formula_id: 'f-00000001-0000-0000-0000-000000000001',
    name: 'Sultan Rose Damascena Royal',
    code: 'MP-ROSE-01',
    category: 'Extrait de Parfum',
    description: 'Pure Rose Damascena floral heart intensified by golden amber and rare musk.',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

let memoryVariants: ProductVariant[] = [
  {
    id: 'var-00000001-0000-0000-0000-000000000001',
    product_id: 'prod-00000001-0000-0000-0000-000000000001',
    product_name: 'Imperial Cambodi Oud Extrait',
    packaging_recipe_id: 'pkg-recipe-50ml',
    packaging_recipe_name: '50ml Signature Luxury Presentation Flacon',
    sku: 'MP-OUD-50ML',
    name: 'Imperial Cambodi Oud Extrait - 50ml Flacon',
    size_ml: '50.0000',
    selling_price: '295.0000',
    barcode: '890123456001',
    current_stock: '45.0000',
    min_stock_level: '10.0000',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'var-00000001-0000-0000-0000-000000000002',
    product_id: 'prod-00000001-0000-0000-0000-000000000001',
    product_name: 'Imperial Cambodi Oud Extrait',
    packaging_recipe_id: 'pkg-recipe-100ml',
    packaging_recipe_name: '100ml Grand Prestige Presentation Set',
    sku: 'MP-OUD-100ML',
    name: 'Imperial Cambodi Oud Extrait - 100ml Prestige Flacon',
    size_ml: '100.0000',
    selling_price: '495.0000',
    barcode: '890123456002',
    current_stock: '20.0000',
    min_stock_level: '5.0000',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'var-00000001-0000-0000-0000-000000000003',
    product_id: 'prod-00000001-0000-0000-0000-000000000002',
    product_name: 'Sultan Rose Damascena Royal',
    packaging_recipe_id: 'pkg-recipe-50ml',
    packaging_recipe_name: '50ml Signature Luxury Presentation Flacon',
    sku: 'MP-ROSE-50ML',
    name: 'Sultan Rose Damascena Royal - 50ml Flacon',
    size_ml: '50.0000',
    selling_price: '240.0000',
    barcode: '890123456003',
    current_stock: '30.0000',
    min_stock_level: '10.0000',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export class ProductService {
  static clearDemoData(): void {
    const isSeeded = (id: string) => id.includes('00000001') || id.startsWith('pkg-recipe-');
    memoryPackagingRecipes = memoryPackagingRecipes.filter((recipe) => !isSeeded(recipe.id));
    memoryProducts = memoryProducts.filter((product) => !isSeeded(product.id));
    memoryVariants = memoryVariants.filter((variant) => !isSeeded(variant.id));
  }

  /**
   * Get Packaging Recipes
   */
  static async getPackagingRecipes(): Promise<{ data: PackagingRecipe[]; total: number }> {
    if (process.env.NODE_ENV !== 'test') {
      try {
        const { data, error } = await supabaseAdmin
          .from('packaging_recipes')
          .select(`
            *,
            items:packaging_recipe_items(
              *,
              raw_materials:raw_material_id(name, sku, cost_per_unit)
            )
          `)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        if (!error && data) {
          const enriched = data.map((recipe: any) => {
            let totalCost = new Decimal(0);
            const items = (recipe.items || []).map((item: any) => {
              const unitCost = new Decimal(item.raw_materials?.cost_per_unit || '0');
              const qty = new Decimal(item.quantity_per_unit);
              const lineCost = unitCost.mul(qty);
              totalCost = totalCost.add(lineCost);
              return {
                id: item.id,
                recipe_id: item.recipe_id,
                raw_material_id: item.raw_material_id,
                raw_material_name: item.raw_materials?.name,
                raw_material_sku: item.raw_materials?.sku,
                quantity_per_unit: qty.toFixed(4),
                unit_cost: unitCost.toFixed(4),
                line_cost: lineCost.toFixed(4),
              };
            });

            return {
              ...recipe,
              size_ml: new Decimal(recipe.size_ml).toFixed(4),
              items,
              total_packaging_cost: totalCost.toFixed(4),
            };
          });
          return { data: enriched, total: enriched.length };
        }
      } catch (_err) {
        // fallback to memory
      }
    }

    // Populate memory item costs dynamically from InventoryService
    const recipes = memoryPackagingRecipes.map((recipe) => {
      let total = new Decimal(0);
      const items = (recipe.items || []).map((item) => {
        const mat = InventoryService.getMaterialByIdSync(item.raw_material_id);
        const unitCost = mat ? new Decimal(mat.cost_per_unit) : new Decimal(item.unit_cost || 0);
        const qty = new Decimal(item.quantity_per_unit);
        const lineCost = unitCost.mul(qty);
        total = total.add(lineCost);
        return {
          ...item,
          raw_material_name: mat ? mat.name : item.raw_material_name,
          raw_material_sku: mat ? mat.sku : item.raw_material_sku,
          unit_cost: unitCost.toFixed(4),
          line_cost: lineCost.toFixed(4),
        };
      });

      return {
        ...recipe,
        items,
        total_packaging_cost: total.toFixed(4),
      };
    });

    return { data: recipes, total: recipes.length };
  }

  /**
   * Create Packaging Recipe
   */
  static async createPackagingRecipe(
    data: {
      name: string;
      size_ml: number | string;
      description?: string;
      items: { raw_material_id: string; quantity_per_unit: number | string }[];
    },
    branchId = '00000000-0000-0000-0000-000000000001',
  ): Promise<PackagingRecipe> {
    const sizeDec = new Decimal(data.size_ml);
    if (sizeDec.lte(0)) {
      throw new Error('Bottle size in ml must be greater than zero.');
    }
    if (!data.items || data.items.length === 0) {
      throw new Error('A packaging recipe must have at least one packaging material item.');
    }

    const recipeId = `pkg-recipe-${Date.now()}`;
    let totalCost = new Decimal(0);

    const recipeItems: PackagingRecipeItem[] = data.items.map((item, idx) => {
      const mat = InventoryService.getMaterialByIdSync(item.raw_material_id);
      const unitCost = mat ? new Decimal(mat.cost_per_unit) : new Decimal(0);
      const qty = new Decimal(item.quantity_per_unit);
      const lineCost = unitCost.mul(qty);
      totalCost = totalCost.add(lineCost);

      return {
        id: `pri-${Date.now()}-${idx}`,
        recipe_id: recipeId,
        raw_material_id: item.raw_material_id,
        raw_material_name: mat?.name,
        raw_material_sku: mat?.sku,
        quantity_per_unit: qty.toFixed(4),
        unit_cost: unitCost.toFixed(4),
        line_cost: lineCost.toFixed(4),
      };
    });

    const newRecipe: PackagingRecipe = {
      id: recipeId,
      branch_id: branchId,
      name: data.name,
      size_ml: sizeDec.toFixed(4),
      description: data.description,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: recipeItems,
      total_packaging_cost: totalCost.toFixed(4),
    };

    memoryPackagingRecipes.unshift(newRecipe);
    return newRecipe;
  }

  /**
   * Get Products
   */
  static async getProducts(): Promise<{ data: Product[]; total: number }> {
    if (process.env.NODE_ENV !== 'test') {
      try {
        const { data, error } = await supabaseAdmin
          .from('products')
          .select(`
            *,
            variants:product_variants(*)
          `)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return { data, total: data.length };
        }
      } catch (_err) {
        // fallback
      }
    }

    const products = memoryProducts.map((p) => {
      const variants = memoryVariants.filter((v) => v.product_id === p.id && v.is_active);
      return { ...p, variants };
    });

    return { data: products, total: products.length };
  }

  /**
   * Create Product
   */
  static async createProduct(
    data: {
      name: string;
      code: string;
      category?: string;
      formula_id?: string;
      description?: string;
    },
    branchId = '00000000-0000-0000-0000-000000000001',
  ): Promise<Product> {
    const existing = memoryProducts.find((p) => p.code.toLowerCase() === data.code.toLowerCase());
    if (existing) {
      throw new Error(`Product with code '${data.code}' already exists.`);
    }

    const newProduct: Product = {
      id: `prod-${Date.now()}`,
      branch_id: branchId,
      formula_id: data.formula_id,
      name: data.name,
      code: data.code.toUpperCase(),
      category: data.category || 'Extrait de Parfum',
      description: data.description,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      variants: [],
    };

    memoryProducts.unshift(newProduct);
    return newProduct;
  }

  /**
   * Get Product Variants
   */
  static async getProductVariants(): Promise<{ data: ProductVariant[]; total: number }> {
    if (process.env.NODE_ENV !== 'test') {
      try {
        const { data, error } = await supabaseAdmin
          .from('product_variants')
          .select(`
            *,
            products(name),
            packaging_recipes(name)
          `)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        if (!error && data) {
          const enriched = data.map((v: any) => ({
            ...v,
            product_name: v.products?.name,
            packaging_recipe_name: v.packaging_recipes?.name,
            size_ml: new Decimal(v.size_ml).toFixed(4),
            selling_price: new Decimal(v.selling_price).toFixed(4),
            current_stock: new Decimal(v.current_stock).toFixed(4),
          }));
          return { data: enriched, total: enriched.length };
        }
      } catch (_err) {
        // fallback
      }
    }

    return { data: memoryVariants, total: memoryVariants.length };
  }

  /**
   * Create Product Variant
   */
  static async createProductVariant(data: {
    product_id: string;
    packaging_recipe_id?: string;
    sku: string;
    name: string;
    size_ml: number | string;
    selling_price: number | string;
    barcode?: string;
    min_stock_level?: number | string;
  }): Promise<ProductVariant> {
    const existing = memoryVariants.find((v) => v.sku.toLowerCase() === data.sku.toLowerCase());
    if (existing) {
      throw new Error(`Variant with SKU '${data.sku}' already exists.`);
    }

    const prod = memoryProducts.find((p) => p.id === data.product_id);
    if (!prod) {
      throw new Error(`Product with ID '${data.product_id}' not found.`);
    }

    const recipe = data.packaging_recipe_id
      ? memoryPackagingRecipes.find((r) => r.id === data.packaging_recipe_id)
      : undefined;

    const sizeDec = new Decimal(data.size_ml);
    const priceDec = new Decimal(data.selling_price);

    if (sizeDec.lte(0)) {
      throw new Error('Variant bottle size in ml must be greater than zero.');
    }
    if (priceDec.lt(0)) {
      throw new Error('Selling price cannot be negative.');
    }

    const newVariant: ProductVariant = {
      id: `var-${Date.now()}`,
      product_id: prod.id,
      product_name: prod.name,
      packaging_recipe_id: recipe?.id,
      packaging_recipe_name: recipe?.name,
      sku: data.sku.toUpperCase(),
      name: data.name,
      size_ml: sizeDec.toFixed(4),
      selling_price: priceDec.toFixed(4),
      barcode: data.barcode || `890${Date.now().toString().slice(-9)}`,
      current_stock: '0.0000',
      min_stock_level: data.min_stock_level ? new Decimal(data.min_stock_level).toFixed(4) : '5.0000',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    memoryVariants.unshift(newVariant);
    return newVariant;
  }

  /**
   * Synchronous helper for variant lookup
   */
  static getVariantByIdSync(variantId: string): ProductVariant | undefined {
    return memoryVariants.find((v) => v.id === variantId);
  }

  /**
   * Synchronous helper for recipe lookup
   */
  static getRecipeByIdSync(recipeId: string): PackagingRecipe | undefined {
    return memoryPackagingRecipes.find((r) => r.id === recipeId);
  }

  /**
   * Update Variant Stock (Sync helper used during bottling or sale)
   */
  static adjustVariantStockSync(variantId: string, deltaQty: Decimal): void {
    const idx = memoryVariants.findIndex((v) => v.id === variantId);
    if (idx !== -1 && memoryVariants[idx]) {
      const v = memoryVariants[idx]!;
      const current = new Decimal(v.current_stock);
      const updated = current.add(deltaQty);
      if (updated.lt(0)) {
        throw new Error(`Insufficient stock for variant ${v.sku}. Current: ${current.toFixed(0)}, Required: ${deltaQty.abs().toFixed(0)}`);
      }
      v.current_stock = updated.toFixed(4);
      v.updated_at = new Date().toISOString();
    }
  }
}
