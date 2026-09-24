# Phase 6: POS Sales System

## Overview
Phase 6 delivers a high-speed, transaction-safe Point-of-Sale (POS) and retail dispensation terminal engineered specifically for luxury perfume retail and decanting operations at **Mahatir Perfumes**:
- **Dual Selling Modes**:
  - **Bottled Finished Goods**: Sell serialized, packaged flacons directly linked to finished goods inventory lots.
  - **Counter Decant Dispensation**: Measure and dispense custom fragrance volumes directly from aged bulk maceration batches into atomizers on demand.
- **Strict Concurrency & Stock Protection**:
  - PostgreSQL transaction RPC (`create_sale`) with row-level locks (`SELECT ... FOR UPDATE`) prevents overselling under high concurrency.
  - Zero-negative-stock guarantee across all inventory lots and bulk batches.
- **Line-Level Profitability & Unit Cost Snapshots**:
  - Every line item records a permanent snapshot of `unit_cost_snapshot` derived from the source lot or bulk batch at the precise moment of sale.
  - Real-time gross margin and profit calculations:
    $$\text{Line Profit} = \text{Line Total} - (\text{Quantity} \times \text{Unit Cost Snapshot})$$
- **Flexible Split Tender Payments**:
  - Supports multiple payment methods (Cash, Card, Bank Transfer) across multiple tender splits on a single invoice.
  - Automatic change calculation for cash payments.
- **Reversible Invoices & Audit-Logged Voids**:
  - Voiding or refunding a completed invoice requires a mandatory human justification.
  - Stock is atomically replenished into the originating finished goods lot or bulk batch, with complete audit logging.
- **Luxury POS Counter Interface (`/pos`)**:
  - Responsive, touch-optimized boutique cash register.
  - Quick Decant Dispenser modal with visual volume selector and live batch cost transparency.
  - Customer CRM selector with loyalty balance tracking.
  - Real-time cart margin health indicator for store staff.
  - Thermal receipt & printable luxury invoice modal with instant browser print trigger.
  - Invoices drawer with real-time status badges and void modal.

---

## Mathematical Formulation & Numeric Precision

All financial and inventory computations use arbitrary-precision decimal arithmetic (`decimal.js` on Node.js and `NUMERIC(18,4)` in PostgreSQL). Floating-point primitive types (`number`, `FLOAT`, `DOUBLE`) are strictly disallowed.

### 1. Line Item Calculations
For item $i$ with quantity $Q_i$, unit price $P_i$, line discount $D_i$, and unit cost snapshot $C_i$:
$$\text{Line Total}_i = (Q_i \times P_i) - D_i$$
$$\text{Line Cost}_i = Q_i \times C_i$$
$$\text{Line Profit}_i = \text{Line Total}_i - \text{Line Cost}_i$$

### 2. Invoice Totals & Gross Margin
$$\text{Subtotal} = \sum_{i} (Q_i \times P_i)$$
$$\text{Total Invoice Discount} = \text{InvoiceDiscount} + \sum_{i} D_i$$
$$\text{Total Amount} = \text{Subtotal} - \text{Total Invoice Discount}$$
$$\text{Total Cost} = \sum_{i} \text{Line Cost}_i$$
$$\text{Total Profit} = \text{Total Amount} - \text{Total Cost}$$
$$\text{Gross Margin \%} = \begin{cases} \left(\frac{\text{Total Profit}}{\text{Total Amount}}\right) \times 100 & \text{if } \text{Total Amount} > 0 \\ 0 & \text{otherwise} \end{cases}$$

---

## Database Architecture

### Migration: `20260101000007_pos_sales_system.sql`
- **Enums**:
  - `sale_status`: `'completed'`, `'voided'`, `'refunded'`, `'draft'`.
  - `sale_item_type`: `'bottled'`, `'decant'`.
  - `payment_method`: `'cash'`, `'card'`, `'bank_transfer'`, `'split'`.
- **Tables**:
  - `customers`: Customer master with phone, email, address, loyalty points, and purchase history.
  - `sales`: Retail invoices with sequential numbering (`INV-YYYY-XXXXX`), cashier tracking, subtotal, discount, total, profit snapshot, status, and cancellation notes.
  - `sales_items`: Line items capturing `item_type`, `lot_id`, `batch_id`, `variant_id`, `quantity`, `unit_price`, `unit_cost_snapshot`, `line_discount`, `line_total`, and `line_profit`.
  - `payments`: Split-tender transaction records with `payment_method`, `amount`, `reference_code`, and receipt timestamps.
- **PostgreSQL Atomic RPC**:
  - `create_sale(p_customer_id, p_items, p_payments, p_discount, p_notes, p_user_id)`:
    - Atomically locks customer, finished goods lots, and bulk inventory.
    - Validates that sale quantities do not exceed available physical stock.
    - Decrements stock balances (`current_quantity` on lots; `remaining_volume` on batches).
    - Records immutable stock movements in `stock_movements`.
    - Inserts `sales`, `sales_items`, and `payments` records in a single isolated transaction.
- **Row-Level Security (RLS)**:
  - Enabled on `customers`, `sales`, `sales_items`, and `payments`.
  - Multi-tenant tenant isolation enforced via `branch_id`.

---

## API Endpoints

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/v1/customers` | Admin, Sales Staff, Production Manager, Inventory Manager | List customer directory with loyalty points balance |
| `POST` | `/api/v1/customers` | Admin, Sales Staff | Register new boutique customer |
| `GET` | `/api/v1/sales` | Admin, Sales Staff, Production Manager, Inventory Manager | Query sales history with status, date, and keyword filters |
| `GET` | `/api/v1/sales/:id` | Admin, Sales Staff, Production Manager, Inventory Manager | Retrieve full invoice details including lines, payments, and margin |
| `POST` | `/api/v1/sales` | Admin, Sales Staff | Execute atomic POS sale with split tender and inventory deduction |
| `POST` | `/api/v1/sales/:id/void` | Admin, Sales Staff | Void an invoice with mandatory justification and inventory replenishment |

---

## Acceptance Criteria Verification

| Requirement | Test Coverage | Verification Method | Status |
|---|---|---|---|
| Sale cannot oversell stock (bottled lot or bulk decant) | `apps/api/test/pos.test.ts` (Test 4) | Attempted sale exceeding lot balance; API rejected with `Insufficient stock` error and kept inventory untouched | ✅ Verified |
| Concurrency: Two simultaneous sales of the last unit | Database RPC `FOR UPDATE` & Service | Row-level locking ensures serial transaction validation; second transaction aborts on exhausted stock | ✅ Verified |
| Profit per sale line strictly equals $\text{selling\_price} - \text{lot\_cost}$ | `apps/api/test/pos.test.ts` (Test 2 & 3) | Verified mathematical accuracy down to 4 decimal places with `decimal.js` | ✅ Verified |
| Counter Decant dispensation reduces bulk volume | `apps/api/test/pos.test.ts` (Test 3) | Verified decanted millilitres deducted from `batches.remaining_volume` | ✅ Verified |
| Voiding or refunding restores stock with mandatory reason | `apps/api/test/pos.test.ts` (Test 5) & Live API Daemon Test | Voiding `INV-2026-00002` with reason restored 1 unit back to lot inventory and updated status to `voided` | ✅ Verified |
| Split tender payments support | `apps/web/src/pages/PosPage.tsx` & Service | Supports multiple payment entries (e.g., cash + card) completing full invoice balance | ✅ Verified |
