# Phase 2: Raw Materials, Units, Suppliers, and Purchasing

## Overview
Phase 2 implements the master inventory foundation for **Mahatir Perfumes**:
- Accurate raw material inventory tracking with strictly enforced base units (`ml`, `g`, `pcs`).
- Automatic secondary bulk unit conversion (e.g., Litres to Millilitres, Kilograms to Grams) with numeric precision via `decimal.js` and PostgreSQL `NUMERIC(18,4)`.
- Global supplier directory with contact details and credit terms.
- Multi-tier Purchase Order workflow: Draft creation -> Submission -> Admin Approval/Rejection -> Atomic Receiving.
- Append-only stock movements ledger (`stock_movements`) ensuring no direct mutation of stock levels.
- Weighted Average Cost (WAC) recalculation upon every purchase confirmation.
- Negative stock prevention check constraints and RPC validation with exact contextual feedback.

---

## Database Objects

### 1. Tables & Enums
- **`raw_material_category` enum**: `'oil'`, `'alcohol'`, `'fixative'`, `'packaging'`.
- **`po_status` enum**: `'draft'`, `'pending_approval'`, `'approved'`, `'rejected'`, `'received'`, `'cancelled'`.
- **`stock_movement_type` enum**: `'purchase_receive'`, `'stock_adjustment'`, `'batch_consumption'`, `'bottling_consumption'`, `'sale'`, `'return'`, `'transfer'`.
- **`units` & `unit_conversions`**: Standardized units with base unit declarations (`ml`, `g`, `pcs`) and conversion multipliers.
- **`raw_materials`**:
  - `id`, `branch_id`, `name`, `sku` (unique per branch), `category`, `base_unit`, `secondary_unit`, `conversion_rate`, `cost_per_unit` (WAC), `min_stock_level`, `current_stock` (`CHECK (current_stock >= 0)`), `is_active`, `deleted_at`.
- **`suppliers`**:
  - `id`, `branch_id`, `name`, `contact_person`, `email`, `phone`, `address`, `payment_terms`, `is_active`.
- **`purchase_orders` & `purchase_order_items`**:
  - Multi-line purchase orders storing both raw inputs (e.g., 5 Litres @ $18/L) and converted quantities/costs (5000 ml @ $0.0180/ml).
- **`stock_movements` (The Ledger)**:
  - Append-only journal: `item_type`, `item_id`, `quantity` (+/-), `unit`, `unit_cost`, `total_cost`, `reference_type`, `reference_id`, `reason`, `user_id`, `created_at`.

### 2. PostgreSQL RPC Functions
- **`confirm_purchase(p_po_id UUID, p_user_id UUID)`**:
  - Locks purchase order and raw material records `FOR UPDATE`.
  - Enforces idempotency (rejects with error if already in `received` status).
  - Recalculates Weighted Average Cost:
    $$\text{New WAC} = \frac{(\text{Current Stock} \times \text{Current WAC}) + (\text{Incoming Converted Qty} \times \text{Incoming Converted Cost})}{\text{Current Stock} + \text{Incoming Converted Qty}}$$
  - Appends movement to `stock_movements` ledger.
  - Updates `raw_materials.current_stock` and sets PO status to `received`.
- **`adjust_stock(p_raw_material_id UUID, p_delta NUMERIC, p_reason TEXT, p_user_id UUID, p_branch_id UUID)`**:
  - Enforces mandatory audit reason.
  - Validates `current_stock + delta >= 0` with human-readable error if balance would fall below zero.
  - Records movement and atomically updates balance.

---

## API Endpoints

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/v1/raw-materials` | Admin, Inv Manager, Prod Manager | List materials with category, search & low stock filters |
| `POST` | `/api/v1/raw-materials` | Admin, Inv Manager | Register a new raw material with unit conversion rates |
| `GET` | `/api/v1/raw-materials/:id` | Admin, Inv Manager, Prod Manager | Fetch single material |
| `PATCH` | `/api/v1/raw-materials/:id` | Admin, Inv Manager | Update master data |
| `DELETE` | `/api/v1/raw-materials/:id` | Admin, Inv Manager | Soft-delete material |
| `GET` | `/api/v1/raw-materials/:id/ledger` | Admin, Inv Manager, Prod Manager | Query append-only stock movements for this item |
| `GET` | `/api/v1/suppliers` | Admin, Inv Manager | Search and list suppliers |
| `POST` | `/api/v1/suppliers` | Admin, Inv Manager | Create supplier |
| `PATCH` | `/api/v1/suppliers/:id` | Admin, Inv Manager | Update supplier |
| `GET` | `/api/v1/purchase-orders` | Admin, Inv Manager | List purchase orders with status filter |
| `POST` | `/api/v1/purchase-orders` | Admin, Inv Manager | Create draft PO with line items |
| `POST` | `/api/v1/purchase-orders/:id/submit` | Admin, Inv Manager | Transition Draft -> Pending Approval |
| `POST` | `/api/v1/purchase-orders/:id/approve` | Admin ONLY | Approve PO for receiving |
| `POST` | `/api/v1/purchase-orders/:id/reject` | Admin ONLY | Reject PO with mandatory reason |
| `POST` | `/api/v1/purchase-orders/:id/confirm` | Admin, Inv Manager | Atomically receive PO items into stock |
| `POST` | `/api/v1/stock/adjust` | Admin, Inv Manager | Manual stock adjustment with reason |
| `GET` | `/api/v1/stock/ledger` | Admin, Inv Manager, Prod Manager | Complete audit ledger |

---

## Frontend Screens

1. **Raw Materials Catalog (`/raw-materials`)**:
   - Live KPI cards: Total Inventory Valuation, Registered Materials, Low Stock Alerts Count, and Active Conversion Engine.
   - Filter pills (All, Essential Oils, Alcohol, Fixatives, Packaging) and search.
   - Low-stock badge indicator and one-click low-stock filter.
   - **Adjust Stock Modal**: Choose surplus (+) or loss (-), specify quantity in base unit, enforce mandatory reason.
   - **Stock Movements Ledger Modal**: Immutable transaction history showing timestamps, quantities, costs, and audit reasons.
   - **Add Material Modal**: Setup base and secondary units with custom conversion multipliers.

2. **Suppliers Directory (`/suppliers`)**:
   - Card grid displaying global distillers and suppliers with contact info and payment terms.
   - Add Supplier modal.

3. **Purchase Orders (`/purchase-orders`)**:
   - Status tabs (All, Draft, Pending Approval, Approved, Received, Rejected).
   - **Interactive PO Builder**: Dynamic line item creator with live base-unit conversion preview and running total.
   - Workflow actions: Submit for Approval, Admin Approve/Reject, and Receive & Add Stock.

---

## Acceptance Criteria Verification
- **Scenario:** Buying 5 L of Ethanol increases stock by 5000 ml:
  - Base unit `ml`, secondary unit `l`, conversion rate `1000.0000`.
  - 5 L @ $20.00/L converts to 5000 ml @ $0.0200/ml.
  - Automatically updates Weighted Average Cost using `Decimal.js`.
  - Cannot be confirmed twice (idempotency verified by test suite).
  - Appears in `stock_movements` ledger and audit log.
- **Test Suite Results:**
  - 18 Vitest tests passing across backend and frontend workspaces.
  - Zero TypeScript compile errors.
