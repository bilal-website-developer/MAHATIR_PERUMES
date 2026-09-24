import { Decimal } from 'decimal.js';
import { InventoryService, RawMaterial } from './inventory.service.js';
import { FormulaService, Formula } from './formula.service.js';
import { BatchService, Batch } from './batch.service.js';

export type ConcentrationType = 'extrait' | 'edp' | 'edt' | 'edc' | 'custom';

export interface DilutionPreset {
  id: string;
  name: string;
  concentration_type: ConcentrationType;
  oil_percentage: string;
  alcohol_percentage: string;
  fixative_percentage: string;
  water_percentage: string;
  description: string;
  is_default: boolean;
}

export interface DilutionAdditiveInput {
  raw_material_id: string;
  percentage: number | string;
  notes?: string;
}

export interface DilutionCalculateInput {
  target_volume: number | string;
  concentration_type: ConcentrationType;
  oil_percentage: number | string;
  oil_material_id?: string;
  alcohol_material_id?: string;
  additives?: DilutionAdditiveInput[];
}

export interface DilutedComponent {
  component_type: 'oil' | 'alcohol' | 'fixative' | 'additive';
  raw_material_id: string;
  material_name: string;
  material_sku: string;
  material_category: string;
  base_unit: string;
  percentage: string;
  required_volume_ml: string;
  available_stock: string;
  shortage: string;
  unit_cost: string;
  line_cost: string;
  notes?: string;
}

export interface DilutionCalculationResult {
  target_volume_ml: string;
  concentration_type: ConcentrationType;
  oil_percentage: string;
  alcohol_percentage: string;
  total_percentage: string;
  is_fulfillable: boolean;
  total_cost: string;
  cost_per_ml: string;
  components: DilutedComponent[];
}

export interface SaveDilutionAsFormulaInput {
  perfume_name: string;
  code: string;
  target_concentration?: string;
  notes?: string;
  description?: string;
  calculation: DilutionCalculationResult;
}

export interface ConvertDilutionToBatchInput {
  formula_id?: string;
  perfume_name?: string;
  code?: string;
  target_volume: number | string;
  calculation?: DilutionCalculationResult;
  notes?: string;
}

const memoryPresets: DilutionPreset[] = [
  {
    id: 'dp-001',
    name: 'Signature Extrait de Parfum (30%)',
    concentration_type: 'extrait',
    oil_percentage: '30.0000',
    alcohol_percentage: '65.0000',
    fixative_percentage: '5.0000',
    water_percentage: '0.0000',
    description: 'Ultra-concentrated luxury perfume extrait with 5% Ambroxan/fixative for maximum sillage and longevity.',
    is_default: true,
  },
  {
    id: 'dp-002',
    name: 'Grand Extrait Pure (40%)',
    concentration_type: 'extrait',
    oil_percentage: '40.0000',
    alcohol_percentage: '60.0000',
    fixative_percentage: '0.0000',
    water_percentage: '0.0000',
    description: 'Heavy concentration pure extrait for rare attars and artisanal oud blends.',
    is_default: false,
  },
  {
    id: 'dp-003',
    name: 'Standard Eau de Parfum (20%)',
    concentration_type: 'edp',
    oil_percentage: '20.0000',
    alcohol_percentage: '77.0000',
    fixative_percentage: '3.0000',
    water_percentage: '0.0000',
    description: 'Classic luxury EDP ratio balancing diffusion and persistence with 3% fixative.',
    is_default: true,
  },
  {
    id: 'dp-004',
    name: 'Intense Eau de Parfum (25%)',
    concentration_type: 'edp',
    oil_percentage: '25.0000',
    alcohol_percentage: '72.0000',
    fixative_percentage: '3.0000',
    water_percentage: '0.0000',
    description: 'High-intensity EDP formulation optimized for evening and cold-weather fragrances.',
    is_default: false,
  },
  {
    id: 'dp-005',
    name: 'Standard Eau de Toilette (10%)',
    concentration_type: 'edt',
    oil_percentage: '10.0000',
    alcohol_percentage: '88.0000',
    fixative_percentage: '2.0000',
    water_percentage: '0.0000',
    description: 'Fresh, radiant daily scent with vibrant projection.',
    is_default: true,
  },
  {
    id: 'dp-006',
    name: 'Artisanal Eau de Cologne (4%)',
    concentration_type: 'edc',
    oil_percentage: '4.0000',
    alcohol_percentage: '94.0000',
    fixative_percentage: '1.0000',
    water_percentage: '1.0000',
    description: 'Traditional citrus splash cologne with soft cooling touch.',
    is_default: true,
  },
];

export class DilutionService {
  /**
   * Get dilution presets
   */
  static async getPresets(): Promise<DilutionPreset[]> {
    return [...memoryPresets];
  }

