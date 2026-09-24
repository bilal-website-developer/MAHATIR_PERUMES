# Phase 10: Testing, Hardening & Deployment Readiness

## 1. Overview

Phase 10 is the final phase of the Mahatir Perfumes ERP + POS build. It delivers production readiness across four pillars:

1. **Automated Test Coverage** — full suite now 67 tests across 12 test files covering every subsystem
2. **Inventory Integrity Verification** — a dedicated script + API endpoint to audit stock invariants
3. **Security Hardening** — role-based permission matrix audit, immutability enforcement, and input validation
4. **End-to-End Lifecycle Test** — a single integration test that exercises the entire flow from raw material purchase through formula, batch, bottling, POS sale, and bidirectional traceability

---

## 2. Database Migration

### `20260101000011_hardening_indexes_and_integrity.sql`

**Performance Indexes:**

| Table | Index | Purpose |
|-------|-------|---------|
| `stock_movements` | `idx_stock_movements_item_composite` | Fast ledger lookups by item |
| `stock_movements` | `idx_stock_movements_reference` | Trace by reference type/id |
| `raw_materials` | `idx_raw_materials_sku_search` | Active SKU search |
| `purchase_orders` | `idx_purchase_orders_supplier_status` | PO list by supplier |
| `formulas` | `idx_formulas_perfume_status` | Formula search by name |
| `batches` | `idx_batches_code_perfume` | Batch code lookups |
| `finished_goods_variants` | `idx_finished_goods_sku` | SKU search |
| `sales` | `idx_sales_invoice_number` | Invoice lookup |
| `notifications` | `idx_notifications_recipient_unread` | Fast unread inbox query |
| `audit_log` | `idx_audit_log_table_row` | Audit history per record |

**Integrity Function: `verify_inventory_integrity(p_branch_id)`**
- SQL function (PostgreSQL SECURITY DEFINER) that runs three database-level checks:
  1. Raw material cached stock vs. stock movements ledger sum
  2. Finished goods lot cached quantity vs. lot ledger movements
  3. Batch volumetric conservation (actual = remaining + bottled + decanted + loss)

---

## 3. API Changes

### New Endpoint: `GET /api/v1/stock/integrity`

- **Auth:** Admin or Inventory Manager
- **Returns:** Full inventory integrity audit report
- **Used by:** Admin dashboard, scheduled health checks

### New Script: `src/scripts/integrity-check.ts`

CLI-executable Node.js script that runs the inventory integrity audit and exits with code 0 (all passed) or code 1 (discrepancies found). Can be run as:

```sh
npx tsx src/scripts/integrity-check.ts
```

---

## 4. Test Coverage

| Test File | Tests | What it Validates |
|-----------|-------|-------------------|
| `health.test.ts` | 3 | API health, DB health, settings |
| `auth.test.ts` | 4 | Login, JWT, roles, 403 enforcement |
| `inventory.test.ts` | 8 | Unit conversion, PO flow, stock ledger, negative stock |
| `formula.test.ts` | 10 | Validation, scaling math, locking, versioning |
| `batch.test.ts` | 5 | Draft, confirm, all-or-nothing, loss, reversal |
| `bottling.test.ts` | 5 | Packaging recipes, preview, bottling run, lot creation |
| `pos.test.ts` | 5 | Bottled sales, decant sales, void, customer loyalty |
| `dilution.test.ts` | 6 | All dilution types, concentration math, calculator API |
| `reports.test.ts` | 9 | All report types, traceability, dashboard, CSV |
| `notifications.test.ts` | 7 | Alert generation, dedup, read, production suggestions |
| `security-hardening.test.ts` | 4 | Role matrix, PO immutability, batch immutability, input validation |
| `e2e-lifecycle.test.ts` | 1 | Full lifecycle + integrity audit |
| **Total** | **67** | |

---

## 5. Security Hardening Summary

### Role Separation (Confirmed by Test)

| Resource | Admin | Production Manager | Inventory Manager | Sales Staff |
|----------|-------|--------------------|-------------------|-------------|
| Users management | ✅ | ❌ | ❌ | ❌ |
| Purchase approval | ✅ | ❌ | ❌ | ❌ |
| Formula creation | ✅ | ✅ | ❌ | ❌ |
| Batch creation | ✅ | ✅ | ❌ | ❌ |
| POS checkout | ✅ | ❌ | ❌ | ✅ |
| Audit log read | ✅ | ❌ | ❌ | ❌ |

