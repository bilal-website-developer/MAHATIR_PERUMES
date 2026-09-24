import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import { ProductService } from '../src/services/product.service.js';
import { BottlingService } from '../src/services/bottling.service.js';
import { BatchService } from '../src/services/batch.service.js';
import { InventoryService } from '../src/services/inventory.service.js';

describe('Phase 5: Packaging, Bottling, Finished Goods and Variants', () => {
  it('1. getPackagingRecipes returns active recipes with component items and packaging cost', async () => {
    const res = await ProductService.getPackagingRecipes();
    expect(res.data).toBeInstanceOf(Array);
    expect(res.data.length).toBeGreaterThanOrEqual(1);

    const recipe50 = res.data.find((r) => r.id === 'pkg-recipe-50ml');
    expect(recipe50).toBeDefined();
    expect(recipe50!.items!.length).toBe(4); // bottle, cap, label, box
    // Total packaging cost: 3.50 + 1.20 + 0.45 + 2.80 = 7.95
    expect(recipe50!.total_packaging_cost).toBe('7.9500');
  });

  it('2. getProducts and getProductVariants returns master catalog and SKUs', async () => {
    const prodRes = await ProductService.getProducts();
    expect(prodRes.data.length).toBeGreaterThanOrEqual(2);

    const varRes = await ProductService.getProductVariants();
    expect(varRes.data.length).toBeGreaterThanOrEqual(2);

    const oud50 = varRes.data.find((v) => v.sku === 'MP-OUD-50ML');
    expect(oud50).toBeDefined();
    expect(oud50!.size_ml).toBe('50.0000');
    expect(oud50!.selling_price).toBe('295.0000');
  });

  it('3. previewBottling accurately previews required bulk ml, packaging BOM, and unit cost', async () => {
    // 20 bottles of 50ml = 1000ml bulk needed
    const preview = await BottlingService.previewBottling(
      'bat-00000001-0000-0000-0000-000000000001',
      'var-00000001-0000-0000-0000-000000000001',
      20,
    );

    expect(preview.bulk_needed_ml).toBe('1000.0000');
    expect(preview.quantity_bottled).toBe('20.0000');
    expect(preview.packaging_items.length).toBe(4);

    // Packaging items required should each be 20.0000
    for (const item of preview.packaging_items) {
      expect(item.quantity_required).toBe('20.0000');
    }

    // Packaging cost per unit should be $7.95
    expect(preview.packaging_cost_per_unit).toBe('7.9500');
    // Unit Cost = (Cost/ml * 50ml) + 7.95
    const expectedUnitCost = new Decimal(preview.cost_per_ml).mul(50).add('7.95').toFixed(4);
    expect(preview.estimated_unit_cost).toBe(expectedUnitCost);
  });

  it('4. Acceptance Criteria: Bottling 20 x 50ml deducts 1000ml bulk, packaging items, and creates finished goods lot with correct unit cost', async () => {
    // Check initial stock of variant and packaging materials
    const bottleMatBefore = await InventoryService.getRawMaterialById('rm-00000001-0000-0000-0000-000000000005');
    const bottleStockBefore = new Decimal(bottleMatBefore!.current_stock);

    const varBefore = ProductService.getVariantByIdSync('var-00000001-0000-0000-0000-000000000001');
    const varStockBefore = new Decimal(varBefore!.current_stock);

    const batchBefore = BatchService.getBatchByIdSync('bat-00000001-0000-0000-0000-000000000001');
    const bulkBefore = new Decimal(batchBefore!.remaining_volume);

    // Execute Bottling Run: 10 bottles of 50ml = 500ml bulk
    const result = await BottlingService.executeBottlingRun(
      'bat-00000001-0000-0000-0000-000000000001',
      'var-00000001-0000-0000-0000-000000000001',
      10,
      'usr-production',
    );

    expect(result.success).toBe(true);
    const { run, lot } = result;

    expect(run.run_code).toMatch(/^BTL-2026-\d{4}$/);
    expect(run.bulk_volume_deducted).toBe('500.0000');
    expect(run.quantity_bottled).toBe('10.0000');

    // Lot Verification
    expect(lot.initial_quantity).toBe('10.0000');
    expect(lot.current_quantity).toBe('10.0000');
    expect(lot.lot_number).toBe('LOT-BAT-2026-0001-MP-OUD-50ML');

    // Verify Variant Stock increased by 10
    const varAfter = ProductService.getVariantByIdSync('var-00000001-0000-0000-0000-000000000001');
    expect(new Decimal(varAfter!.current_stock).toNumber()).toBe(varStockBefore.add(10).toNumber());

    // Verify Packaging material deducted by 10
    const bottleMatAfter = await InventoryService.getRawMaterialById('rm-00000001-0000-0000-0000-000000000005');
    expect(new Decimal(bottleMatAfter!.current_stock).toNumber()).toBe(bottleStockBefore.minus(10).toNumber());

    // Verify Bulk liquid remaining deducted by 500ml
    const batchAfter = BatchService.getBatchByIdSync('bat-00000001-0000-0000-0000-000000000001');
    expect(new Decimal(batchAfter!.remaining_volume).toNumber()).toBe(bulkBefore.minus(500).toNumber());
  });

  it('5. Insufficient bulk liquid or packaging item rejects bottling without any deduction', async () => {
    // Attempt to bottle 5,000 bottles = 250,000 ml (far exceeding bulk and packaging stock)
    await expect(
      BottlingService.executeBottlingRun(
        'bat-00000001-0000-0000-0000-000000000001',
        'var-00000001-0000-0000-0000-000000000001',
        5000,
        'usr-production',
      ),
    ).rejects.toThrow(/Insufficient bulk liquid/i);
  });
});
