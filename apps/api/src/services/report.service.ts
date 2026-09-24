import { Decimal } from 'decimal.js';
import { InventoryService } from './inventory.service.js';
import { BatchService } from './batch.service.js';
import { BottlingService } from './bottling.service.js';
import { ProductService } from './product.service.js';
import { SalesService } from './sales.service.js';

export interface InventoryValuationItem {
  category: string;
  name: string;
  sku: string;
  quantity: string;
  unit: string;
  unit_cost: string;
  total_valuation: string;
}

export interface InventoryValuationReport {
  summary: {
    total_valuation: string;
    raw_materials_valuation: string;
    bulk_liquid_valuation: string;
    packaging_valuation: string;
    finished_goods_valuation: string;
    total_items_count: number;
  };
  raw_materials: InventoryValuationItem[];
  bulk_liquids: InventoryValuationItem[];
  finished_goods: InventoryValuationItem[];
}

export interface SalesPerformanceReport {
  summary: {
    total_revenue: string;
    total_cogs: string;
    total_profit: string;
    gross_margin_percent: string;
    invoice_count: number;
    average_order_value: string;
  };
  by_payment_method: Record<string, { count: number; total_amount: string }>;
  by_cashier: Record<string, { count: number; total_revenue: string; total_profit: string }>;
  daily_breakdown: Array<{ date: string; invoice_count: number; revenue: string; profit: string }>;
}

export interface SkuProfitabilityItem {
  variant_id: string;
  sku: string;
  product_name: string;
  variant_name: string;
  units_sold: string;
  gross_revenue: string;
  total_cogs: string;
  gross_profit: string;
  margin_percent: string;
}

export interface BatchCostLossItem {
  batch_id: string;
  batch_code: string;
  perfume_name: string;
  expected_volume_ml: string;
  actual_volume_ml: string;
  remaining_volume_ml: string;
  loss_volume_ml: string;
  loss_percent: string;
  total_manufacturing_cost: string;
  cost_per_ml: string;
  status: string;
  production_date: string;
  bottling_runs_count: number;
}

export interface RawMaterialConsumptionItem {
  raw_material_id: string;
  name: string;
  sku: string;
  category: string;
  base_unit: string;
  total_consumed: string;
  unit_cost: string;
  total_cost: string;
}

export interface DashboardMetrics {
  role: string;
  kpis: Record<string, string | number>;
  charts: {
    revenue_vs_profit?: Array<{ label: string; revenue: number; profit: number }>;
    inventory_split?: Array<{ name: string; value: number }>;
    recent_activity?: Array<{ id: string; type: string; title: string; time: string; amount?: string }>;
  };
}

export class ReportService {
  /**
   * 1. Comprehensive Inventory Valuation Report
   */
  static async getInventoryValuation(): Promise<InventoryValuationReport> {
    const rawRes = await InventoryService.getRawMaterials();
    const lotsRes = await BottlingService.getFinishedGoodsLots();
    const batchesRes = await BatchService.getBatches();

    let rawVal = new Decimal(0);
    let pkgVal = new Decimal(0);
    let bulkVal = new Decimal(0);
    let fgVal = new Decimal(0);

    const rawItems: InventoryValuationItem[] = [];
    for (const rm of rawRes.data) {
      const qty = new Decimal(rm.current_stock);
      const cost = new Decimal(rm.cost_per_unit);
      const lineVal = qty.mul(cost);

      if (rm.category === 'packaging') {
        pkgVal = pkgVal.plus(lineVal);
      } else {
        rawVal = rawVal.plus(lineVal);
      }

      rawItems.push({
        category: rm.category,
        name: rm.name,
        sku: rm.sku,
        quantity: qty.toFixed(4),
        unit: rm.base_unit,
        unit_cost: cost.toFixed(4),
        total_valuation: lineVal.toFixed(4),
      });
    }

    const bulkItems: InventoryValuationItem[] = [];
    for (const b of batchesRes.data) {
      const vol = new Decimal(b.remaining_volume || 0);
      if (vol.gt(0)) {
        const costPerMl = new Decimal(b.cost_per_ml || 0);
        const lineVal = vol.mul(costPerMl);
        bulkVal = bulkVal.plus(lineVal);

        bulkItems.push({
          category: 'bulk_liquid',
          name: `${b.perfume_name} (${b.batch_code})`,
          sku: b.batch_code,
          quantity: vol.toFixed(4),
          unit: 'ml',
          unit_cost: costPerMl.toFixed(4),
          total_valuation: lineVal.toFixed(4),
        });
      }
    }

    const fgItems: InventoryValuationItem[] = [];
    for (const lot of lotsRes.data) {
      const qty = new Decimal(lot.current_quantity || 0);
      const unitCost = new Decimal(lot.unit_cost || 0);
      const lineVal = qty.mul(unitCost);
      fgVal = fgVal.plus(lineVal);

      fgItems.push({
        category: 'finished_goods',
        name: `${lot.product_name} - ${lot.variant_name}`,
        sku: lot.variant_sku || lot.lot_number,
        quantity: qty.toFixed(4),
        unit: 'units',
        unit_cost: unitCost.toFixed(4),
        total_valuation: lineVal.toFixed(4),
      });
    }

    const totalVal = rawVal.plus(pkgVal).plus(bulkVal).plus(fgVal);

    return {
      summary: {
        total_valuation: totalVal.toFixed(4),
        raw_materials_valuation: rawVal.toFixed(4),
        bulk_liquid_valuation: bulkVal.toFixed(4),
        packaging_valuation: pkgVal.toFixed(4),
        finished_goods_valuation: fgVal.toFixed(4),
        total_items_count: rawItems.length + bulkItems.length + fgItems.length,
      },
      raw_materials: rawItems,
      bulk_liquids: bulkItems,
      finished_goods: fgItems,
    };
  }

