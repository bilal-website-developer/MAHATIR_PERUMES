# Phase 8: Costing, Traceability and Reports

## 1. Overview
Phase 8 delivers business intelligence, valuation, analytical reporting, and bidirectional provenance traceability across the entire fragrance manufacturing and retail lifecycle:
`Raw Materials -> Batches -> Bulk Liquid -> Bottling Runs -> Finished Goods Lots -> Sales / Invoices`.

## 2. Key Architecture & Features

### 2.1 Database & Analytics Views
- **Migration**: `supabase/migrations/20260101000009_costing_traceability_reports.sql`
- **Views**:
  - `view_inventory_valuation`: Unified valuation across raw materials, packaging, bulk liquid lots, and finished goods lots with total quantities and calculated valuation based on Weighted Average Cost and batch compounding costs.
  - `view_sku_profitability`: Product-level sales volume, gross revenue, aggregated COGS, total gross profit, and margin percentages.
  - `view_batch_cost_analysis`: Batch-level actual produced volume, planned volume, loss volume, loss percentage, total batch compounding cost, and realized cost per millilitre.
- **Stored Procedures**:
  - `trace_backward_from_sale(p_sale_id UUID)`: Resolves lot, bottling run, bulk batch, formula version, and ingredient raw materials with purchase order and supplier provenance.
  - `trace_forward_from_batch(p_batch_id UUID)`: Resolves bulk batch into downstream bottling runs, finished goods variants/lots, and customer sales invoices.

### 2.2 Backend Services & API Routes
- **`ReportService` (`apps/api/src/services/report.service.ts`)**:
  - `getInventoryValuation()`: Returns categorized breakdown and portfolio total.
  - `getSalesPerformance(timeframe)`: Revenue, units sold, order count, average order value, and profit telemetry.
  - `getProductProfitability()`: Margin % and unit economics per SKU.
  - `getBatchCostAnalysis()`: Yield rates, loss reasons, and compounding unit cost.
  - `getRawMaterialConsumption()`: Volume consumed across manufacturing and decants.
  - `getRoleDashboard(role)`: Tailored metrics for Admin, Production Manager, and Sales Staff.
- **`TraceabilityService` (`apps/api/src/services/traceability.service.ts`)**:
  - Backward trace: Full lineage from Invoice/Sale back to raw material suppliers.
  - Forward trace: Full blast radius from Batch or Lot to all customer sales.
  - Quick Search: Multi-entity search across batches, SKUs, and invoices.
- **Endpoints**: Mounted under `/api/v1/reports/*` and `/api/v1/trace/*`.

### 2.3 Frontend Application
- **Reports Dashboard (`apps/web/src/pages/ReportsPage.tsx` at `/reports`)**:
  - Tabbed analytics: Valuation, Sales Performance, Product Margin, Batch Compounding & Loss, Material Consumption.
  - CSV export for all reporting grids.
  - Key financial telemetry cards with luxury dark gold aesthetic.
- **Traceability Explorer (`apps/web/src/pages/TraceabilityPage.tsx` at `/traceability`)**:
  - Bidirectional search bar with instant entity suggestions.
  - Visual interactive lineage timeline showing ingredients, formula version, compounding batch, bottling run, lot, and customer invoices.
- **Role-Tailored Dashboard (`apps/web/src/pages/DashboardPage.tsx` at `/dashboard`)**:
  - Dynamic KPI cards adapting to user role (Admin, Production Manager, Sales Staff).

## 3. Verification & Acceptance Criteria
- Vitest suite `apps/api/test/reports.test.ts` (9 tests) validates:
  1. Inventory valuation reconciles across all 4 inventory classes.
  2. Sales performance metrics calculate revenue, COGS, and profit accurately.
  3. Product profitability calculates profit margin % using `decimal.js`.
  4. Batch cost analysis tracks planned vs actual volume and loss %.
  5. Raw material consumption reports usage accurately.
  6. Backward traceability traces sale back to raw materials and suppliers.
  7. Forward traceability traces batch forward to finished goods lots and sales.
  8. Trace search endpoint resolves batches and invoices.
  9. Role-based dashboard returns role-specific KPI sets.
