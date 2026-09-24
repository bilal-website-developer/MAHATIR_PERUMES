import { describe, it, expect, beforeEach } from 'vitest';
import { Decimal } from 'decimal.js';
import { BatchService } from '../src/services/batch.service.js';
import { InventoryService } from '../src/services/inventory.service.js';
import { FormulaService } from '../src/services/formula.service.js';

describe('Phase 4: Manufacturing Batches & Bulk Inventory Engine', () => {
  describe('Insufficient Stock Rejection & Atomic All-or-Nothing', () => {
    it('rejects batch confirmation when ANY material is insufficient, leaving stock untouched', async () => {
      // Create a formula that requires massive amount of Rose Damascena Absolute
      // Currently Rose stock is ~150 ml
      const formula = await FormulaService.createFormula(
        {
          perfume_name: 'Massive Test Blend',
          code: 'FRM-TST-MAX',
          target_concentration: 'EDP',
          ingredients: [
            {
              raw_material_id: 'rm-00000001-0000-0000-0000-000000000002', // Rose (150 ml in stock)
              quantity_type: 'percent',
              value: 100,
            },
          ],
        },
        'usr-production',
      );

      // Attempt to make 5,000 ml batch (needs 5,000 ml of Rose)
      const draft = await BatchService.createDraftBatch(
        {
          formula_id: formula.id,
          expected_volume: 5000,
          notes: 'Test batch expecting failure due to stock shortage',
        },
        'usr-production',
      );

      const roseBefore = await InventoryService.getRawMaterialById('rm-00000001-0000-0000-0000-000000000002');
      const stockBefore = new Decimal(roseBefore!.current_stock);

      // Confirmation MUST fail with explicit shortage error
      await expect(
        BatchService.confirmBatch(draft.id, 5000, '', 'usr-production'),
      ).rejects.toThrow(/Insufficient stock for/);

      // Verify ZERO deduction occurred (All-or-Nothing transaction guarantee)
      const roseAfter = await InventoryService.getRawMaterialById('rm-00000001-0000-0000-0000-000000000002');
      const stockAfter = new Decimal(roseAfter!.current_stock);
      expect(stockAfter.toNumber()).toBe(stockBefore.toNumber());

      // Batch status remains draft
      const batchCheck = await BatchService.getBatchById(draft.id);
      expect(batchCheck?.status).toBe('draft');
    });
  });

  describe('Batch Confirmation, Costing Snapshot & Loss Math', () => {
    it('confirms batch, deducts stock, snapshots cost, calculates cost/ml with losses, and locks formula', async () => {
      // Formula: Sultani Rose & Oud (f-00000001-0000-0000-0000-000000000001)
      // Fixed: 20 ml Rose ($28.50/ml -> $570.00)
      // Remaining for 500 ml: 480 ml
      // Alcohol 80%: 384 ml ($0.0180/ml -> $6.912)
      // Ambroxan 20%: 96 g ($1.2000/g -> $115.20)
      // Expected Total Cost: $570.00 + $6.912 + $115.20 = $692.1120
      const draft = await BatchService.createDraftBatch(
        {
          formula_id: 'f-00000001-0000-0000-0000-000000000001',
          expected_volume: 500,
          notes: 'Standard 500ml pilot batch',
        },
        'usr-production',
      );

      expect(draft.status).toBe('draft');

      const roseBefore = await InventoryService.getRawMaterialById('rm-00000001-0000-0000-0000-000000000002');
      const roseStockBefore = new Decimal(roseBefore!.current_stock);

      // Confirm with 480 ml actual volume (20 ml evaporation/testing loss = 4.00% loss)
      const confirmResult = await BatchService.confirmBatch(
        draft.id,
        480,
        'Evaporation and quality lab testing sample',
        'usr-production',
      );

      expect(confirmResult.success).toBe(true);
      const batch = confirmResult.batch;

      expect(batch.status).toBe('bulk');
      expect(batch.actual_volume).toBe('480.0000');
      expect(batch.remaining_volume).toBe('480.0000');
      expect(batch.loss_volume).toBe('20.0000');
      expect(batch.loss_percent).toBe('4.0000');

      // Manual cost verification
      expect(new Decimal(batch.total_cost).toFixed(2)).toBe('692.11');

      // Cost per ml = Total Cost / Actual Volume ($692.112 / 480 ml = $1.4419)
      const expectedCostPerMl = new Decimal(batch.total_cost).div(480).toFixed(4);
      expect(batch.cost_per_ml).toBe(expectedCostPerMl);

      // Verify raw material was deducted
      const roseAfter = await InventoryService.getRawMaterialById('rm-00000001-0000-0000-0000-000000000002');
      const roseStockAfter = new Decimal(roseAfter!.current_stock);
      expect(roseStockBefore.minus(roseStockAfter).toNumber()).toBe(20);

      // Verify formula is now auto-locked
      const formula = await FormulaService.getFormulaById('f-00000001-0000-0000-0000-000000000001');
      expect(formula?.is_locked).toBe(true);

      // Verify bulk inventory has been created
      const bulkLots = await BatchService.getBulkInventory();
      const lot = bulkLots.data.find((b) => b.batch_id === batch.id);
      expect(lot).toBeDefined();
      expect(lot?.current_volume).toBe('480.0000');
    });

    it('requires a mandatory loss reason when actual volume is less than expected', async () => {
      const draft = await BatchService.createDraftBatch(
        {
          formula_id: 'f-00000001-0000-0000-0000-000000000001',
          expected_volume: 500,
        },
        'usr-production',
      );

      // Actual 450 ml < 500 ml without reason -> must throw error
      await expect(
        BatchService.confirmBatch(draft.id, 450, '', 'usr-production'),
      ).rejects.toThrow(/mandatory loss reason/);
    });
  });

  describe('Batch Reversal & Inventory Restoration', () => {
    it('reverses a confirmed bulk batch, restoring raw materials to warehouse stock', async () => {
      // 1. Create and confirm a fresh batch
      const draft = await BatchService.createDraftBatch(
        {
          formula_id: 'f-00000001-0000-0000-0000-000000000001',
          expected_volume: 200,
        },
        'usr-production',
      );

      const confirmResult = await BatchService.confirmBatch(
        draft.id,
        200,
        '',
        'usr-production',
      );

      const roseBeforeReversal = await InventoryService.getRawMaterialById('rm-00000001-0000-0000-0000-000000000002');
      const roseStockBefore = new Decimal(roseBeforeReversal!.current_stock);

      // 2. Reverse batch
      const reverseResult = await BatchService.reverseBatch(
        confirmResult.batch.id,
        'Accidental batch creation by lab assistant',
        'usr-admin',
      );

      expect(reverseResult.success).toBe(true);
      expect(reverseResult.batch.status).toBe('reversed');
      expect(reverseResult.batch.remaining_volume).toBe('0.0000');

      // 3. Verify raw materials were restored to stock
      const roseAfterReversal = await InventoryService.getRawMaterialById('rm-00000001-0000-0000-0000-000000000002');
      const roseStockAfter = new Decimal(roseAfterReversal!.current_stock);
      expect(roseStockAfter.minus(roseStockBefore).toNumber()).toBe(20);
    });

    it('rejects reversal if reason is empty or missing', async () => {
      const draft = await BatchService.createDraftBatch(
        {
          formula_id: 'f-00000001-0000-0000-0000-000000000001',
          expected_volume: 100,
        },
        'usr-production',
      );
      const confirmed = await BatchService.confirmBatch(draft.id, 100, '', 'usr-production');

      await expect(
        BatchService.reverseBatch(confirmed.batch.id, '', 'usr-admin'),
      ).rejects.toThrow(/mandatory audit reason/);
    });
  });
});
