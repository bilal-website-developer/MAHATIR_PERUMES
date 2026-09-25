import { Decimal } from 'decimal.js';
import { InventoryService } from './inventory.service.js';

export interface FormulaIngredient {
  id: string;
  formula_id: string;
  raw_material_id: string;
  raw_material_name?: string;
  raw_material_sku?: string;
  raw_material_category?: string;
  base_unit?: string;
  quantity_type: 'percent' | 'fixed_ml';
  value: string; // numeric string e.g. "80.0000" or "20.0000"
  position: number;
  notes?: string;
  created_at: string;
}

export interface Formula {
  id: string;
  branch_id: string;
  perfume_name: string;
  code: string;
  version: number;
  version_label: string;
  status: 'active' | 'archived' | 'draft';
  is_locked: boolean;
  locked_reason?: string;
  locked_at?: string;
  target_concentration: string; // 'Extrait', 'EDP', 'EDT'
  notes?: string;
  description?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  ingredients?: FormulaIngredient[];
}

export interface ScaledIngredient {
  ingredient_id: string;
  raw_material_id: string;
  name: string;
  sku: string;
  category: string;
  base_unit: string;
  quantity_type: 'percent' | 'fixed_ml';
  formula_value: string;
  required_quantity: string;
  available_stock: string;
  shortage: string;
  unit_cost: string;
  line_cost: string;
}

export interface ScaleResult {
  formula_id: string;
  perfume_name: string;
  version_label: string;
  target_total_ml: string;
  fixed_ml_total: string;
  remaining_ml: string;
  is_fulfillable: boolean;
  estimated_total_cost: string;
  cost_per_ml: string;
  ingredients: ScaledIngredient[];
}

// Initial luxury perfume formulas
let memoryFormulas: Formula[] = [
  {
    id: 'f-00000001-0000-0000-0000-000000000001',
    branch_id: '00000000-0000-0000-0000-000000000001',
    perfume_name: 'Sultani Rose & Oud',
    code: 'FRM-SRO-01',
    version: 1,
    version_label: 'V1',
    status: 'active',
    is_locked: false,
    target_concentration: 'EDP',
    notes: 'Precious royal blend: 20 ml fixed floral base + 80% Ethanol + 20% Fixative.',
    description: 'A distinguished oriental woody floral composition featuring genuine Bulgarian Damask Rose and Ambroxan.',
    created_by: '11111111-1111-1111-1111-111111111111',
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    ingredients: [
      {
        id: 'fi-0001',
        formula_id: 'f-00000001-0000-0000-0000-000000000001',
        raw_material_id: 'rm-00000001-0000-0000-0000-000000000002', // Rose Damascena Absolute
        raw_material_name: 'Rose Damascena Absolute Grade A',
        raw_material_sku: 'RM-OIL-ROSE-02',
        raw_material_category: 'oil',
        base_unit: 'ml',
        quantity_type: 'fixed_ml',
        value: '20.0000', // 20 ml fixed floral base
        position: 1,
        created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      },
      {
        id: 'fi-0002',
        formula_id: 'f-00000001-0000-0000-0000-000000000001',
        raw_material_id: 'rm-00000001-0000-0000-0000-000000000003', // Perfume Grade Ethanol
        raw_material_name: 'Perfume Grade Denatured Ethanol 96% Pure',
        raw_material_sku: 'RM-ALC-ETH-01',
        raw_material_category: 'alcohol',
        base_unit: 'ml',
        quantity_type: 'percent',
        value: '80.0000', // 80% of remaining volume
        position: 2,
        created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      },
      {
        id: 'fi-0003',
        formula_id: 'f-00000001-0000-0000-0000-000000000001',
        raw_material_id: 'rm-00000001-0000-0000-0000-000000000004', // Ambroxan
        raw_material_name: 'Ambroxan Pure Crystals Fixative',
        raw_material_sku: 'RM-FIX-AMB-01',
        raw_material_category: 'fixative',
        base_unit: 'g',
        quantity_type: 'percent',
        value: '20.0000', // 20% of remaining volume
        position: 3,
        created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      },
    ],
  },
  {
    id: 'f-00000001-0000-0000-0000-000000000002',
    branch_id: '00000000-0000-0000-0000-000000000001',
    perfume_name: 'Imperial Cambodi Oud Extrait',
    code: 'FRM-OUD-EX-01',
    version: 1,
    version_label: 'V1',
    status: 'active',
    is_locked: true,
    locked_reason: 'Locked upon commercial batch production batch #BAT-2026-0001',
    locked_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    target_concentration: 'Extrait de Parfum (30%)',
    notes: 'Master perfumer flagship recipe. Locked against further changes.',
    description: 'High concentration artisanal Cambodi Oud with natural fixatives.',
    created_by: '11111111-1111-1111-1111-111111111111',
    created_at: new Date(Date.now() - 86400000 * 8).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    ingredients: [
      {
        id: 'fi-0004',
        formula_id: 'f-00000001-0000-0000-0000-000000000002',
        raw_material_id: 'rm-00000001-0000-0000-0000-000000000001', // Cambodian Oud
        raw_material_name: 'Cambodian Agarwood (Oud) Oil Super Grade',
        raw_material_sku: 'RM-OIL-OUD-01',
        raw_material_category: 'oil',
        base_unit: 'ml',
        quantity_type: 'percent',
        value: '30.0000', // 30% concentration
        position: 1,
        created_at: new Date(Date.now() - 86400000 * 8).toISOString(),
      },
      {
        id: 'fi-0005',
        formula_id: 'f-00000001-0000-0000-0000-000000000002',
        raw_material_id: 'rm-00000001-0000-0000-0000-000000000003', // Ethanol
        raw_material_name: 'Perfume Grade Denatured Ethanol 96% Pure',
        raw_material_sku: 'RM-ALC-ETH-01',
        raw_material_category: 'alcohol',
        base_unit: 'ml',
        quantity_type: 'percent',
        value: '65.0000',
        position: 2,
        created_at: new Date(Date.now() - 86400000 * 8).toISOString(),
      },
      {
        id: 'fi-0006',
        formula_id: 'f-00000001-0000-0000-0000-000000000002',
        raw_material_id: 'rm-00000001-0000-0000-0000-000000000004', // Ambroxan Fixative
        raw_material_name: 'Ambroxan Pure Crystals Fixative',
        raw_material_sku: 'RM-FIX-AMB-01',
        raw_material_category: 'fixative',
        base_unit: 'g',
        quantity_type: 'percent',
        value: '5.0000',
        position: 3,
        created_at: new Date(Date.now() - 86400000 * 8).toISOString(),
      },
    ],
  },
];

