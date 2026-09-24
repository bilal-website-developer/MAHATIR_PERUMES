# Phase 5: Packaging, Bottling, Finished Goods and Variants

## Overview
Phase 5 completes the conversion of bulk aged fragrance liquid into sellable finished SKUs for **Mahatir Perfumes**:
- **Packaging Recipes & Bill of Materials (BOM)**:
  - Definable packaging recipes mapped by bottle size (e.g., 50ml luxury presentation flacon).
  - Multi-component BOM tracking glass bottles, magnetic metal caps, soft-touch velvet foil labels, and embossed rigid presentation gift boxes.
- **Master Product Catalogue & Variant SKUs**:
  - Structured perfume products linked to formulas.
  - Multi-size variant SKUs (10ml travel spray, 30ml flacon, 50ml signature flacon, 100ml grand prestige flacon).
  - Retail selling prices, minimum safety stocks, and barcode references.
- **Atomic Bottling Engine (`bottle_batch` RPC & Service)**:
  - All-or-nothing transactional safety: verifies both bulk liquid and every packaging component stock before deducting. If any component is insufficient, the run is rejected with zero side-effects.
  - Live pre-run calculation previewing required bulk millilitres, packaging stock sufficiency, and estimated unit cost.
  - Generates sequential run codes (`BTL-YYYY-XXXX`) and traceability lot numbers (`LOT-[BATCH_CODE]-[SKU]`).
  - Unit costing formula:
    $$\text{Unit Cost} = (\text{Cost per ml} \times \text{Bottle Size in ml}) + \text{Packaging Cost per Unit}$$
  - Creates traceable `finished_goods_lots` ready for retail POS sales.
  - Decrements bulk inventory and updates batch status.
  - Increments product variant `current_stock`.
- **Frontend Dashboard (`/finished-goods` & `/bottling`)**:
  - Real-time KPIs: Total Bottled Units, Finished Goods Valuation, Active Finished SKUs, Bottling Runs.
  - Four luxury tabs: *Finished Goods Lots*, *Product Variants & SKUs*, *Packaging Recipes*, and *Bottling Runs History*.
  - Interactive Bottling Run Wizard with live stock sufficiency validation, progress bars, and cost preview.
  - Finished Goods Lot Traceability modal linking every bottle back to its manufacturing batch.

---

## Mathematical Formulation & Unit Costing

### 1. Liquid and Packaging Consumption
For a bottling run producing $Q$ bottles of variant $V$ with bottle size $S_{\text{ml}}$ using packaging recipe $R$:
$$\text{Bulk Liquid Required} = Q \times S_{\text{ml}}$$

For each packaging component $i \in R$:
$$\text{Required Quantity}_i = Q \times \text{QuantityPerUnit}_i$$
$$\text{Packaging Cost}_i = \text{Required Quantity}_i \times \text{UnitCost}_i$$

$$\text{Total Packaging Cost} = \sum_{i \in R} \text{Packaging Cost}_i$$

$$\text{Packaging Cost Per Unit} = \frac{\text{Total Packaging Cost}}{Q}$$

### 2. True Manufacturing Unit Cost
$$\text{Bulk Cost Total} = \text{CostPerMl}_{\text{batch}} \times \text{Bulk Liquid Required}$$

$$\text{Unit Cost} = (\text{CostPerMl}_{\text{batch}} \times S_{\text{ml}}) + \text{Packaging Cost Per Unit}$$

---

## Database Architecture

### Migration: `20260101000006_packaging_bottling_finished_goods.sql`
- **Tables**:
  - `packaging_recipes`: `id`, `branch_id`, `name`, `size_ml`, `description`, `is_active`, timestamps.
  - `packaging_recipe_items`: `id`, `recipe_id`, `raw_material_id`, `quantity_per_unit`.
  - `products`: `id`, `branch_id`, `formula_id`, `name`, `code`, `category`, `description`, `is_active`.
  - `product_variants`: `id`, `product_id`, `packaging_recipe_id`, `sku`, `name`, `size_ml`, `selling_price`, `barcode`, `current_stock`, `min_stock_level`, `is_active`.
  - `finished_goods_lots`: `id`, `branch_id`, `variant_id`, `batch_id`, `lot_number`, `initial_quantity`, `current_quantity`, `unit_cost`, timestamps.
  - `bottling_runs`: `id`, `branch_id`, `run_code`, `batch_id`, `variant_id`, `lot_id`, `quantity_bottled`, `bulk_volume_deducted`, `packaging_cost_total`, `bulk_cost_total`, `unit_cost`, `created_by`, `created_at`.
- **PostgreSQL Database RPC**:
  - `bottle_batch(p_batch_id UUID, p_variant_id UUID, p_quantity NUMERIC, p_user_id UUID)`:
    - Atomically locks batch, variant, bulk inventory, and raw packaging materials.
    - Validates bulk liquid and packaging stock sufficiency.
    - Deducts bulk volume from `bulk_inventory` and updates `batches.remaining_volume`.
    - Deducts packaging items from `raw_materials` and records movements in `stock_movements`.
    - Computes unit cost and inserts finished goods lot and bottling run log.
    - Updates variant stock balance.
- RLS policies and audit triggers attached to all tables.

---

## API Endpoints

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/v1/packaging-recipes` | Admin, Production Manager, Inventory Manager | List packaging recipes with component BOM and total packaging cost |
| `POST` | `/api/v1/packaging-recipes` | Admin, Production Manager, Inventory Manager | Create new packaging recipe |
| `GET` | `/api/v1/products` | Admin, Production Manager, Inventory Manager, Sales Staff | Master product catalogue |
| `POST` | `/api/v1/products` | Admin, Production Manager | Create new product |
| `GET` | `/api/v1/product-variants` | Admin, Production Manager, Inventory Manager, Sales Staff | List all sellable SKU variants |
| `POST` | `/api/v1/product-variants` | Admin, Production Manager | Create new variant SKU |
| `POST` | `/api/v1/bottling/preview` | Admin, Production Manager | Live calculation preview of bulk needed, packaging BOM, and unit cost |
| `POST` | `/api/v1/bottling` | Admin, Production Manager | Execute atomic bottling run |
| `GET` | `/api/v1/bottling/runs` | Admin, Production Manager, Inventory Manager | Historical bottling runs execution log |
| `GET` | `/api/v1/finished-goods` | Admin, Production Manager, Inventory Manager, Sales Staff | List finished goods inventory lots by SKU and batch |

---

## Acceptance Criteria Verification

| Requirement | Test Coverage | Verification Method | Status |
|---|---|---|---|
| Bottling 20 x 50ml deducts 1000ml bulk liquid | `apps/api/test/bottling.test.ts` (Test 4) | Tested deduction of bulk volume matching $Q \times \text{size\_ml}$ | ✅ Verified |
| Deducts bottle, cap, label, and box per recipe | `apps/api/test/bottling.test.ts` (Test 4) | Verified each packaging raw material stock decremented by exact multiplier | ✅ Verified |
| Creates finished goods lot with correct unit cost | `apps/api/test/bottling.test.ts` (Test 4) | Verified mathematical accuracy: $(\text{Cost/ml} \times \text{Size}) + \text{PkgCost}$ | ✅ Verified |
| Insufficient bulk liquid or packaging item rejected | `apps/api/test/bottling.test.ts` (Test 5) & Live API Script | Over-volume bottling requests rejected with explicit error; stocks untouched | ✅ Verified |
| Traceability back to manufacturing batch | `apps/api/test/bottling.test.ts` (Test 4) & UI Drawer | `lot_number` links directly to `batch_code` and `variant_sku` | ✅ Verified |