  /**
   * Pure Dilution Calculator
   * Accurately calculates oil, alcohol, and additive volumes in ml,
   * looks up warehouse inventory stock and weighted average costs (WAC),
   * and computes total estimated batch cost and cost per ml.
   */
  static async calculate(input: DilutionCalculateInput): Promise<DilutionCalculationResult> {
    const targetMl = new Decimal(input.target_volume);
    if (targetMl.lte(0)) {
      throw new Error('Target batch volume must be greater than zero.');
    }

    const oilPct = new Decimal(input.oil_percentage);
    if (oilPct.lte(0) || oilPct.gt(100)) {
      throw new Error('Oil concentration percentage must be between 0.01% and 100%.');
    }

    // 1. Gather materials from inventory
    const rawMaterialsRes = await InventoryService.getRawMaterials();
    const materials = rawMaterialsRes.data;

    // Resolve oil material
    let oilMat: RawMaterial | undefined;
    if (input.oil_material_id) {
      oilMat = materials.find((m) => m.id === input.oil_material_id);
    }
    if (!oilMat) {
      oilMat = materials.find((m) => m.category === 'oil' && m.is_active) || materials[0];
    }

    // Resolve alcohol material (Ethanol 96%)
    let alcoholMat: RawMaterial | undefined;
    if (input.alcohol_material_id) {
      alcoholMat = materials.find((m) => m.id === input.alcohol_material_id);
    }
    if (!alcoholMat) {
      alcoholMat = materials.find((m) => m.category === 'alcohol' && m.is_active);
    }

    // 2. Sum additives percentages
    let additivesPctTotal = new Decimal(0);
    const resolvedAdditives: Array<{ mat: RawMaterial; pct: Decimal; notes?: string }> = [];

    if (input.additives && input.additives.length > 0) {
      for (const add of input.additives) {
        const pctDec = new Decimal(add.percentage || 0);
        if (pctDec.lt(0)) {
          throw new Error('Additive percentage cannot be negative.');
        }
        if (pctDec.gt(0)) {
          const mat = materials.find((m) => m.id === add.raw_material_id);
          if (!mat) {
            throw new Error(`Additive material with ID ${add.raw_material_id} not found in inventory.`);
          }
          additivesPctTotal = additivesPctTotal.plus(pctDec);
          resolvedAdditives.push({ mat, pct: pctDec, notes: add.notes });
        }
      }
    }

    // 3. Compute alcohol percentage
    const nonAlcoholPct = oilPct.plus(additivesPctTotal);
    if (nonAlcoholPct.gt(100)) {
      throw new Error(
        `Total concentration of oil (${oilPct.toFixed(2)}%) and additives (${additivesPctTotal.toFixed(
          2,
        )}%) cannot exceed 100%. Total: ${nonAlcoholPct.toFixed(2)}%`,
      );
    }

    const alcoholPct = new Decimal(100).minus(nonAlcoholPct);

    // 4. Build components breakdown
    const components: DilutedComponent[] = [];
    let isFulfillable = true;
    let totalCostDec = new Decimal(0);

    // Add Oil Component
    if (oilMat) {
      const oilVol = targetMl.mul(oilPct).div(100);
      const stock = new Decimal(oilMat.current_stock);
      const unitCost = new Decimal(oilMat.cost_per_unit);
      const lineCost = oilVol.mul(unitCost);
      const shortage = oilVol.gt(stock) ? oilVol.minus(stock) : new Decimal(0);

      if (shortage.gt(0)) isFulfillable = false;
      totalCostDec = totalCostDec.plus(lineCost);

      components.push({
        component_type: 'oil',
        raw_material_id: oilMat.id,
        material_name: oilMat.name,
        material_sku: oilMat.sku,
        material_category: oilMat.category,
        base_unit: oilMat.base_unit,
        percentage: oilPct.toFixed(4),
        required_volume_ml: oilVol.toFixed(4),
        available_stock: stock.toFixed(4),
        shortage: shortage.toFixed(4),
        unit_cost: unitCost.toFixed(4),
        line_cost: lineCost.toFixed(4),
      });
    }

    // Add Additives
    for (const add of resolvedAdditives) {
      const addVol = targetMl.mul(add.pct).div(100);
      const stock = new Decimal(add.mat.current_stock);
      const unitCost = new Decimal(add.mat.cost_per_unit);
      const lineCost = addVol.mul(unitCost);
      const shortage = addVol.gt(stock) ? addVol.minus(stock) : new Decimal(0);

      if (shortage.gt(0)) isFulfillable = false;
      totalCostDec = totalCostDec.plus(lineCost);

      components.push({
        component_type: add.mat.category === 'fixative' ? 'fixative' : 'additive',
        raw_material_id: add.mat.id,
        material_name: add.mat.name,
        material_sku: add.mat.sku,
        material_category: add.mat.category,
        base_unit: add.mat.base_unit,
        percentage: add.pct.toFixed(4),
        required_volume_ml: addVol.toFixed(4),
        available_stock: stock.toFixed(4),
        shortage: shortage.toFixed(4),
        unit_cost: unitCost.toFixed(4),
        line_cost: lineCost.toFixed(4),
        notes: add.notes,
      });
    }

    // Add Alcohol Component
    if (alcoholMat && alcoholPct.gt(0)) {
      const alcVol = targetMl.mul(alcoholPct).div(100);
      const stock = new Decimal(alcoholMat.current_stock);
      const unitCost = new Decimal(alcoholMat.cost_per_unit);
      const lineCost = alcVol.mul(unitCost);
      const shortage = alcVol.gt(stock) ? alcVol.minus(stock) : new Decimal(0);

      if (shortage.gt(0)) isFulfillable = false;
      totalCostDec = totalCostDec.plus(lineCost);

      components.push({
        component_type: 'alcohol',
        raw_material_id: alcoholMat.id,
        material_name: alcoholMat.name,
        material_sku: alcoholMat.sku,
        material_category: alcoholMat.category,
        base_unit: alcoholMat.base_unit,
        percentage: alcoholPct.toFixed(4),
        required_volume_ml: alcVol.toFixed(4),
        available_stock: stock.toFixed(4),
        shortage: shortage.toFixed(4),
        unit_cost: unitCost.toFixed(4),
        line_cost: lineCost.toFixed(4),
      });
    }

    const costPerMl = targetMl.gt(0) ? totalCostDec.div(targetMl).toFixed(4) : '0.0000';

    return {
      target_volume_ml: targetMl.toFixed(4),
      concentration_type: input.concentration_type,
      oil_percentage: oilPct.toFixed(4),
      alcohol_percentage: alcoholPct.toFixed(4),
      total_percentage: new Decimal(100).toFixed(4),
      is_fulfillable: isFulfillable,
      total_cost: totalCostDec.toFixed(4),
      cost_per_ml: costPerMl,
      components,
    };
  }