export class FormulaService {
  static clearDemoData(): void {
    memoryFormulas = memoryFormulas.filter((formula) => !formula.id.includes('00000001'));
  }

  /**
   * Validates formula ingredients:
   * 1. Fixed ml ingredients must have values > 0.
   * 2. Percentage ingredients, if present, must sum to exactly 100.00%.
   */
  static validateIngredients(
    ingredients: Array<{ quantity_type: 'percent' | 'fixed_ml'; value: number | string }>,
  ): { isValid: boolean; fixedSum: Decimal; percentSum: Decimal; error?: string } {
    let fixedSum = new Decimal(0);
    let percentSum = new Decimal(0);

    for (const ing of ingredients) {
      const val = new Decimal(ing.value || 0);
      if (val.lte(0)) {
        return { isValid: false, fixedSum, percentSum, error: 'Ingredient value must be greater than zero.' };
      }

      if (ing.quantity_type === 'fixed_ml') {
        fixedSum = fixedSum.plus(val);
      } else if (ing.quantity_type === 'percent') {
        percentSum = percentSum.plus(val);
      }
    }

    // If there are percentage ingredients, they MUST sum to exactly 100%
    if (percentSum.gt(0) && !percentSum.equals(100)) {
      return {
        isValid: false,
        fixedSum,
        percentSum,
        error: `Formula percentage ingredients must sum to exactly 100%. Current sum: ${percentSum.toFixed(2)}%`,
      };
    }

    return { isValid: true, fixedSum, percentSum };
  }