  /**
   * 2. Sales & Cashier Performance Report
   */
  static async getSalesPerformance(filters?: { startDate?: string; endDate?: string }): Promise<SalesPerformanceReport> {
    const salesRes = await SalesService.getSales();
    let sales = salesRes.data.filter((s) => s.status === 'completed');

    if (filters?.startDate) {
      sales = sales.filter((s) => new Date(s.created_at) >= new Date(filters.startDate!));
    }
    if (filters?.endDate) {
      sales = sales.filter((s) => new Date(s.created_at) <= new Date(filters.endDate!));
    }

    let totalRev = new Decimal(0);
    let totalProfit = new Decimal(0);
    const byMethod: Record<string, { count: number; total_amount: string }> = {};
    const byCashier: Record<string, { count: number; total_revenue: string; total_profit: string }> = {};
    const dailyMap: Record<string, { count: number; revenue: Decimal; profit: Decimal }> = {};

    for (const sale of sales) {
      const rev = new Decimal(sale.total_amount || 0);
      const profit = new Decimal(sale.total_profit || 0);
      totalRev = totalRev.plus(rev);
      totalProfit = totalProfit.plus(profit);

      // Payments
      if (sale.payments) {
        for (const p of sale.payments) {
          const method = p.payment_method;
          const pAmount = new Decimal(p.amount || 0);
          if (!byMethod[method]) {
            byMethod[method] = { count: 0, total_amount: '0.0000' };
          }
          byMethod[method].count += 1;
          byMethod[method].total_amount = new Decimal(byMethod[method].total_amount).plus(pAmount).toFixed(4);
        }
      }

      // Cashier
      const cashier = sale.cashier_name || sale.cashier_id || 'Staff';
      if (!byCashier[cashier]) {
        byCashier[cashier] = { count: 0, total_revenue: '0.0000', total_profit: '0.0000' };
      }
      byCashier[cashier].count += 1;
      byCashier[cashier].total_revenue = new Decimal(byCashier[cashier].total_revenue).plus(rev).toFixed(4);
      byCashier[cashier].total_profit = new Decimal(byCashier[cashier].total_profit).plus(profit).toFixed(4);

      // Daily
      const day = sale.created_at.slice(0, 10);
      if (!dailyMap[day]) {
        dailyMap[day] = { count: 0, revenue: new Decimal(0), profit: new Decimal(0) };
      }
      dailyMap[day].count += 1;
      dailyMap[day].revenue = dailyMap[day].revenue.plus(rev);
      dailyMap[day].profit = dailyMap[day].profit.plus(profit);
    }

    const totalCogs = totalRev.minus(totalProfit);
    const marginPct = totalRev.gt(0) ? totalProfit.div(totalRev).mul(100).toFixed(2) : '0.00';
    const aov = sales.length > 0 ? totalRev.div(sales.length).toFixed(4) : '0.0000';

    const dailyBreakdown = Object.entries(dailyMap).map(([date, d]) => ({
      date,
      invoice_count: d.count,
      revenue: d.revenue.toFixed(4),
      profit: d.profit.toFixed(4),
    }));

    return {
      summary: {
        total_revenue: totalRev.toFixed(4),
        total_cogs: totalCogs.toFixed(4),
        total_profit: totalProfit.toFixed(4),
        gross_margin_percent: marginPct,
        invoice_count: sales.length,
        average_order_value: aov,
      },
      by_payment_method: byMethod,
      by_cashier: byCashier,
      daily_breakdown: dailyBreakdown,
    };
  }

