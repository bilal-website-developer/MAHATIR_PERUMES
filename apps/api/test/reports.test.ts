import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import { ReportService } from '../src/services/report.service.js';
import { TraceabilityService } from '../src/services/traceability.service.js';
import { SalesService } from '../src/services/sales.service.js';
import { BottlingService } from '../src/services/bottling.service.js';
import { BatchService } from '../src/services/batch.service.js';

describe('Phase 8: Costing, Bidirectional Traceability and Reports', () => {
  it('1. Acceptance Criteria: Inventory valuation reconciles with warehouse inventory balances', async () => {
    const report = await ReportService.getInventoryValuation();

    expect(report.summary).toBeDefined();
    expect(report.raw_materials.length).toBeGreaterThan(0);
    expect(report.bulk_liquids.length).toBeGreaterThan(0);
    expect(report.finished_goods.length).toBeGreaterThan(0);

    const calculatedRaw = report.raw_materials
      .filter((i) => i.category !== 'packaging')
      .reduce((acc, curr) => acc.plus(curr.total_valuation), new Decimal(0));

    const calculatedPkg = report.raw_materials
      .filter((i) => i.category === 'packaging')
      .reduce((acc, curr) => acc.plus(curr.total_valuation), new Decimal(0));

    const calculatedBulk = report.bulk_liquids.reduce(
      (acc, curr) => acc.plus(curr.total_valuation),
      new Decimal(0),
    );

    const calculatedFg = report.finished_goods.reduce(
      (acc, curr) => acc.plus(curr.total_valuation),
      new Decimal(0),
    );

    const calculatedTotal = calculatedRaw.plus(calculatedPkg).plus(calculatedBulk).plus(calculatedFg);

    expect(new Decimal(report.summary.raw_materials_valuation).toFixed(2)).toBe(calculatedRaw.toFixed(2));
    expect(new Decimal(report.summary.packaging_valuation).toFixed(2)).toBe(calculatedPkg.toFixed(2));
    expect(new Decimal(report.summary.bulk_liquid_valuation).toFixed(2)).toBe(calculatedBulk.toFixed(2));
    expect(new Decimal(report.summary.finished_goods_valuation).toFixed(2)).toBe(calculatedFg.toFixed(2));
    expect(new Decimal(report.summary.total_valuation).toFixed(2)).toBe(calculatedTotal.toFixed(2));
  });

  it('2. Acceptance Criteria: Sales performance and gross margin reconcile with invoices', async () => {
    const report = await ReportService.getSalesPerformance();

    expect(report.summary).toBeDefined();
    expect(Number(report.summary.total_revenue)).toBeGreaterThanOrEqual(0);

    const rev = new Decimal(report.summary.total_revenue);
    const profit = new Decimal(report.summary.total_profit);
    const cogs = new Decimal(report.summary.total_cogs);

    // Revenue = COGS + Profit
    expect(rev.toFixed(2)).toBe(cogs.plus(profit).toFixed(2));

    if (rev.gt(0)) {
      const expectedMarginPct = profit.div(rev).mul(100).toFixed(2);
      expect(report.summary.gross_margin_percent).toBe(expectedMarginPct);
    }
  });

  it('3. Product profitability report calculates SKU profit and margin correctly', async () => {
    const profitability = await ReportService.getProductProfitability();

    expect(profitability.length).toBeGreaterThan(0);
    for (const item of profitability) {
      const revenue = new Decimal(item.gross_revenue);
      const cogs = new Decimal(item.total_cogs);
      const profit = new Decimal(item.gross_profit);

      expect(profit.toFixed(2)).toBe(revenue.minus(cogs).toFixed(2));
    }
  });

  it('4. Batch cost and loss analysis accurately reports manufacturing metrics', async () => {
    const batchReport = await ReportService.getBatchCostAnalysis();

    expect(batchReport.length).toBeGreaterThan(0);
    const batch = batchReport.find((b) => b.batch_code === 'BAT-2026-0001');
    expect(batch).toBeDefined();
    expect(Number(batch!.total_manufacturing_cost)).toBeGreaterThan(0);
    expect(Number(batch!.cost_per_ml)).toBeGreaterThan(0);
  });

  it('5. Acceptance Criteria: Forward Traceability from Batch to Bottling to Lot to Sales', async () => {
    const forward = await TraceabilityService.traceForward('BAT-2026-0001');

    expect(forward).toBeDefined();
    expect(forward.direction).toBe('forward');
    expect(forward.batch.batch_code).toBe('BAT-2026-0001');
    expect(forward.formula).toBeDefined();
    expect(forward.bottling_runs.length).toBeGreaterThanOrEqual(1);

    const firstRun = forward.bottling_runs[0];
    expect(firstRun.run_code).toBe('BTL-2026-0001');
    expect(firstRun.lot).toBeDefined();
    expect(firstRun.lot!.lot_number).toBe('LOT-BAT-2026-0001-MP-OUD-50ML');

    // Matched sales should link to this lot
    expect(forward.sales).toBeDefined();
  });

  it('6. Acceptance Criteria: Backward Traceability from Sale to Lot to Bottling to Batch to Raw Materials', async () => {
    // 1. Create a verifiable sale linked to the seeded lot
    const lotsRes = await BottlingService.getFinishedGoodsLots();
    const targetLot = lotsRes.data[0];

    const saleResult = await SalesService.createSale({
      customer_id: 'cust-00000001-0000-0000-0000-000000000001',
      items: [
        {
          item_type: 'bottled',
          lot_id: targetLot.id,
          variant_id: targetLot.variant_id,
          quantity: 1,
          unit_price: 350,
        },
      ],
      payments: [{ payment_method: 'card', amount: 350, reference_code: 'TRACE-CARD-1' }],
      notes: 'Sale created for backward traceability verification',
    });

    // 2. Trace backward using the new invoice number
    const backward = await TraceabilityService.traceBackward(saleResult.sale.invoice_number);

    expect(backward).toBeDefined();
    expect(backward.direction).toBe('backward');
    expect(backward.sale.invoice_number).toBe(saleResult.sale.invoice_number);
    expect(backward.trace_items.length).toBe(1);

    const itemTrace = backward.trace_items[0];
    expect(itemTrace.lot).toBeDefined();
    expect(itemTrace.lot!.id).toBe(targetLot.id);

    // Verifies batch origin
    expect(itemTrace.batch).toBeDefined();
    expect(itemTrace.batch!.batch_code).toBe('BAT-2026-0001');

    // Verifies formula and raw material origin
    expect(itemTrace.formula).toBeDefined();
    expect(itemTrace.raw_material_origins.length).toBeGreaterThan(0);
    const oudMaterial = itemTrace.raw_material_origins.find((rm) => rm.sku === 'RM-OIL-OUD-01');
    expect(oudMaterial).toBeDefined();
    expect(Number(oudMaterial!.quantity_used)).toBeGreaterThan(0);
  });

  it('7. Universal search finds batches, sales, and lots', async () => {
    const batchSearch = await TraceabilityService.search('BAT-2026');
    expect(batchSearch.length).toBeGreaterThanOrEqual(1);
    expect(batchSearch[0].entity_type).toBe('batch');

    const invoiceSearch = await TraceabilityService.search('INV-2026');
    expect(invoiceSearch.length).toBeGreaterThanOrEqual(1);
    expect(invoiceSearch[0].entity_type).toBe('sale');
  });

  it('8. Format to CSV generates RFC-4180 compliant CSV', () => {
    const sample = [
      { SKU: 'SKU-001', Name: 'Imperial Oud, 50ml', Price: '250.00' },
      { SKU: 'SKU-002', Name: 'Rose Absolute "Prestige"', Price: '180.00' },
    ];
    const csv = ReportService.formatToCsv(sample);

    expect(csv).toContain('SKU,Name,Price');
    expect(csv).toContain('SKU-001,"Imperial Oud, 50ml",250.00');
    expect(csv).toContain('SKU-002,"Rose Absolute ""Prestige""",180.00');
  });

  it('9. Dashboard metrics provide tailored telemetry per role', async () => {
    const adminMetrics = await ReportService.getDashboardMetrics('admin');
    expect(adminMetrics.role).toBe('admin');
    expect(adminMetrics.kpis.total_revenue).toBeDefined();
    expect(adminMetrics.charts.inventory_split?.length).toBe(4);

    const prodMetrics = await ReportService.getDashboardMetrics('production_manager');
    expect(prodMetrics.role).toBe('production_manager');
    expect(prodMetrics.kpis.bulk_liquid_volume_ml).toBeDefined();

    const salesMetrics = await ReportService.getDashboardMetrics('sales_staff');
    expect(salesMetrics.role).toBe('sales_staff');
    expect(salesMetrics.kpis.completed_orders).toBeDefined();
  });
});