  /**
   * Scale formula: Computes scaled recipe for any target batch volume in ml.
   * Returns required quantity in base unit, available warehouse stock, shortage, unit cost, and line cost.
   */
  static async scaleFormula(formulaId: string, targetTotalMl: number | string): Promise<ScaleResult> {
    const targetMlDec = new Decimal(targetTotalMl);
    if (targetMlDec.lte(0)) {
      throw new Error('Target batch volume must be greater than zero.');
    }

    const formula = await this.getFormulaById(formulaId);
    if (!formula) {
      throw new Error(`Formula with ID ${formulaId} not found.`);
    }

    const ingredients = formula.ingredients || [];
    if (ingredients.length === 0) {
      throw new Error('Formula has no ingredients to scale.');
    }

    // 1. Calculate fixed ingredients sum and percentage sum
    let fixedMlTotal = new Decimal(0);
    let percentTotal = new Decimal(0);

    for (const item of ingredients) {
      const val = new Decimal(item.value);
      if (item.quantity_type === 'fixed_ml') {
        fixedMlTotal = fixedMlTotal.plus(val);
      } else {
        percentTotal = percentTotal.plus(val);
      }
    }

    if (fixedMlTotal.gt(targetMlDec)) {
      throw new Error(
        `Total fixed base ingredients (${fixedMlTotal.toFixed(2)} ml) exceed target batch volume (${targetMlDec.toFixed(2)} ml).`,
      );
    }

    if (percentTotal.gt(0) && !percentTotal.equals(100)) {
      throw new Error(
        `Formula percentage ingredients must sum to exactly 100%. Current sum: ${percentTotal.toFixed(2)}%`,
      );
    }

    const remainingMl = targetMlDec.minus(fixedMlTotal);

    // 2. Scale each ingredient and check warehouse stock
    let estimatedTotalCost = new Decimal(0);
    let isFulfillable = true;
    const scaledIngredients: ScaledIngredient[] = [];

    for (const item of ingredients) {
      const material = await InventoryService.getRawMaterialById(item.raw_material_id);
      const currentStockDec = material ? new Decimal(material.current_stock) : new Decimal(0);
      const unitCostDec = material ? new Decimal(material.cost_per_unit) : new Decimal(0);

      let requiredQtyDec: Decimal;
      if (item.quantity_type === 'fixed_ml') {
        requiredQtyDec = new Decimal(item.value);
      } else {
        requiredQtyDec = remainingMl.mul(new Decimal(item.value)).div(100);
      }

      // Check shortage
      let shortageDec = new Decimal(0);
      if (currentStockDec.lt(requiredQtyDec)) {
        shortageDec = requiredQtyDec.minus(currentStockDec);
        isFulfillable = false;
      }

      const lineCostDec = requiredQtyDec.mul(unitCostDec);
      estimatedTotalCost = estimatedTotalCost.plus(lineCostDec);

      scaledIngredients.push({
        ingredient_id: item.id,
        raw_material_id: item.raw_material_id,
        name: material ? material.name : item.raw_material_name || 'Material',
        sku: material ? material.sku : item.raw_material_sku || '',
        category: material ? material.category : item.raw_material_category || 'oil',
        base_unit: material ? material.base_unit : item.base_unit || 'ml',
        quantity_type: item.quantity_type,
        formula_value: item.value,
        required_quantity: requiredQtyDec.toFixed(4),
        available_stock: currentStockDec.toFixed(4),
        shortage: shortageDec.toFixed(4),
        unit_cost: unitCostDec.toFixed(4),
        line_cost: lineCostDec.toFixed(4),
      });
    }

    const costPerMl = targetMlDec.gt(0) ? estimatedTotalCost.div(targetMlDec).toFixed(4) : '0.0000';

    return {
      formula_id: formula.id,
      perfume_name: formula.perfume_name,
      version_label: formula.version_label,
      target_total_ml: targetMlDec.toFixed(4),
      fixed_ml_total: fixedMlTotal.toFixed(4),
      remaining_ml: remainingMl.toFixed(4),
      is_fulfillable: isFulfillable,
      estimated_total_cost: estimatedTotalCost.toFixed(4),
      cost_per_ml: costPerMl,
      ingredients: scaledIngredients,
    };
  }

  // --- CRUD METHODS ---
  static async getFormulas(filters?: {
    search?: string;
    status?: string;
  }): Promise<{ data: Formula[]; total: number }> {
    let results = [...memoryFormulas];
    if (filters?.status && filters.status !== 'all') {
      results = results.filter((f) => f.status === filters.status);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      results = results.filter(
        (f) =>
          f.perfume_name.toLowerCase().includes(q) ||
          f.code.toLowerCase().includes(q) ||
          (f.description && f.description.toLowerCase().includes(q)),
      );
    }
    return { data: results, total: results.length };
  }

  static async getFormulaById(id: string): Promise<Formula | null> {
    const f = memoryFormulas.find((formula) => formula.id === id);
    return f || null;
  }

