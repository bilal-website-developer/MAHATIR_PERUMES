import { BatchService, Batch } from './batch.service.js';
import { BottlingService, FinishedGoodsLot, BottlingRun } from './bottling.service.js';
import { SalesService, Sale } from './sales.service.js';
import { FormulaService, Formula } from './formula.service.js';

export interface ForwardTraceResult {
  query: string;
  direction: 'forward';
  batch: Batch;
  formula: Formula | null;
  bottling_runs: Array<
    BottlingRun & {
      variant_sku?: string;
      variant_name?: string;
      lot?: FinishedGoodsLot;
    }
  >;
  sales: Array<{
    invoice_number: string;
    sale_id: string;
    sale_date: string;
    customer_name: string;
    item_type: string;
    lot_number?: string;
    quantity: string;
    unit_price: string;
    line_total: string;
  }>;
}

export interface BackwardTraceItem {
  sale_item_id: string;
  item_type: 'bottled' | 'decant';
  quantity: string;
  unit_price: string;
  unit_cost_snapshot: string;
  line_profit: string;
  lot?: FinishedGoodsLot;
  bottling_run?: BottlingRun;
  batch?: Batch;
  formula?: Formula | null;
  raw_material_origins: Array<{
    raw_material_id: string;
    name: string;
    sku: string;
    quantity_used: string;
    unit: string;
    unit_cost_snapshot: string;
  }>;
}

export interface BackwardTraceResult {
  query: string;
  direction: 'backward';
  sale: Sale;
  trace_items: BackwardTraceItem[];
}

export interface TraceSearchResult {
  entity_type: 'batch' | 'sale' | 'lot';
  id: string;
  code_or_number: string;
  title: string;
  subtitle: string;
  date: string;
}

export class TraceabilityService {
  /**
   * Forward Traceability: Batch -> Bottling Runs -> Finished Goods Lots -> Sales -> Customers
   */
  static async traceForward(batchIdOrCode: string): Promise<ForwardTraceResult> {
    const q = batchIdOrCode.trim().toLowerCase();
    const batchesRes = await BatchService.getBatches();
    const batch = batchesRes.data.find(
      (b) => b.id.toLowerCase() === q || b.batch_code.toLowerCase() === q,
    );

    if (!batch) {
      throw new Error(`Batch '${batchIdOrCode}' not found for forward traceability.`);
    }

    const formula = await FormulaService.getFormulaById(batch.formula_id);
    const runsRes = await BottlingService.getBottlingRuns();
    const batchRuns = runsRes.data.filter((r) => r.batch_id === batch.id);

    const lotsRes = await BottlingService.getFinishedGoodsLots();
    const batchLots = lotsRes.data.filter((l) => l.batch_id === batch.id);

    const enrichedRuns = batchRuns.map((r) => {
      const lot = batchLots.find((l) => l.id === r.lot_id);
      return {
        ...r,
        lot,
      };
    });

    const salesRes = await SalesService.getSales();
    const completedSales = salesRes.data.filter((s) => s.status === 'completed');

    const matchedSales: ForwardTraceResult['sales'] = [];
    const lotIds = new Set(batchLots.map((l) => l.id));

    for (const sale of completedSales) {
      if (sale.items) {
        for (const item of sale.items) {
          const isDecantFromBatch = item.item_type === 'decant' && item.batch_id === batch.id;
          const isBottledFromLot = item.item_type === 'bottled' && item.lot_id && lotIds.has(item.lot_id);

          if (isDecantFromBatch || isBottledFromLot) {
            matchedSales.push({
              invoice_number: sale.invoice_number,
              sale_id: sale.id,
              sale_date: sale.created_at,
              customer_name: sale.customer_name || 'Walk-in Boutique Client',
              item_type: item.item_type,
              lot_number: (item as any).lot_number || item.lot_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              line_total: item.line_total,
            });
          }
        }
      }
    }

    return {
      query: batchIdOrCode,
      direction: 'forward',
      batch,
      formula,
      bottling_runs: enrichedRuns,
      sales: matchedSales,
    };
  }

