# Phase 4: Manufacturing (Batches) and Bulk Inventory

## Overview
Phase 4 implements the complete manufacturing lifecycle for **Mahatir Perfumes**:
- Creation of production batches from approved, active formula BOMs with auto-incrementing sequential codes (`BAT-YYYY-XXXX`).
- Atomic **Confirm Batch** transaction:
  - Deducts required raw materials from warehouse stock via append-only movements.
  - Rejects the transaction with zero side-effects if any ingredient stock is insufficient (all-or-nothing guarantee).
  - Captures actual produced liquid volume and categorised loss (evaporation, residue, spillage).
  - Calculates true cost per ml: $\text{Cost per ml} = \frac{\text{Total Raw Material Cost}}{\text{Actual Produced Volume}}$ (losses raise the cost per ml).
  - Automatically locks the formula at the database level to ensure historical repeatability.
  - Creates a tracked lot in **Bulk Inventory** in ml ready for bottling or sales.
- **Batch Reversal** RPC:
  - Validates that bulk liquid has not yet been bottled or sold.
  - Restores all deducted raw materials to stock with compensating movements.
  - Requires a mandatory audit reason.
  - Marks the batch status as `reversed` and zeros the bulk inventory lot.
- Full UI dashboard for batch tracking, status indicators, material usage breakdown, atomic confirmation modal, and bulk liquid inventory view.

---

## Mathematical Costing & Yield Model

### 1. Scaling and Raw Material Consumption
For a batch with formula $F$ and expected volume $V_{\text{expected}}$:
Each raw material $i$ is scaled according to its hybrid BOM definition (fixed ml or percentage balance):
$$Q_i = \text{ScaledQuantity}(F_i, V_{\text{expected}})$$

$$\text{Line Cost}_i = Q_i \times \text{WAC}_i$$

$$\text{Total Batch Cost} = \sum_{i} \text{Line Cost}_i$$

### 2. Yield & Evaporation Loss Accounting
During the maceration and blending process, physical losses occur:
$$\text{Loss Volume} = V_{\text{expected}} - V_{\text{actual}}$$

$$\text{Loss Percentage} = \left( \frac{\text{Loss Volume}}{V_{\text{expected}}} \right) \times 100$$

### 3. True Cost Per Millilitre
Because losses reduce the usable sellable liquid without reducing the raw material expense, the cost per ml increases:
$$\text{Cost per ml} = \frac{\text{Total Batch Cost}}{V_{\text{actual}}}$$

---

## Database Architecture

### Migration: `20260101000005_manufacturing_and_batches.sql`

- **Enums**:
  - `batch_status`: `'draft'`, `'bulk'`, `'bottled'`, `'reversed'`.
  - `loss_reason_type`: `'evaporation'`, `'spillage'`, `'filter_loss'`, `'quality_reject'`, `'other'`.

- **Tables**:
  - **`batches`**:
    - `id`, `branch_id`, `batch_code`, `formula_id`, `formula_version`, `perfume_name`
    - `expected_volume`, `actual_volume`, `remaining_volume` (`NUMERIC(18,4)`)
    - `total_cost`, `cost_per_ml` (`NUMERIC(18,4)`)
    - `loss_percent`, `loss_volume` (`NUMERIC(18,4)`)
    - `status`, `notes`, `created_by`, `production_date`, timestamps
  - **`batch_usage`**:
    - `id`, `batch_id`, `raw_material_id`, `quantity_used`, `unit`, `unit_cost_snapshot`, `line_cost`
  - **`batch_losses`**:
    - `id`, `batch_id`, `reason_type`, `volume_ml`, `notes`, `created_at`
  - **`bulk_inventory`**:
    - `id`, `branch_id`, `batch_id`, `batch_code`, `perfume_name`
    - `initial_volume`, `current_volume`, `cost_per_ml` (`NUMERIC(18,4)`)
    - `status` (`'available'`, `'consumed'`, `'reversed'`)

- **PostgreSQL Database RPCs**:
  - `confirm_batch(p_batch_id UUID, p_actual_volume NUMERIC, p_loss_reason TEXT, p_user_id UUID)`:
    - Atomically validates stock availability, deducts raw materials via stock movements, computes costing and losses, updates batch status to `'bulk'`, creates bulk inventory record, and locks the formula.
  - `reverse_batch(p_batch_id UUID, p_reason TEXT, p_user_id UUID)`:
    - Verifies bulk inventory has not been consumed, creates compensating stock movements restoring materials, zeros bulk volume, and marks batch `'reversed'`.

---

## API Endpoints

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/v1/batches` | Admin, Production Manager, Inventory Manager | List batches with status filter and search |
| `GET` | `/api/v1/batches/:id` | Admin, Production Manager, Inventory Manager | Get batch details with usages and losses |
| `POST` | `/api/v1/batches` | Admin, Production Manager | Create a draft production batch |
| `POST` | `/api/v1/batches/:id/confirm` | Admin, Production Manager | Atomically confirm batch, deduct stock, create bulk |
| `POST` | `/api/v1/batches/:id/reverse` | Admin, Production Manager | Atomically reverse batch and restore materials |
| `GET` | `/api/v1/batches/bulk-inventory` | Admin, Production Manager, Inventory, Sales | List available bulk liquid lots |

---

## Acceptance Criteria Verification

| Requirement | Test Coverage | Verification Method | Status |
|---|---|---|---|
| Insufficient material rejects batch without deducting | `apps/api/test/batch.test.ts` (Test 3) | Attempted confirmation with insufficient stock throws error; stock levels remain unchanged | ✅ Verified |
| Cost per ml = Total Cost / Actual Volume | `apps/api/test/batch.test.ts` (Test 2) | Exact math check: 500ml batch, 480ml actual, 20ml loss, verified cost per ml increases accurately | ✅ Verified |
| Remaining volume is always correct | `apps/api/test/batch.test.ts` (Test 2, 4) | Verified remaining volume equals actual produced volume upon confirmation | ✅ Verified |
| Confirmed batch creates tracked bulk liquid in ml | `apps/api/test/batch.test.ts` (Test 2) | Query `bulk_inventory` verified entry with matching batch code, volume, and cost per ml | ✅ Verified |
| Confirmed batch auto-locks formula | `apps/api/test/batch.test.ts` (Test 2) | Formula verified `is_locked: true` after batch confirmation | ✅ Verified |
| Reversal restores raw materials with mandatory reason | `apps/api/test/batch.test.ts` (Test 4, 5) | Empty reason rejected; valid reason restores warehouse stock and zeros bulk inventory | ✅ Verified |
