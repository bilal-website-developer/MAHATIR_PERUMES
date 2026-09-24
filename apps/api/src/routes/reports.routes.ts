import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { ReportService } from '../services/report.service.js';
import { TraceabilityService } from '../services/traceability.service.js';

export const reportsRouter = Router();

reportsRouter.use(requireAuth);

// GET /api/v1/dashboard
reportsRouter.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const role = (req as any).user?.role || 'admin';
    const metrics = await ReportService.getDashboardMetrics(role);
    return sendSuccess(res, metrics);
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

// GET /api/v1/reports/:name
reportsRouter.get(
  '/reports/:name',
  requireRole('admin', 'production_manager', 'inventory_manager', 'sales_staff'),
  async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const { format, startDate, endDate } = req.query as {
        format?: string;
        startDate?: string;
        endDate?: string;
      };

      let data: any;
      let csvRows: Record<string, any>[] = [];

      switch (name) {
        case 'inventory-valuation': {
          const report = await ReportService.getInventoryValuation();
          data = report;
          csvRows = [
            ...report.raw_materials.map((i) => ({ ...i, section: 'Raw Materials' })),
            ...report.bulk_liquids.map((i) => ({ ...i, section: 'Bulk Liquids' })),
            ...report.finished_goods.map((i) => ({ ...i, section: 'Finished Goods' })),
          ];
          break;
        }
        case 'sales-performance': {
          const report = await ReportService.getSalesPerformance({ startDate, endDate });
          data = report;
          csvRows = report.daily_breakdown.map((d) => ({
            Date: d.date,
            Invoices: d.invoice_count,
            Revenue: d.revenue,
            Profit: d.profit,
          }));
          break;
        }
        case 'product-profitability': {
          const report = await ReportService.getProductProfitability();
          data = report;
          csvRows = report.map((r) => ({
            SKU: r.sku,
            Product: r.product_name,
            Variant: r.variant_name,
            UnitsSold: r.units_sold,
            Revenue: r.gross_revenue,
            COGS: r.total_cogs,
            Profit: r.gross_profit,
            MarginPercent: `${r.margin_percent}%`,
          }));
          break;
        }
        case 'batch-cost-analysis': {
          const report = await ReportService.getBatchCostAnalysis();
          data = report;
          csvRows = report.map((b) => ({
            BatchCode: b.batch_code,
            Perfume: b.perfume_name,
            ExpectedMl: b.expected_volume_ml,
            ActualMl: b.actual_volume_ml,
            RemainingMl: b.remaining_volume_ml,
            LossMl: b.loss_volume_ml,
            LossPercent: `${b.loss_percent}%`,
            TotalCost: b.total_manufacturing_cost,
            CostPerMl: b.cost_per_ml,
            Status: b.status,
            Date: b.production_date,
          }));
          break;
        }
        case 'raw-material-consumption': {
          const report = await ReportService.getRawMaterialConsumption();
          data = report;
          csvRows = report.map((r) => ({
            Material: r.name,
            SKU: r.sku,
            Category: r.category,
            Consumed: r.total_consumed,
            Unit: r.base_unit,
            CostPerUnit: r.unit_cost,
            TotalCost: r.total_cost,
          }));
          break;
        }
        default:
          return sendError(res, `Unknown report '${name}'`, 404);
      }

      if (format === 'csv') {
        const csvContent = ReportService.formatToCsv(csvRows);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${name}-${Date.now()}.csv"`);
        return res.status(200).send(csvContent);
      }

      return sendSuccess(res, data);
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  },
);

// GET /api/v1/trace/search
reportsRouter.get('/trace/search', async (req: Request, res: Response) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    if (!q) {
      return sendSuccess(res, []);
    }
    const results = await TraceabilityService.search(q);
    return sendSuccess(res, results);
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

// GET /api/v1/trace/batch/:id
reportsRouter.get('/trace/batch/:id', async (req: Request, res: Response) => {
  try {
    const result = await TraceabilityService.traceForward(req.params.id as string);
    return sendSuccess(res, result);
  } catch (err: any) {
    return sendError(res, err.message, 404);
  }
});

// GET /api/v1/trace/sale/:id
reportsRouter.get('/trace/sale/:id', async (req: Request, res: Response) => {
  try {
    const result = await TraceabilityService.traceBackward(req.params.id as string);
    return sendSuccess(res, result);
  } catch (err: any) {
    return sendError(res, err.message, 404);
  }
});