### Immutability Enforced

- Confirmed purchase orders **cannot be re-confirmed** → throws `already been confirmed and received`
- Confirmed batches **cannot be re-confirmed** → throws `cannot be confirmed because status is 'bulk'`
- Locked formulas **cannot be edited** → throws `locked and cannot be edited`
- Stock adjustments without a **mandatory reason string** → throws `mandatory reason`

---

## 6. End-to-End Lifecycle (Test Verified)

The test in `e2e-lifecycle.test.ts` exercises the full enterprise lifecycle:

```
Purchase → Formula Lock → Batch Confirm → Loss Record
→ Bottling Run → Lot Created → POS Sale → Lot Deducted
→ Forward Trace (Batch → Bottling → Sales)
→ Backward Trace (Sale → Lot → Batch → Formula → Materials)
→ Negative Stock Guard (100 qty from 3-unit lot → rejected)
→ Integrity Audit (4 checks, all passed)
```

---

## 7. Acceptance Criteria (Verified ✅)

| Criterion | Status |
|-----------|--------|
| Full end-to-end lifecycle passes | ✅ |
| No path produces negative stock | ✅ |
| Immutability enforced for POs, batches, formulas | ✅ |
| Role permissions correctly deny cross-role access | ✅ |
| Inventory integrity audit runs and passes clean | ✅ |
| All 67 tests pass | ✅ |
| API TypeScript build: clean | ✅ |
| Web TypeScript + Vite build: clean | ✅ |

---

## 8. Deployment Guide

### Environment Variables Required

**API (`apps/api/.env`):**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://your-frontend.vercel.app
```

**Web (`apps/web/.env.local`):**
```env
VITE_API_URL=https://your-api.railway.app
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### Deployment Targets (Recommended)

| Service | Target | Notes |
|---------|--------|-------|
| Frontend | Vercel or Netlify | Auto-deploy from `apps/web/dist` |
| API | Railway or Render | `npm run start` from `apps/api` |
| Database | Supabase (Production Project) | Run all 11 migrations in order |

### Migration Order

Run migrations in numbered order against the production Supabase project:

```bash
supabase db push --project-ref <your-project-ref>
```

Or apply individually:
```
000000_initial_conventions.sql
000001_branches_and_settings.sql
000002_auth_roles_and_profiles.sql
000003_raw_materials_and_purchasing.sql
000004_formulas_and_bom.sql
000005_manufacturing_and_batches.sql
000006_packaging_bottling_finished_goods.sql
000007_pos_sales_system.sql
000008_dilution_calculator.sql
000009_costing_traceability_reports.sql
000010_alerts_and_automation.sql
000011_hardening_indexes_and_integrity.sql
```

### Opening Stock Procedure

After migrations, import opening balances via the Admin UI:
1. Navigate to **Inventory → Raw Materials** and use the "Add Raw Material" form with initial stock
2. Navigate to **Inventory → Finished Goods** and run a manual bottling run for any existing bottles
3. Verify using `GET /api/v1/stock/integrity`

### CSV Import Templates

Templates available in `docs/import-templates/`:
- `raw-materials.csv` — SKU, Name, Category, Unit, Cost, Opening Stock
- `suppliers.csv` — Name, Contact, Email, Phone, Payment Terms
- `products.csv` — Perfume Name, Code, Category, Size ML, Selling Price

---

## 9. Role User Manuals

### Admin
- Full system access
- Approve purchase orders (Inventory → Purchase Orders → Approve)
- View audit trail (Audit Log menu)
- Configure alert thresholds (Settings → Alerts)
- Run integrity check (Settings → System Integrity)

### Production Manager
- Create formulas and lock them for production
- Initiate batches and confirm production volumes
- Record batch losses with mandatory reasons
- Execute bottling runs from bulk inventory

### Inventory Manager
- Create raw material records and suppliers
- Create and submit purchase orders (Admin approves)
- Adjust stock with mandatory audit reasons
- Monitor low-stock alerts and notifications

### Sales Staff
- Use POS checkout screen (touch-optimized)
- Process bottled bottle and decant per-ml sales
- Apply loyalty points and handle partial payments
- Issue and print/email PDF invoices
