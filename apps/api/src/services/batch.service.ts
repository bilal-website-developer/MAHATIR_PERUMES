import { Decimal } from 'decimal.js';
import { InventoryService } from './inventory.service.js';
import { FormulaService } from './formula.service.js';

export interface BatchUsage {
  id: string;
  batch_id: string;
  raw_material_id: string;
  raw_material_name?: string;
  raw_material_sku?: string;
  quantity_used: string;
  unit: string;
  unit_cost_snapshot: string;
  line_cost: string;
}

export interface BatchLoss {
  id: string;
  batch_id: string;
  reason_type: 'evaporation' | 'spillage' | 'testing' | 'filtration' | 'other';
  volume_ml: string;
  notes?: string;
  created_at: string;
}

export interface Batch {
  id: string;
  branch_id: string;
  batch_code: string;
  perfume_name: string;
  formula_id: string;
  formula_version: number;
  formula_version_label: string;
  production_date: string;
  expected_volume: string;
  actual_volume: string;
  remaining_volume: string;
  total_cost: string;
  cost_per_ml: string;
  loss_percent: string;
  loss_volume: string;
  status: 'draft' | 'bulk' | 'partial_bottled' | 'completed' | 'reversed';
  notes?: string;
  reversal_reason?: string;
  reversed_at?: string;
  reversed_by?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  usages?: BatchUsage[];
  losses?: BatchLoss[];
}

export interface BulkInventoryLot {
  id: string;
  branch_id: string;
  batch_id: string;
  batch_code: string;
  perfume_name: string;
  initial_volume: string;
  current_volume: string;
  cost_per_ml: string;
  status: string;
  created_at: string;
  updated_at: string;
}

let batchCounter = 2;

// Initial realistic batches
let memoryBatches: Batch[] = [
  {
    id: 'bat-00000001-0000-0000-0000-000000000001',
    branch_id: '00000000-0000-0000-0000-000000000001',
    batch_code: 'BAT-2026-0001',
    perfume_name: 'Imperial Cambodi Oud Extrait',
    formula_id: 'f-00000001-0000-0000-0000-000000000002',
    formula_version: 1,
    formula_version_label: 'V1',
    production_date: new Date(Date.now() - 86400000 * 3).toISOString(),
    expected_volume: '1000.0000', // 1,000 ml
    actual_volume: '980.0000', // 980 ml (20 ml evaporation/testing loss)
    remaining_volume: '980.0000',
    total_cost: '13511.7000', // Total raw material cost
    cost_per_ml: '13.7874', // $13,511.70 / 980 ml
    loss_percent: '2.0000', // 2% loss
    loss_volume: '20.0000',
    status: 'bulk',
    notes: 'Premium master batch for 50ml flacon bottling run.',
    created_by: '11111111-1111-1111-1111-111111111111',
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    usages: [
      {
        id: 'bu-0001',
        batch_id: 'bat-00000001-0000-0000-0000-000000000001',
        raw_material_id: 'rm-00000001-0000-0000-0000-000000000001',
        raw_material_name: 'Cambodian Agarwood (Oud) Oil Super Grade',
        raw_material_sku: 'RM-OIL-OUD-01',
        quantity_used: '300.0000',
        unit: 'ml',
        unit_cost_snapshot: '45.0000',
        line_cost: '13500.0000',
      },
      {
        id: 'bu-0002',
        batch_id: 'bat-00000001-0000-0000-0000-000000000001',
        raw_material_id: 'rm-00000001-0000-0000-0000-000000000003',
        raw_material_name: 'Perfume Grade Denatured Ethanol 96% Pure',
        raw_material_sku: 'RM-ALC-ETH-01',
        quantity_used: '650.0000',
        unit: 'ml',
        unit_cost_snapshot: '0.0180',
        line_cost: '11.7000',
      },
    ],
    losses: [
      {
        id: 'bl-0001',
        batch_id: 'bat-00000001-0000-0000-0000-000000000001',
        reason_type: 'filtration',
        volume_ml: '20.0000',
        notes: 'Cold filtration loss and quality testing sample',
        created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      },
    ],
  },
];