  /**
   * 3. Product & SKU Profitability Report
   */
  static async getProductProfitability(): Promise<SkuProfitabilityItem[]> {
    const variantsRes = await ProductService.getProductVariants();
    const salesRes = await SalesService.getSales();
    const completedSales = salesRes.data.filter((s) => s.status === 'completed');

    const skuAggregates: Record<
      string,
      { units: Decimal; revenue: Decimal; cogs: Decimal; profit: Decimal }
    > = {};

    for (const sale of completedSales) {
      if (sale.items) {
        for (const item of sale.items) {
          const varId = item.variant_id;
          if (varId) {
            if (!skuAggregates[varId]) {
              skuAggregates[varId] = {
                units: new Decimal(0),
                revenue: new Decimal(0),
                cogs: new Decimal(0),
                profit: new Decimal(0),
              };
            }
            const q = new Decimal(item.quantity);
            const lineRev = new Decimal(item.line_total);
            const lineProf = new Decimal(item.profit || (item as any).line_profit || 0);
            const lineCost = lineRev.minus(lineProf);

            skuAggregates[varId].units = skuAggregates[varId].units.plus(q);
            skuAggregates[varId].revenue = skuAggregates[varId].revenue.plus(lineRev);
            skuAggregates[varId].cogs = skuAggregates[varId].cogs.plus(lineCost);
            skuAggregates[varId].profit = skuAggregates[varId].profit.plus(lineProf);
          }
        }
      }
    }

    const items: SkuProfitabilityItem[] = [];
    for (const v of variantsRes.data) {
      const agg = skuAggregates[v.id] || {
        units: new Decimal(0),
        revenue: new Decimal(0),
        cogs: new Decimal(0),
        profit: new Decimal(0),
      };

      const margin = agg.revenue.gt(0)
        ? agg.profit.div(agg.revenue).mul(100).toFixed(2)
        : '0.00';

      items.push({
        variant_id: v.id,
        sku: v.sku,
        product_name: v.product_name || 'Fragrance Product',
        variant_name: v.name,
        units_sold: agg.units.toFixed(4),
        gross_revenue: agg.revenue.toFixed(4),
        total_cogs: agg.cogs.toFixed(4),
        gross_profit: agg.profit.toFixed(4),
        margin_percent: margin,
      });
    }

    // Sort by profit descending
    items.sort((a, b) => Number(b.gross_profit) - Number(a.gross_profit));
    return items;
  }

  /**
   * 4. Batch Cost and Loss Analysis Report
   */
  static async getBatchCostAnalysis(): Promise<BatchCostLossItem[]> {
    const batchesRes = await BatchService.getBatches();
    const runsRes = await BottlingService.getBottlingRuns();

    const items: BatchCostLossItem[] = [];
    for (const b of batchesRes.data) {
      const runs = runsRes.data.filter((r) => r.batch_id === b.id);
      items.push({
        batch_id: b.id,
        batch_code: b.batch_code,
        perfume_name: b.perfume_name,
        expected_volume_ml: b.expected_volume,
        actual_volume_ml: b.actual_volume,
        remaining_volume_ml: b.remaining_volume,
        loss_volume_ml: b.loss_volume,
        loss_percent: b.loss_percent,
        total_manufacturing_cost: b.total_cost,
        cost_per_ml: b.cost_per_ml,
        status: b.status,
        production_date: b.production_date,
        bottling_runs_count: runs.length,
      });
    }

    return items;
  }

  /**
   * 5. Raw Material Consumption Report
   */
  static async getRawMaterialConsumption(): Promise<RawMaterialConsumptionItem[]> {
    const batchesRes = await BatchService.getBatches();
    const rawRes = await InventoryService.getRawMaterials();

    const usageAgg: Record<string, { consumed: Decimal; cost: Decimal }> = {};

    for (const b of batchesRes.data) {
      if (b.usages) {
        for (const u of b.usages) {
          const matId = u.raw_material_id;
          if (!usageAgg[matId]) {
            usageAgg[matId] = { consumed: new Decimal(0), cost: new Decimal(0) };
          }
          const q = new Decimal(u.quantity_used);
          const c = new Decimal(u.line_cost);
          usageAgg[matId].consumed = usageAgg[matId].consumed.plus(q);
          usageAgg[matId].cost = usageAgg[matId].cost.plus(c);
        }
      }
    }

    const items: RawMaterialConsumptionItem[] = [];
    for (const rm of rawRes.data) {
      const agg = usageAgg[rm.id];
      if (agg && agg.consumed.gt(0)) {
        items.push({
          raw_material_id: rm.id,
          name: rm.name,
          sku: rm.sku,
          category: rm.category,
          base_unit: rm.base_unit,
          total_consumed: agg.consumed.toFixed(4),
          unit_cost: rm.cost_per_unit,
          total_cost: agg.cost.toFixed(4),
        });
      }
    }

    return items;
  }