  /**
   * Backward Traceability: Sale Invoice -> Finished Goods Lot -> Bottling Run -> Bulk Batch -> Formula BOM -> Raw Materials
   */
  static async traceBackward(saleIdOrInvoice: string): Promise<BackwardTraceResult> {
    const q = saleIdOrInvoice.trim().toLowerCase();
    const salesRes = await SalesService.getSales();
    const sale = salesRes.data.find(
      (s) => s.id.toLowerCase() === q || s.invoice_number.toLowerCase() === q,
    );

    if (!sale) {
      throw new Error(`Sale Invoice '${saleIdOrInvoice}' not found for backward traceability.`);
    }

    const lotsRes = await BottlingService.getFinishedGoodsLots();
    const runsRes = await BottlingService.getBottlingRuns();
    const batchesRes = await BatchService.getBatches();

    const traceItems: BackwardTraceItem[] = [];

    if (sale.items) {
      for (const item of sale.items) {
        let lot: FinishedGoodsLot | undefined;
        let run: BottlingRun | undefined;
        let batch: Batch | undefined;
        let formula: Formula | null = null;

        if (item.item_type === 'bottled' && item.lot_id) {
          lot = lotsRes.data.find((l) => l.id === item.lot_id);
          if (lot) {
            run = runsRes.data.find((r) => r.lot_id === lot!.id);
            batch = batchesRes.data.find((b) => b.id === lot!.batch_id);
          }
        } else if (item.item_type === 'decant' && item.batch_id) {
          batch = batchesRes.data.find((b) => b.id === item.batch_id);
        }

        if (batch) {
          formula = await FormulaService.getFormulaById(batch.formula_id);
        }

        const rawOrigins =
          batch?.usages?.map((u) => ({
            raw_material_id: u.raw_material_id,
            name: u.raw_material_name || 'Material',
            sku: u.raw_material_sku || '',
            quantity_used: u.quantity_used,
            unit: u.unit,
            unit_cost_snapshot: u.unit_cost_snapshot,
          })) || [];

        traceItems.push({
          sale_item_id: item.id,
          item_type: item.item_type,
          quantity: item.quantity,
          unit_price: item.unit_price,
          unit_cost_snapshot: item.unit_cost_snapshot,
          line_profit: item.profit,
          lot,
          bottling_run: run,
          batch,
          formula,
          raw_material_origins: rawOrigins,
        });
      }
    }

    return {
      query: saleIdOrInvoice,
      direction: 'backward',
      sale,
      trace_items: traceItems,
    };
  }

  /**
   * Universal Traceability Search
   */
  static async search(term: string): Promise<TraceSearchResult[]> {
    const q = term.trim().toLowerCase();
    const results: TraceSearchResult[] = [];

    // Search Batches
    const batches = await BatchService.getBatches();
    for (const b of batches.data) {
      if (b.batch_code.toLowerCase().includes(q) || b.perfume_name.toLowerCase().includes(q)) {
        results.push({
          entity_type: 'batch',
          id: b.id,
          code_or_number: b.batch_code,
          title: b.perfume_name,
          subtitle: `Batch Status: ${b.status.toUpperCase()} | Remaining: ${b.remaining_volume} ml`,
          date: b.production_date,
        });
      }
    }

    // Search Sales
    const sales = await SalesService.getSales();
    for (const s of sales.data) {
      if (
        s.invoice_number.toLowerCase().includes(q) ||
        (s.customer_name && s.customer_name.toLowerCase().includes(q))
      ) {
        results.push({
          entity_type: 'sale',
          id: s.id,
          code_or_number: s.invoice_number,
          title: `Invoice ${s.invoice_number}`,
          subtitle: `Customer: ${s.customer_name || 'Walk-in'} | Total: $${s.total_amount}`,
          date: s.created_at,
        });
      }
    }

    // Search Finished Goods Lots
    const lots = await BottlingService.getFinishedGoodsLots();
    for (const l of lots.data) {
      if (l.lot_number.toLowerCase().includes(q) || (l.product_name && l.product_name.toLowerCase().includes(q))) {
        results.push({
          entity_type: 'lot',
          id: l.id,
          code_or_number: l.lot_number,
          title: `${l.product_name} (${l.variant_name})`,
          subtitle: `Stock: ${l.current_quantity} units | Unit Cost: $${l.unit_cost}`,
          date: l.created_at,
        });
      }
    }

    return results.slice(0, 15);
  }
}
