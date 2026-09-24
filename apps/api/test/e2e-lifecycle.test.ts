import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import { InventoryService } from '../src/services/inventory.service.js';
import { FormulaService } from '../src/services/formula.service.js';
import { BatchService } from '../src/services/batch.service.js';
import { BottlingService } from '../src/services/bottling.service.js';
import { ProductService } from '../src/services/product.service.js';
import { SalesService } from '../src/services/sales.service.js';
import { TraceabilityService } from '../src/services/traceability.service.js';
import { runInventoryIntegrityAudit } from '../src/scripts/integrity-check.js';

describe('Phase 10: End-to-End Enterprise Lifecycle & System Hardening', () => {
  it('executes complete production lifecycle from purchasing to retail POS checkout and bidirectional traceability', async () => {
    // -------------------------------------------------------------
    // Step 1: Purchasing & Raw Materials Inflow
    // -------------------------------------------------------------
    const suppliersRes = await InventoryService.getSuppliers();
    expect(suppliersRes.data.length).toBeGreaterThan(0);
    const supplier = suppliersRes.data[0];

    const materialsRes = await InventoryService.getRawMaterials({ activeOnly: true });
    expect(materialsRes.data.length).toBeGreaterThanOrEqual(3);
    const oilMaterial = materialsRes.data.find((m) => m.category === 'oil') || materialsRes.data[0];

    // Create PO
    const initialStock = new Decimal(oilMaterial.current_stock);
    const po = await InventoryService.createPurchaseOrder(
      {
        supplier_id: supplier.id,
        notes: 'Phase 10 E2E Lifecycle Test Order',
        items: [
          {
            raw_material_id: oilMaterial.id,
            quantity: 500,
            unit: oilMaterial.base_unit,
            unit_cost: 2.5,
          },
        ],
      },
      'usr-lifecycle-admin',
    );
    expect(po.status).toBe('draft');
    await InventoryService.submitPurchaseOrder(po.id);
    await InventoryService.approvePurchaseOrder(po.id, 'usr-lifecycle-admin');

    // Confirm PO (Stock ledger transaction)
    const confirmedPoResult = await InventoryService.confirmPurchase(po.id, 'usr-lifecycle-admin');
    expect(confirmedPoResult.po.status).toBe('received');

    const updatedOil = await InventoryService.getRawMaterialById(oilMaterial.id);
    const expectedStock = initialStock.plus(500);
    expect(new Decimal(updatedOil!.current_stock).toFixed(4)).toBe(expectedStock.toFixed(4));

    // -------------------------------------------------------------
    // Step 2: Formula Creation & BOM Locking
    // -------------------------------------------------------------
    const alcoholMat =
      materialsRes.data.find((m) => m.category === 'alcohol') || materialsRes.data[1];
    const newFormula = await FormulaService.createFormula(
      {
        perfume_name: 'Royal Sapphire E2E Extrait',
        code: `FRM-E2E-${Date.now()}`,
        target_concentration: 'Extrait de Parfum (30%)',
        notes: 'Grand luxury creation for Phase 10 validation',
        ingredients: [
          {
            raw_material_id: updatedOil!.id,
            quantity_type: 'percent',
            value: 30,
            notes: 'Pure fragrance essence',
          },
          {
            raw_material_id: alcoholMat.id,
            quantity_type: 'percent',
            value: 70,
            notes: 'Organic perfumer ethanol',
          },
        ],
      },
      'usr-lifecycle-admin',
    );
    expect(newFormula.status).toBe('active');

    // Lock formula
    const lockedFormula = await FormulaService.lockFormula(
      newFormula.id,
      'Locked for commercial production batching',
    );
    expect(lockedFormula.is_locked).toBe(true);

    // -------------------------------------------------------------
    // Step 3: Manufacturing Batch Production
    // -------------------------------------------------------------
    const draftBatch = await BatchService.createDraftBatch(
      {
        formula_id: lockedFormula.id,
        expected_volume: 500, // 500ml batch
        notes: 'E2E Validation Batch',
      },
      'usr-lifecycle-admin',
    );
    expect(draftBatch.status).toBe('draft');

    // Confirm Batch with 10ml loss -> actual 490ml produced
    const confirmedBatchResult = await BatchService.confirmBatch(
      draftBatch.id,
      490,
      'QC analytical filtration loss',
      'usr-lifecycle-admin',
    );
    expect(confirmedBatchResult.batch.status).toBe('bulk');
    expect(new Decimal(confirmedBatchResult.batch.actual_volume).toNumber()).toBe(490);
    expect(new Decimal(confirmedBatchResult.batch.remaining_volume).toNumber()).toBe(490);
    expect(new Decimal(confirmedBatchResult.batch.loss_volume).toNumber()).toBe(10);

    // -------------------------------------------------------------
    // Step 4: Bottling into Finished Goods Lot
    // -------------------------------------------------------------
    const variantsRes = await ProductService.getProductVariants();
    expect(variantsRes.data.length).toBeGreaterThan(0);
    const variant = variantsRes.data[0];

    // Bottle 5 units
    const bottlingResult = await BottlingService.executeBottlingRun(
      draftBatch.id,
      variant.id,
      5,
      'usr-lifecycle-admin',
    );
    expect(bottlingResult.success).toBe(true);
    expect(bottlingResult.run.quantity_bottled).toBe('5.0000');
    expect(bottlingResult.lot).toBeDefined();
    expect(bottlingResult.lot.current_quantity).toBe('5.0000');

    // Check remaining volume in batch
    const batchAfterBottling = await BatchService.getBatchById(draftBatch.id);
    const bulkDeducted = new Decimal(bottlingResult.run.bulk_volume_deducted);
    const expectedRemaining = new Decimal(490).minus(bulkDeducted);
    expect(new Decimal(batchAfterBottling!.remaining_volume).toFixed(4)).toBe(
      expectedRemaining.toFixed(4),
    );

    // -------------------------------------------------------------
    // Step 5: Retail POS Sale Execution
    // -------------------------------------------------------------
    const customers = await SalesService.getCustomers();
    const customer = customers.data[0];

    const saleResult = await SalesService.createSale(
      {
        customer_id: customer.id,
        items: [
          {
            item_type: 'bottled',
            lot_id: bottlingResult.lot.id,
            variant_id: variant.id,
            quantity: 2, // Selling 2 bottles
            unit_price: 250,
          },
        ],
        payments: [
          {
            payment_method: 'card',
            amount: 500,
            reference_code: 'POS-E2E-CARD-1234',
          },
        ],
        notes: 'Phase 10 E2E Store Checkout',
      },
      'usr-sales-rep',
    );

    expect(saleResult.sale.total_amount).toBe('500.0000');
    expect(saleResult.sale.status).toBe('completed');
    expect(saleResult.sale.invoice_number).toBeDefined();

    // Verify lot remaining stock decremented from 5 to 3
    const lotsAfterSale = await BottlingService.getFinishedGoodsLots({ variant_id: variant.id });
    const lotAfter = lotsAfterSale.data.find((l) => l.id === bottlingResult.lot.id);
    expect(lotAfter!.current_quantity).toBe('3.0000');

    // -------------------------------------------------------------
    // Step 6: Bidirectional Traceability
    // -------------------------------------------------------------
    // Forward trace from batch
    const forwardTrace = await TraceabilityService.traceForward(draftBatch.id);
    expect(forwardTrace.batch.batch_code).toBe(draftBatch.batch_code);
    expect(forwardTrace.bottling_runs.length).toBeGreaterThan(0);

    // Backward trace from sale
    const backwardTrace = await TraceabilityService.traceBackward(saleResult.sale.id);
    expect(backwardTrace.sale.id).toBe(saleResult.sale.id);
    expect(backwardTrace.trace_items.length).toBe(1);
    expect(backwardTrace.trace_items[0].lot).toBeDefined();
    expect(backwardTrace.trace_items[0].lot!.batch_id).toBe(draftBatch.id);

    // -------------------------------------------------------------
    // Step 7: Negative Stock Prevention Enforcement
    // -------------------------------------------------------------
    // Attempting to sell more than current lot balance (3 remaining, requesting 100) must fail
    await expect(
      SalesService.createSale(
        {
          customer_id: customer.id,
          items: [
            {
              item_type: 'bottled',
              lot_id: bottlingResult.lot.id,
              variant_id: variant.id,
              quantity: 100,
              unit_price: 250,
            },
          ],
          payments: [
            {
              payment_method: 'cash',
              amount: 25000,
            },
          ],
        },
        'usr-sales-rep',
      ),
    ).rejects.toThrow(/Insufficient stock/i);

    // -------------------------------------------------------------
    // Step 8: Full Inventory Integrity Audit
    // -------------------------------------------------------------
    const integrityAudit = await runInventoryIntegrityAudit();
    // Debug: log failed checks to understand which check is failing
    const failedChecks = integrityAudit.results.filter((r) => !r.passed);
    if (failedChecks.length > 0) {
      console.error('INTEGRITY AUDIT FAILURES:', JSON.stringify(failedChecks, null, 2));
    }
    expect(integrityAudit.allPassed).toBe(true);
    expect(integrityAudit.failedChecks).toBe(0);
    expect(integrityAudit.passedChecks).toBe(4);
  });
});