  /**
   * Format any JSON array into standard RFC-4180 CSV
   */
  static formatToCsv(rows: Record<string, any>[]): string {
    if (!rows || rows.length === 0 || !rows[0]) return '';
    const headers = Object.keys(rows[0]);
    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headerLine = headers.join(',');
    const bodyLines = rows.map((row) => headers.map((h) => escapeCsv(row[h])).join(','));
    return [headerLine, ...bodyLines].join('\n');
  }

  /**
   * Role-Aware Dashboard Metrics
   */
  static async getDashboardMetrics(role: string): Promise<DashboardMetrics> {
    const valuation = await this.getInventoryValuation();
    const sales = await this.getSalesPerformance();
    const batches = await BatchService.getBatches();
    const rawRes = await InventoryService.getRawMaterials();

    const lowStockCount = rawRes.data.filter((rm) =>
      new Decimal(rm.current_stock).lte(new Decimal(rm.min_stock_level)),
    ).length;

    const inBulkVolume = batches.data
      .filter((b) => b.status === 'bulk')
      .reduce((acc, curr) => acc.plus(curr.remaining_volume || 0), new Decimal(0));

    if (role === 'sales_staff') {
      return {
        role: 'sales_staff',
        kpis: {
          today_revenue: sales.summary.total_revenue,
          completed_orders: sales.summary.invoice_count,
          average_order_value: sales.summary.average_order_value,
          available_perfume_lots: valuation.finished_goods.length,
        },
        charts: {
          revenue_vs_profit: sales.daily_breakdown.map((d) => ({
            label: d.date,
            revenue: Number(d.revenue),
            profit: Number(d.profit),
          })),
        },
      };
    }

    if (role === 'production_manager') {
      return {
        role: 'production_manager',
        kpis: {
          active_batches: batches.data.filter((b) => b.status === 'draft' || b.status === 'bulk').length,
          bulk_liquid_volume_ml: inBulkVolume.toFixed(2),
          bulk_inventory_valuation: valuation.summary.bulk_liquid_valuation,
          low_stock_raw_materials: lowStockCount,
        },
        charts: {
          inventory_split: [
            { name: 'Raw Oils', value: Number(valuation.summary.raw_materials_valuation) },
            { name: 'Bulk Maceration', value: Number(valuation.summary.bulk_liquid_valuation) },
            { name: 'Packaging', value: Number(valuation.summary.packaging_valuation) },
          ],
        },
      };
    }

    if (role === 'inventory_manager') {
      return {
        role: 'inventory_manager',
        kpis: {
          total_warehouse_value: valuation.summary.total_valuation,
          raw_materials_value: valuation.summary.raw_materials_valuation,
          packaging_value: valuation.summary.packaging_valuation,
          reorder_alerts_count: lowStockCount,
        },
        charts: {
          inventory_split: [
            { name: 'Raw Oils', value: Number(valuation.summary.raw_materials_valuation) },
            { name: 'Bulk Liquid', value: Number(valuation.summary.bulk_liquid_valuation) },
            { name: 'Finished Goods', value: Number(valuation.summary.finished_goods_valuation) },
          ],
        },
      };
    }

    // Default to Admin
    return {
      role: 'admin',
      kpis: {
        total_revenue: sales.summary.total_revenue,
        gross_profit: sales.summary.total_profit,
        gross_margin: `${sales.summary.gross_margin_percent}%`,
        total_inventory_valuation: valuation.summary.total_valuation,
        active_production_batches: batches.data.length,
        stock_alerts_count: lowStockCount,
      },
      charts: {
        revenue_vs_profit: sales.daily_breakdown.map((d) => ({
          label: d.date,
          revenue: Number(d.revenue),
          profit: Number(d.profit),
        })),
        inventory_split: [
          { name: 'Raw Materials', value: Number(valuation.summary.raw_materials_valuation) },
          { name: 'Bulk Liquid', value: Number(valuation.summary.bulk_liquid_valuation) },
          { name: 'Packaging', value: Number(valuation.summary.packaging_valuation) },
          { name: 'Finished Goods', value: Number(valuation.summary.finished_goods_valuation) },
        ],
      },
    };
  }
}