  /**
   * Action 1: Save as Formula
   * Creates a formal formula and BOM in the formula registry without re-entering data.
   */
  static async saveAsFormula(input: SaveDilutionAsFormulaInput, userId: string): Promise<Formula> {
    const ingredients = input.calculation.components.map((c) => ({
      raw_material_id: c.raw_material_id,
      quantity_type: 'percent' as const,
      value: c.percentage,
      notes: `${c.component_type.toUpperCase()} component (${c.percentage}%)`,
    }));

    const concentrationLabel =
      input.target_concentration ||
      (input.calculation.concentration_type === 'extrait'
        ? 'Extrait'
        : input.calculation.concentration_type === 'edp'
        ? 'EDP'
        : input.calculation.concentration_type === 'edt'
        ? 'EDT'
        : input.calculation.concentration_type === 'edc'
        ? 'EDC'
        : 'Custom');

    const formula = await FormulaService.createFormula(
      {
        perfume_name: input.perfume_name,
        code: input.code,
        target_concentration: concentrationLabel,
        notes: input.notes || `Created via Dilution Calculator (${input.calculation.oil_percentage}% oil)`,
        description: input.description,
        ingredients,
      },
      userId,
    );

    return formula;
  }

  /**
   * Action 2: Convert to Batch
   * Takes dilution parameters or pre-calculated formulation and immediately creates a manufacturing batch.
   */
  static async convertToBatch(input: ConvertDilutionToBatchInput, userId: string): Promise<Batch> {
    let formulaId = input.formula_id;

    // If formula doesn't exist yet, save it automatically
    if (!formulaId) {
      if (!input.calculation) {
        throw new Error('Calculation result or formula_id is required to create a manufacturing batch.');
      }

      const perfumeName = input.perfume_name || `Dilution Formula ${Date.now()}`;
      const code = input.code || `DIL-${Date.now().toString().slice(-6)}`;

      const formula = await this.saveAsFormula(
        {
          perfume_name: perfumeName,
          code,
          calculation: input.calculation,
          notes: 'Auto-saved formula during direct dilution-to-batch conversion',
        },
        userId,
      );
      formulaId = formula.id;
    }

    const batch = await BatchService.createDraftBatch(
      {
        formula_id: formulaId,
        expected_volume: Number(input.target_volume),
        notes: input.notes || 'Initiated directly from Dilution Calculator studio',
      },
      userId,
    );

    return batch;
  }
}
