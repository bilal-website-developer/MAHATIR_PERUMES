import { Decimal } from 'decimal.js';
import { ProductService } from './product.service.js';
import { SalesService } from './sales.service.js';
import { FormulaService } from './formula.service.js';

export interface SalesVelocity {
  units_30d: string;
  units_60d: string;
  units_90d: string;
  daily_velocity: string;
}

export interface MaterialRequirementCheck {
  raw_material_id: string;
  raw_material_name: string;
  sku: string;
  category: string;
  base_unit: string;
  required_quantity: string;
  available_stock: string;
  shortage: string;
  is_sufficient: boolean;
}

export interface ProductionSuggestion {
  id: string;
  variant_id: string;
  sku: string;
  variant_name: string;
  product_name: string;
  size_ml: string;
  current_stock: string;
  min_stock_level: string;
  sales_velocity: SalesVelocity;
  days_of_stock_remaining: string;
  urgency: 'critical' | 'high' | 'medium' | 'healthy';
  suggested_units: number;
  suggested_batch_volume_ml: string;
  formula_id?: string;
  formula_name?: string;
  formula_code?: string;
  materials_sufficient: boolean;
  sufficiency_rate_percent: string;
  shortages: MaterialRequirementCheck[];
  all_ingredients: MaterialRequirementCheck[];
  estimated_production_cost: string;
  create_batch_payload: {
    formula_id: string;
    target_volume_ml: number;
    perfume_name: string;
    variant_id: string;
    suggested_units: number;
  } | null;
}

