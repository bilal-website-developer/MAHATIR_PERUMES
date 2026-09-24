# Phase 3: Formula / BOM Engine

## Overview
Phase 3 implements the proprietary recipe and Bill of Materials (BOM) engine for **Mahatir Perfumes**:
- Versioned recipes (`V1`, `V2`...) with unique active version enforcement per perfume.
- Hybrid blending support: seamless combination of fixed volume ingredients (`fixed_ml`) and percentage balance ingredients (`percent`) with strict 100% volume validation.
- Real-time batch auto-scaling (`scale_formula`) calculating exact required quantities, inventory stock availability, shortage warnings, and batch costing.
- Auto-locking and immutability: once a recipe is locked or used in a commercial batch, database triggers and API rules reject edits, ensuring strict formulation repeatability.
- Version cloning workflow (`V+1`): one-click creation of next generation recipes while archiving legacy versions.

---

## Mathematical Formulation & Scaling Model

### 1. Hybrid Blend Logic
Let $V_{\text{target}}$ be the target batch production volume in millilitres (e.g., $500$ ml or $10,000$ ml).
1. Sum of all fixed ingredients:
   $$V_{\text{fixed}} = \sum_{i \in \text{Fixed}} \text{value}_i$$
   Constraint: $V_{\text{fixed}} \le V_{\text{target}}$ (Target volume cannot be less than fixed base components).
2. Remaining liquid volume:
   $$V_{\text{remaining}} = V_{\text{target}} - V_{\text{fixed}}$$
3. Percentage Ingredients Constraint:
   $$\sum_{j \in \text{Percent}} \text{value}_j = 100.00\%$$
4. Ingredient Scaled Quantities:
   - For fixed ingredient $i$:
     $$Q_i = \text{value}_i \quad (\text{in base unit } \text{ml})$$
   - For percentage ingredient $j$:
     $$Q_j = V_{\text{remaining}} \times \frac{\text{value}_j}{100} \quad (\text{in base unit } \text{ml or g})$$

### 2. Stock Availability & Shortage Detection
For each ingredient $k$:
$$\text{Shortage}_k = \max(0, Q_k - \text{WarehouseStock}_k)$$
$$\text{Batch Fulfillable} = \begin{cases} \text{true} & \text{if } \forall k, \text{Shortage}_k = 0 \\ \text{false} & \text{otherwise} \end{cases}$$

### 3. Batch Cost Calculation
$$\text{Batch Cost} = \sum_k (Q_k \times \text{WAC}_k)$$
$$\text{Cost Per ml} = \frac{\text{Batch Cost}}{V_{\text{target}}}$$

---

## Database Architecture

### Migration: `20260101000004_formulas_and_bom.sql`
- **`formulas` Table**:
  - `id`, `branch_id`, `perfume_name`, `code`, `version`, `version_label`, `status` (`active`/`archived`/`draft`), `is_locked`, `locked_reason`, `locked_at`, `target_concentration`, `notes`.
  - **Unique Partial Index**: `UNIQUE (branch_id, lower(trim(perfume_name))) WHERE status = 'active' AND deleted_at IS NULL`.
- **`formula_ingredients` Table**:
  - `id`, `formula_id`, `raw_material_id`, `quantity_type` (`percent` / `fixed_ml`), `value` (NUMERIC 18,4), `position`.
- **Database Triggers**:
  - `trg_check_formula_lock`: blocks any updates to formula metadata or ingredients if `is_locked = true`.
  - `audit_trigger_func()`: full audit trail logging for formulas and ingredients.
- **Database Function**:
  - `scale_formula(p_formula_id UUID, p_total_ml NUMERIC)`: atomic RPC computing scaled BOM and inventory availability.

---

## API Endpoints

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/v1/formulas` | Admin, Prod Manager, Inv Manager | List formulas with search and status filters |
| `GET` | `/api/v1/formulas/:id` | Admin, Prod Manager, Inv Manager | Get formula with ingredients breakdown |
| `POST` | `/api/v1/formulas` | Admin, Prod Manager | Create formula (enforces 100% percentage check) |
| `PATCH` | `/api/v1/formulas/:id` | Admin, Prod Manager | Update formula (strictly blocked if locked) |
| `POST` | `/api/v1/formulas/:id/scale` | Admin, Prod Manager, Inv Manager | Scale recipe to any target batch volume |
| `POST` | `/api/v1/formulas/:id/version` | Admin, Prod Manager | Clone recipe to V+1 and archive previous version |
| `POST` | `/api/v1/formulas/:id/lock` | Admin, Prod Manager | Lock formula against future edits |
| `POST` | `/api/v1/formulas/:id/archive` | Admin, Prod Manager | Archive formula |

---

## Frontend Screens

### Fragrance Formulation Lab (`/formulas`)
1. **Recipe Catalog Grid**:
   - Displays perfume name, version badge (`V1`, `V2`...), concentration, and lock state (`Locked` / `Draft`).
   - Summary of formula ingredients with quantity types.
2. **Formula Builder Modal**:
   - Perfume name, formula code, and target concentration.
   - Interactive ingredient rows with `Percentage %` vs `Fixed ml` selector.
   - **Live 100% Validation Progress Bar**: calculates fixed volume and verifies percentage items total exactly 100%. Disables saving until valid.
3. **Batch BOM Scaling Calculator Modal**:
   - Quick batch size presets (`100 ml`, `250 ml`, `500 ml`, `1 L`, `5 L`, `10 L`) or custom input.
   - Live breakdown of required quantity in base units.
   - Live warehouse stock lookup with red shortage alert badges if inventory is insufficient.
   - Batch cost estimate and cost per ml.
4. **V+1 Version Cloning & Locking**:
   - One-click clone creates next sequential version and archives current version.
   - Permanent lock modal with audit reason prompt.

---

## Acceptance Criteria Verification
- **Scenario:** A formula with 20 ml fixed floral base + 80% alcohol + 20% water/fixative:
  - **Scaled to 500 ml:**
    - Fixed base = 20 ml
    - Remaining volume = 480 ml
    - Alcohol (80%) = 384 ml
    - Fixative (20%) = 96 ml
    - Total = $20 + 384 + 96 = 500$ ml. ✅
  - **Scaled to 10,000 ml:**
    - Fixed base = 20 ml
    - Remaining volume = 9,980 ml
    - Alcohol (80%) = 7,984 ml
    - Fixative (20%) = 1,996 ml
    - Total = $20 + 7,984 + 1,996 = 10,000$ ml. ✅
  - **Flags missing stock:** Correctly flags warehouse shortage and sets `is_fulfillable = false` when required quantity exceeds inventory. ✅
  - **Auto-lock / Immutability:** Locked formulas reject edits with clear error. ✅
- **Monorepo Test Suite:**
  - 28 Vitest tests passing across `apps/api` and `apps/web`.
  - Zero TypeScript compile errors.