  static async createFormula(
    data: {
      perfume_name: string;
      code: string;
      target_concentration?: string;
      notes?: string;
      description?: string;
      ingredients: Array<{
        raw_material_id: string;
        quantity_type: 'percent' | 'fixed_ml';
        value: number | string;
        notes?: string;
      }>;
    },
    userId: string,
  ): Promise<Formula> {
    // 1. Validate ingredients 100% rule
    const validation = this.validateIngredients(data.ingredients);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    // 2. Check unique active formula name
    const existingActive = memoryFormulas.find(
      (f) =>
        f.status === 'active' &&
        f.perfume_name.trim().toLowerCase() === data.perfume_name.trim().toLowerCase(),
    );
    if (existingActive) {
      throw new Error(
        `An active formula for '${data.perfume_name}' already exists (Version ${existingActive.version_label}). Please archive it or create a new version (V+1).`,
      );
    }

    const formulaId = `f-${Date.now()}`;
    const ingredients: FormulaIngredient[] = [];

    for (const [i, item] of data.ingredients.entries()) {
      const mat = await InventoryService.getRawMaterialById(item.raw_material_id);
      ingredients.push({
        id: `fi-${Date.now()}-${i}`,
        formula_id: formulaId,
        raw_material_id: item.raw_material_id,
        raw_material_name: mat ? mat.name : 'Raw Material',
        raw_material_sku: mat ? mat.sku : '',
        raw_material_category: mat ? mat.category : 'oil',
        base_unit: mat ? mat.base_unit : 'ml',
        quantity_type: item.quantity_type,
        value: new Decimal(item.value).toFixed(4),
        position: i + 1,
        notes: item.notes,
        created_at: new Date().toISOString(),
      });
    }

    const newFormula: Formula = {
      id: formulaId,
      branch_id: '00000000-0000-0000-0000-000000000001',
      perfume_name: data.perfume_name,
      code: data.code,
      version: 1,
      version_label: 'V1',
      status: 'active',
      is_locked: false,
      target_concentration: data.target_concentration || 'EDP',
      notes: data.notes || '',
      description: data.description || '',
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ingredients,
    };

    memoryFormulas.unshift(newFormula);
    return newFormula;
  }

  /**
   * Clone formula to new version (V+1)
   */
  static async cloneToNewVersion(
    formulaId: string,
    archivePrevious: boolean = true,
    userId: string,
  ): Promise<Formula> {
    const parent = await this.getFormulaById(formulaId);
    if (!parent) {
      throw new Error(`Formula with ID ${formulaId} not found.`);
    }

    if (archivePrevious) {
      parent.status = 'archived';
      parent.updated_at = new Date().toISOString();
    }

    const newVersionNumber = parent.version + 1;
    const newFormulaId = `f-${Date.now()}`;

    const clonedIngredients: FormulaIngredient[] = (parent.ingredients || []).map((ing, idx) => ({
      ...ing,
      id: `fi-${Date.now()}-${idx}`,
      formula_id: newFormulaId,
      created_at: new Date().toISOString(),
    }));

    const clonedFormula: Formula = {
      id: newFormulaId,
      branch_id: parent.branch_id,
      perfume_name: parent.perfume_name,
      code: `${parent.code}-V${newVersionNumber}`,
      version: newVersionNumber,
      version_label: `V${newVersionNumber}`,
      status: 'active',
      is_locked: false,
      target_concentration: parent.target_concentration,
      notes: `Cloned from ${parent.version_label}. ${parent.notes || ''}`.trim(),
      description: parent.description,
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ingredients: clonedIngredients,
    };

    memoryFormulas.unshift(clonedFormula);
    return clonedFormula;
  }

  /**
   * Lock formula (enforce immutability)
   */
  static async lockFormula(formulaId: string, reason: string): Promise<Formula> {
    const formula = await this.getFormulaById(formulaId);
    if (!formula) {
      throw new Error(`Formula with ID ${formulaId} not found.`);
    }

    formula.is_locked = true;
    formula.locked_reason = reason || 'Locked by master perfumer';
    formula.locked_at = new Date().toISOString();
    formula.updated_at = new Date().toISOString();
    return formula;
  }

  /**
   * Update formula (blocked if locked)
   */
  static async updateFormula(
    formulaId: string,
    updates: Partial<Formula>,
  ): Promise<Formula> {
    const formula = await this.getFormulaById(formulaId);
    if (!formula) {
      throw new Error(`Formula with ID ${formulaId} not found.`);
    }

    // Auto-lock enforcement: cannot edit locked formulas
    if (formula.is_locked) {
      throw new Error(
        `Formula '${formula.perfume_name}' (${formula.version_label}) is locked and cannot be edited. Please create a new version (V+1).`,
      );
    }

    if (updates.ingredients) {
      const validation = this.validateIngredients(updates.ingredients as any);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }
    }

    const index = memoryFormulas.findIndex((f) => f.id === formulaId);
    memoryFormulas[index] = {
      ...formula,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    return memoryFormulas[index];
  }

  /**
   * Archive formula
   */
  static async archiveFormula(formulaId: string): Promise<Formula> {
    const formula = await this.getFormulaById(formulaId);
    if (!formula) {
      throw new Error(`Formula with ID ${formulaId} not found.`);
    }
    formula.status = 'archived';
    formula.updated_at = new Date().toISOString();
    return formula;
  }
}