let memoryBulkInventory: BulkInventoryLot[] = [
  {
    id: 'blk-00000001-0000-0000-0000-000000000001',
    branch_id: '00000000-0000-0000-0000-000000000001',
    batch_id: 'bat-00000001-0000-0000-0000-000000000001',
    batch_code: 'BAT-2026-0001',
    perfume_name: 'Imperial Cambodi Oud Extrait',
    initial_volume: '980.0000',
    current_volume: '980.0000',
    cost_per_ml: '13.7874',
    status: 'available',
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
];

export class BatchService {
  /**
   * List batches with status, search, and perfume filters
   */
  static async getBatches(filters?: {
    status?: string;
    search?: string;
  }): Promise<{ data: Batch[]; total: number }> {
    let results = [...memoryBatches];
    if (filters?.status && filters.status !== 'all') {
      results = results.filter((b) => b.status === filters.status);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      results = results.filter(
        (b) =>
          b.batch_code.toLowerCase().includes(q) ||
          b.perfume_name.toLowerCase().includes(q) ||
          (b.notes && b.notes.toLowerCase().includes(q)),
      );
    }
    return { data: results, total: results.length };
  }

  static async getBatchById(id: string): Promise<Batch | null> {
    const b = memoryBatches.find((batch) => batch.id === id);
    return b || null;
  }

  /**
   * Create Draft Batch
   */
  static async createDraftBatch(
    data: {
      formula_id: string;
      expected_volume: number | string;
      notes?: string;
    },
    userId: string,
  ): Promise<Batch> {
    const formula = await FormulaService.getFormulaById(data.formula_id);
    if (!formula) {
      throw new Error(`Formula with ID ${data.formula_id} not found.`);
    }

    const expVolDec = new Decimal(data.expected_volume);
    if (expVolDec.lte(0)) {
      throw new Error('Expected batch volume must be greater than zero.');
    }

    // Scale to get estimated breakdown
    const scale = await FormulaService.scaleFormula(formula.id, expVolDec.toNumber());

    const batchCode = `BAT-2026-${String(batchCounter++).padStart(4, '0')}`;
    const batchId = `bat-${Date.now()}`;

    const newBatch: Batch = {
      id: batchId,
      branch_id: '00000000-0000-0000-0000-000000000001',
      batch_code: batchCode,
      perfume_name: formula.perfume_name,
      formula_id: formula.id,
      formula_version: formula.version,
      formula_version_label: formula.version_label,
      production_date: new Date().toISOString(),
      expected_volume: expVolDec.toFixed(4),
      actual_volume: '0.0000',
      remaining_volume: '0.0000',
      total_cost: scale.estimated_total_cost,
      cost_per_ml: scale.cost_per_ml,
      loss_percent: '0.0000',
      loss_volume: '0.0000',
      status: 'draft',
      notes: data.notes || '',
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      usages: [],
      losses: [],
    };

    memoryBatches.unshift(newBatch);
    return newBatch;
  }

  /**
   * Confirm Batch (Atomic Manufacturing Execution)
   * 1. Validates stock for ALL ingredients. If ANY is insufficient -> rejects with ZERO deduction.
   * 2. Deducts raw materials through stock movements.
   * 3. Snapshots unit costs at production time.
   * 4. Calculates loss and sets Cost per ml = total_cost / actual_volume.
   * 5. Creates bulk inventory lot.
   * 6. Locks formula against future alterations.
   */
  static async confirmBatch(
    batchId: string,
    actualVolume: number | string,
    lossReason: string,
    userId: string,
  ): Promise<{ success: boolean; batch: Batch }> {
    const batchIndex = memoryBatches.findIndex((b) => b.id === batchId);
    if (batchIndex === -1 || !memoryBatches[batchIndex]) {
      throw new Error(`Batch with ID ${batchId} not found.`);
    }
    const batch = memoryBatches[batchIndex]!;

    if (batch.status !== 'draft') {
      throw new Error(`Batch ${batch.batch_code} cannot be confirmed because status is '${batch.status}', not 'draft'.`);
    }

    const actualVolDec = new Decimal(actualVolume);
    const expectedVolDec = new Decimal(batch.expected_volume);

    if (actualVolDec.lte(0)) {
      throw new Error('Actual volume produced must be greater than zero.');
    }

    if (actualVolDec.gt(expectedVolDec)) {
      throw new Error(
        `Actual volume (${actualVolDec.toFixed(2)} ml) cannot exceed expected batch volume (${expectedVolDec.toFixed(2)} ml).`,
      );
    }

    // Loss calculations
    let lossVolDec = new Decimal(0);
    let lossPctDec = new Decimal(0);

    if (actualVolDec.lt(expectedVolDec)) {
      lossVolDec = expectedVolDec.minus(actualVolDec);
      lossPctDec = lossVolDec.div(expectedVolDec).mul(100);

      if (!lossReason || lossReason.trim().length === 0) {
        throw new Error(
          `Loss detected (${lossVolDec.toFixed(2)} ml / ${lossPctDec.toFixed(2)}%). A mandatory loss reason is required.`,
        );
      }
    }

    // 1. Scale formula to determine exact ingredient requirements
    const scale = await FormulaService.scaleFormula(batch.formula_id, expectedVolDec.toNumber());

    // 2. Strict Inventory Verification (ALL or NOTHING)
    for (const item of scale.ingredients) {
      const material = await InventoryService.getRawMaterialById(item.raw_material_id);
      const currentStockDec = material ? new Decimal(material.current_stock) : new Decimal(0);
      const requiredQtyDec = new Decimal(item.required_quantity);

      if (currentStockDec.lt(requiredQtyDec)) {
        throw new Error(
          `Insufficient stock for ${item.name}: need ${requiredQtyDec.toFixed(2)} ${item.base_unit}, available ${currentStockDec.toFixed(2)} ${item.base_unit}.`,
        );
      }
    }

    // 3. Atomically Deduct Stock and Snapshot Costs
    let computedTotalCost = new Decimal(0);
    const usages: BatchUsage[] = [];

    for (const item of scale.ingredients) {
      const material = await InventoryService.getRawMaterialById(item.raw_material_id);
      if (!material) throw new Error(`Material ${item.name} not found`);

      const requiredQtyDec = new Decimal(item.required_quantity);
      const unitCostDec = new Decimal(material.cost_per_unit);
      const lineCostDec = requiredQtyDec.mul(unitCostDec);
      computedTotalCost = computedTotalCost.plus(lineCostDec);

      // Deduct from stock
      await InventoryService.adjustStock(
        material.id,
        requiredQtyDec.negated().toNumber(),
        `Batch manufacturing: ${batch.batch_code}`,
        userId,
      );

      usages.push({
        id: `bu-${Date.now()}-${item.raw_material_id}`,
        batch_id: batch.id,
        raw_material_id: material.id,
        raw_material_name: material.name,
        raw_material_sku: material.sku,
        quantity_used: requiredQtyDec.toFixed(4),
        unit: material.base_unit,
        unit_cost_snapshot: unitCostDec.toFixed(4),
        line_cost: lineCostDec.toFixed(4),
      });
    }

    // 4. Cost per ml = Total Cost / Actual Volume (losses raise the cost per ml!)
    const costPerMlDec = computedTotalCost.div(actualVolDec);

    // 5. Record loss if applicable
    const losses: BatchLoss[] = [];
    if (lossVolDec.gt(0)) {
      losses.push({
        id: `bl-${Date.now()}`,
        batch_id: batch.id,
        reason_type: 'evaporation',
        volume_ml: lossVolDec.toFixed(4),
        notes: lossReason.trim(),
        created_at: new Date().toISOString(),
      });
    }

    // 6. Update Batch
    const confirmedBatch: Batch = {
      ...batch,
      actual_volume: actualVolDec.toFixed(4),
      remaining_volume: actualVolDec.toFixed(4),
      total_cost: computedTotalCost.toFixed(4),
      cost_per_ml: costPerMlDec.toFixed(4),
      loss_percent: lossPctDec.toFixed(4),
      loss_volume: lossVolDec.toFixed(4),
      status: 'bulk',
      production_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      usages,
      losses,
    };

    memoryBatches[batchIndex] = confirmedBatch;

    // 7. Create Bulk Inventory Lot
    const bulkLot: BulkInventoryLot = {
      id: `blk-${Date.now()}`,
      branch_id: batch.branch_id,
      batch_id: batch.id,
      batch_code: batch.batch_code,
      perfume_name: batch.perfume_name,
      initial_volume: actualVolDec.toFixed(4),
      current_volume: actualVolDec.toFixed(4),
      cost_per_ml: costPerMlDec.toFixed(4),
      status: 'available',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    memoryBulkInventory.unshift(bulkLot);

    // 8. Auto-lock the formula
    try {
      await FormulaService.lockFormula(
        batch.formula_id,
        `Auto-locked upon production of commercial batch ${batch.batch_code}`,
      );
    } catch (_e) {
      // already locked
    }

    return { success: true, batch: confirmedBatch };
  }

  /**
   * Reverse Batch:
   * Restores consumed materials to warehouse stock with compensating movements,
   * zeros bulk inventory and marks batch reversed.
   */
  static async reverseBatch(
    batchId: string,
    reason: string,
    userId: string,
  ): Promise<{ success: boolean; batch: Batch }> {
    if (!reason || reason.trim().length === 0) {
      throw new Error('A mandatory audit reason is required to reverse a confirmed batch.');
    }

    const batchIndex = memoryBatches.findIndex((b) => b.id === batchId);
    if (batchIndex === -1) {
      throw new Error(`Batch with ID ${batchId} not found.`);
    }

    const batch = memoryBatches[batchIndex]!;
    if (batch.status === 'reversed') {
      throw new Error(`Batch ${batch.batch_code} is already reversed.`);
    }

    if (batch.status !== 'bulk') {
      throw new Error(
        `Cannot reverse batch ${batch.batch_code} in status '${batch.status}'. Only un-bottled bulk batches can be reversed.`,
      );
    }

    // Check bulk inventory has not been consumed
    const bulk = memoryBulkInventory.find((b) => b.batch_id === batchId);
    if (bulk && new Decimal(bulk.current_volume).lt(new Decimal(bulk.initial_volume))) {
      throw new Error(
        `Cannot reverse batch ${batch.batch_code}: bulk liquid has already been consumed by bottling or sales.`,
      );
    }

    // Re-credit consumed materials
    for (const usage of batch.usages || []) {
      const qtyUsed = new Decimal(usage.quantity_used);
      await InventoryService.adjustStock(
        usage.raw_material_id,
        qtyUsed.toNumber(),
        `Batch reversal: ${batch.batch_code} - ${reason.trim()}`,
        userId,
      );
    }

    // Update batch status
    batch.status = 'reversed';
    batch.reversal_reason = reason.trim();
    batch.reversed_at = new Date().toISOString();
    batch.reversed_by = userId;
    batch.remaining_volume = '0.0000';
    batch.updated_at = new Date().toISOString();

    // Zero out bulk inventory lot
    const bulkIndex = memoryBulkInventory.findIndex((b) => b.batch_id === batchId);
    if (bulkIndex !== -1 && memoryBulkInventory[bulkIndex]) {
      const bulkLot = memoryBulkInventory[bulkIndex]!;
      bulkLot.current_volume = '0.0000';
      bulkLot.status = 'reversed';
    }

    return { success: true, batch };
  }

  /**
   * Get Bulk Inventory
   */
  static async getBulkInventory(): Promise<{ data: BulkInventoryLot[]; total: number }> {
    const available = memoryBulkInventory.filter((b) => new Decimal(b.current_volume).gt(0));
    return { data: available, total: available.length };
  }

  /**
   * Sync Batch Lookup
   */
  static getBatchByIdSync(batchId: string): Batch | undefined {
    return memoryBatches.find((b) => b.id === batchId);
  }

  /**
   * Deduct bulk liquid for bottling or decant sales
   */
  static deductBulkLiquidSync(
    batchId: string,
    volumeMl: Decimal,
  ): { remainingVolume: string; costPerMl: string; perfumeName: string; batchCode: string } {
    const batch = memoryBatches.find((b) => b.id === batchId);
    if (!batch) {
      throw new Error(`Batch with ID '${batchId}' not found.`);
    }

    const currentRemaining = new Decimal(batch.remaining_volume);
    if (currentRemaining.lt(volumeMl)) {
      throw new Error(
        `Insufficient bulk liquid in batch ${batch.batch_code}. Required: ${volumeMl.toFixed(2)} ml, Available: ${currentRemaining.toFixed(2)} ml.`,
      );
    }

    const newRemaining = currentRemaining.minus(volumeMl);
    batch.remaining_volume = newRemaining.toFixed(4);
    batch.status = newRemaining.isZero() ? 'completed' : 'partial_bottled';
    batch.updated_at = new Date().toISOString();

    // Update bulk inventory lot
    const bulk = memoryBulkInventory.find((b) => b.batch_id === batchId);
    if (bulk) {
      bulk.current_volume = newRemaining.toFixed(4);
      bulk.status = newRemaining.isZero() ? 'consumed' : 'available';
      bulk.updated_at = new Date().toISOString();
    }

    return {
      remainingVolume: newRemaining.toFixed(4),
      costPerMl: batch.cost_per_ml,
      perfumeName: batch.perfume_name,
      batchCode: batch.batch_code,
    };
  }
}
