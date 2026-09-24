# Phase 7: Dilution Calculator and Studio Formulator

## Overview
Phase 7 delivers a scientific compounding and dilution studio engineered specifically for haute perfumery compounding at **Mahatir Perfumes**:
- **Concentration Archetypes & Preset Library**:
  - **Extrait de Parfum (30% - 40%)**: Pure luxury concentration offering dense, narcotic sillage and 24-hour skin persistence.
  - **Eau de Parfum - EDP (15% - 25%)**: The benchmark of luxury balance, optimizing radiant projection and longevity.
  - **Eau de Toilette - EDT (5% - 15%)**: Sparkling daytime compositions with luminous citrus and floral radiance.
  - **Eau de Cologne - EDC (2% - 5%)**: Invigorating splash cologne compositions with distilled water softening.
  - **Custom / Bespoke (1% - 100%)**: Free-form laboratory concentration for experimental attars and macerations.
- **Precision Carrier Auto-Balancing**:
  - The perfumer specifies the desired oil concentration ($P_{\text{oil}}$) and any optional modifiers (fixatives, enhancers, or water).
  - The carrier solvent (Perfume Grade Denatured Ethanol 96% Pure) is automatically balanced so that the total formulation sums to exactly 100%:
    $$P_{\text{ethanol}} = 100\% - P_{\text{oil}} - \sum P_{\text{additives}}$$
- **Live Inventory Cost & Shortage Telemetry**:
  - Cross-references real-time warehouse raw material inventory balances and current Weighted Average Costs (WAC).
  - Calculates true bulk cost per millilitre ($/ml) and flags ingredient shortages prior to batch creation.
- **Zero-Re-entry Dual Conversion Workflow**:
  - **Action 1: Save as Formula**: Directly transforms the calculated dilution into a formal Formula Version 1 (BOM) in the recipe registry with zero duplicate data entry.
  - **Action 2: Convert to Batch**: Instantly creates a draft production batch with the target volume, linking the formula and scaling raw material usages.
- **Luxury Studio Interface (`/dilution`)**:
  - Responsive desktop and tablet formulator.
  - Interactive slider limited to each concentration archetype plus custom numerical input.
  - Dynamic visual stacked ratio bar illustrating component volume distribution.
  - One-click modals for Formula and Batch generation.

---

## Mathematical Formulation & Costing Logic

All compounding calculations are executed using arbitrary-precision decimal arithmetic (`decimal.js` on Node.js and `NUMERIC(18,4)` in PostgreSQL).

### 1. Volume Calculation
For target batch volume $V_{\text{target}}$ in millilitres:
$$V_{\text{oil}} = V_{\text{target}} \times \left(\frac{P_{\text{oil}}}{100}\right)$$
$$V_{\text{additive}, i} = V_{\text{target}} \times \left(\frac{P_{\text{additive}, i}}{100}\right)$$
$$V_{\text{ethanol}} = V_{\text{target}} \times \left(\frac{100 - P_{\text{oil}} - \sum_i P_{\text{additive}, i}}{100}\right)$$

### 2. Valuation & Manufacturing Cost per Millilitre
For each component $k$ with required volume $V_k$ and warehouse unit cost $\text{WAC}_k$:
$$\text{Line Cost}_k = V_k \times \text{WAC}_k$$
$$\text{Total Batch Estimated Cost} = \sum_k \text{Line Cost}_k$$
$$\text{Cost per ml} = \frac{\text{Total Batch Estimated Cost}}{V_{\text{target}}}$$

### 3. Warehouse Stock Sufficiency
$$\text{Shortage}_k = \max(0, V_k - \text{CurrentStock}_k)$$
$$\text{is\_fulfillable} = \begin{cases} \text{true} & \text{if } \forall k, \text{Shortage}_k = 0 \\ \text{false} & \text{otherwise} \end{cases}$$

---

## Database Architecture

### Migration: `20260101000008_dilution_calculator.sql`
- **Tables**:
  - `dilution_presets`: Library of industry-standard studio dilution recipes (`name`, `concentration_type`, `oil_percentage`, `alcohol_percentage`, `fixative_percentage`, `water_percentage`, `description`, `is_default`).
- **PostgreSQL Database Helper Function**:
  - `calculate_dilution(p_target_volume NUMERIC, p_oil_percent NUMERIC, p_fixative_percent NUMERIC, p_water_percent NUMERIC)`:
    - Pure `IMMUTABLE` function calculating exact millilitres for oil, alcohol, fixatives, and water.
    - Validates that component percentages do not exceed 100%.
- **Row-Level Security (RLS)**:
  - Enabled on `dilution_presets`. Authenticated users can view presets; Admin and Production Manager can create or modify presets.
  - Audit triggers (`audit_trigger_func()`) attached.

---

## API Endpoints

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/v1/dilution/presets` | Admin, Production Manager, Inventory Manager, Sales Staff | Retrieve curated dilution presets (Extrait, EDP, EDT, EDC) |
| `POST` | `/api/v1/dilution/calculate` | Admin, Production Manager, Inventory Manager, Sales Staff | Compute component volumes, line costs, total cost, and warehouse shortages |
| `POST` | `/api/v1/dilution/save-formula` | Admin, Production Manager | Directly create a formal Version 1 Formula with percentage BOM |
| `POST` | `/api/v1/dilution/to-batch` | Admin, Production Manager | Directly convert dilution parameters into a draft production batch |

---

## Acceptance Criteria Verification

| Requirement | Test Coverage | Verification Method | Status |
|---|---|---|---|
| 100 ml at 20% gives 20 ml oil and 80 ml ethanol | `apps/api/test/dilution.test.ts` (Test 2) & Live API Daemon Test | Validated exact output: `Oil: 20.0000 ml`, `Ethanol: 80.0000 ml`, total 100 ml | ✅ Verified |
| Correct amounts when additives are set (e.g. 30% oil + 5% fixative) | `apps/api/test/dilution.test.ts` (Test 3) | 500 ml gives 150 ml oil, 25 ml fixative, and 325 ml ethanol (65%) | ✅ Verified |
| Saving as a formula works without re-entering data | `apps/api/test/dilution.test.ts` (Test 5) & Live API Daemon Test | Created `Imperial Santal EDP Studio Edition` (V1) with percentage ingredients summing to 100% | ✅ Verified |
| Converting to a batch works without re-entering data | `apps/api/test/dilution.test.ts` (Test 6) & Live API Daemon Test | Created `BAT-2026-0002` with 500 ml expected volume and estimated cost per ml | ✅ Verified |
| Rejection of invalid concentrations | `apps/api/test/dilution.test.ts` (Test 4) | Rejected configurations where oil + additives exceed 100% | ✅ Verified |