export class SuggestionService {
  /**
   * Calculate 30d, 60d, 90d sales velocity for each variant and generate production suggestions
   * @param targetRunwayDays Target inventory runway in days (default: 30)
   */
  static async getProductionSuggestions(
    targetRunwayDays: number = 30
  ): Promise<{ data: ProductionSuggestion[]; total: number; summary: { urgent_count: number; total_skus: number } }> {
    const { data: variants } = await ProductService.getProductVariants();
    const { data: sales } = await SalesService.getSales();
    const { data: formulas } = await FormulaService.getFormulas();

    const now = Date.now();
    const ms30d = 30 * 24 * 60 * 60 * 1000;
    const ms60d = 60 * 24 * 60 * 60 * 1000;
    const ms90d = 90 * 24 * 60 * 60 * 1000;

    const suggestions: ProductionSuggestion[] = [];
    let urgentCount = 0;

    for (const variant of variants) {
      // 1. Gather all completed sales line items for this variant
      let units30d = new Decimal(0);
      let units60d = new Decimal(0);
      let units90d = new Decimal(0);

      for (const sale of sales) {
        if (sale.status !== 'completed') continue;
        const saleTime = new Date(sale.created_at).getTime();
        const ageMs = now - saleTime;

        if (sale.items) {
          for (const item of sale.items) {
            if (item.variant_id === variant.id && item.item_type === 'bottled') {
              const qty = new Decimal(item.quantity || '0');
              if (ageMs <= ms30d) {
                units30d = units30d.plus(qty);
              }
              if (ageMs <= ms60d) {
                units60d = units60d.plus(qty);
              }
              if (ageMs <= ms90d) {
                units90d = units90d.plus(qty);
              }
            }
          }
        }
      }

      // If no past sales found (e.g. freshly seeded data or newly launched item),
      // we check if an artificial baseline velocity should be applied or based on min_stock
      const v30 = units30d.div(30);
      const v60 = units60d.div(60);
      const v90 = units90d.div(90);

      let dailyVelocity: Decimal;
      if (units30d.gt(0)) {
        // Weighted average favoring recent 30-day velocity
        dailyVelocity = v30.mul(0.6).plus(v60.mul(0.25)).plus(v90.mul(0.15));
      } else if (units90d.gt(0)) {
        dailyVelocity = v90;
      } else {
        // Minimal baseline velocity for active catalogue items without recent sales
        dailyVelocity = new Decimal('0.05');
      }

      const currentStock = new Decimal(variant.current_stock || '0');
      const minStock = new Decimal(variant.min_stock_level || '5');

      // Days of inventory remaining: stock / daily_velocity
      const daysRemainingDec = currentStock.div(dailyVelocity);
      const daysRemaining = daysRemainingDec.toFixed(1);

      // Urgency determination
      let urgency: 'critical' | 'high' | 'medium' | 'healthy';
      if (currentStock.lte(0) || daysRemainingDec.lte(7)) {
        urgency = 'critical';
        urgentCount++;
      } else if (daysRemainingDec.lte(14) || currentStock.lte(minStock)) {
        urgency = 'high';
        urgentCount++;
      } else if (daysRemainingDec.lte(targetRunwayDays)) {
        urgency = 'medium';
      } else {
        urgency = 'healthy';
      }

      // Calculate suggested production units
      // Target: bring stock back to target runway (e.g. 30 days of sales) or minimum 20 units
      let targetUnits = dailyVelocity.mul(targetRunwayDays).ceil();
      if (targetUnits.lt(20)) {
        targetUnits = new Decimal(20);
      }

      let deficitUnits = targetUnits.minus(currentStock);
      if (deficitUnits.lte(0)) {
        deficitUnits = new Decimal(0);
      } else {
        // Round to nearest multiple of 5 for clean production batches
        const remainder = deficitUnits.mod(5);
        if (!remainder.equals(0)) {
          deficitUnits = deficitUnits.plus(new Decimal(5).minus(remainder));
        }
      }

      const suggestedUnitsNum = deficitUnits.toNumber();

      // Find matching formula for this perfume
      const sizeMl = new Decimal(variant.size_ml || '50');
      // Buffer 5% for bottling and filter loss
      const requiredBatchMl = deficitUnits.mul(sizeMl).mul('1.05');

      // Find formula by matching product name or perfume name
      const matchingFormula = formulas.find(
        (f) =>
          f.perfume_name.toLowerCase().includes((variant.product_name || variant.name).toLowerCase()) ||
          (variant.product_name || variant.name).toLowerCase().includes(f.perfume_name.toLowerCase()) ||
          f.status === 'active'
      ) || formulas[0];

      let materialsSufficient = true;
      let sufficiencyRate = '100.00';
      let shortages: MaterialRequirementCheck[] = [];
      let allIngredients: MaterialRequirementCheck[] = [];
      let estimatedCost = '0.00';

      if (matchingFormula && suggestedUnitsNum > 0) {
        try {
          const scaled = await FormulaService.scaleFormula(
            matchingFormula.id,
            requiredBatchMl.toNumber()
          );

          estimatedCost = scaled.estimated_total_cost;
          let sufficientItemsCount = 0;

          for (const ing of scaled.ingredients) {
            const isSufficient = new Decimal(ing.shortage).equals(0);
            if (!isSufficient) {
              materialsSufficient = false;
            } else {
              sufficientItemsCount++;
            }

            const itemCheck: MaterialRequirementCheck = {
              raw_material_id: ing.raw_material_id,
              raw_material_name: ing.name,
              sku: ing.sku,
              category: ing.category,
              base_unit: ing.base_unit,
              required_quantity: ing.required_quantity,
              available_stock: ing.available_stock,
              shortage: ing.shortage,
              is_sufficient: isSufficient,
            };

            allIngredients.push(itemCheck);
            if (!isSufficient) {
              shortages.push(itemCheck);
            }
          }

          if (scaled.ingredients.length > 0) {
            sufficiencyRate = new Decimal(sufficientItemsCount)
              .div(scaled.ingredients.length)
              .mul(100)
              .toFixed(2);
          }
        } catch (_err) {
          // If scaling encounters error, mark as unfulfilled
          materialsSufficient = false;
        }
      }

      suggestions.push({
        id: `sug-${variant.id}`,
        variant_id: variant.id,
        sku: variant.sku,
        variant_name: variant.name,
        product_name: variant.product_name || variant.name,
        size_ml: variant.size_ml,
        current_stock: currentStock.toString(),
        min_stock_level: minStock.toString(),
        sales_velocity: {
          units_30d: units30d.toString(),
          units_60d: units60d.toString(),
          units_90d: units90d.toString(),
          daily_velocity: dailyVelocity.toFixed(2),
        },
        days_of_stock_remaining: daysRemaining,
        urgency,
        suggested_units: suggestedUnitsNum,
        suggested_batch_volume_ml: requiredBatchMl.toFixed(2),
        formula_id: matchingFormula?.id,
        formula_name: matchingFormula?.perfume_name,
        formula_code: matchingFormula?.code,
        materials_sufficient: materialsSufficient,
        sufficiency_rate_percent: sufficiencyRate,
        shortages,
        all_ingredients: allIngredients,
        estimated_production_cost: estimatedCost,
        create_batch_payload: matchingFormula && suggestedUnitsNum > 0 ? {
          formula_id: matchingFormula.id,
          target_volume_ml: requiredBatchMl.toNumber(),
          perfume_name: matchingFormula.perfume_name,
          variant_id: variant.id,
          suggested_units: suggestedUnitsNum,
        } : null,
      });
    }

    // Sort by urgency: critical -> high -> medium -> healthy
    const urgencyWeight: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      healthy: 1,
    };

    suggestions.sort((a, b) => {
      const diff = (urgencyWeight[b.urgency] ?? 0) - (urgencyWeight[a.urgency] ?? 0);
      if (diff !== 0) return diff;
      return new Decimal(a.days_of_stock_remaining).minus(new Decimal(b.days_of_stock_remaining)).toNumber();
    });

    return {
      data: suggestions,
      total: suggestions.length,
      summary: {
        urgent_count: urgentCount,
        total_skus: suggestions.length,
      },
    };
  }
}
