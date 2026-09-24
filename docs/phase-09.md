# Phase 9: Alerts and Smart Automation

## 1. Overview
Phase 9 delivers proactive operational intelligence for the Mahatir Perfumes ERP. It replaces reactive stock management with threshold-driven automatic alerts, a real-time in-app notification center, sales velocity-powered smart production replenishment suggestions, and a comprehensive atomic negative-stock integrity guard review covering every stock table in the system.

## 2. Key Architecture & Features

### 2.1 Database Migration
**File:** `supabase/migrations/20260101000010_alerts_and_automation.sql`

- **Enums:** `alert_severity` (`info`, `warning`, `critical`), `alert_type` (`low_raw_material`, `low_finished_goods`, `production_needed`, `negative_stock_attempt`, `system`), `notification_status` (`unread`, `read`, `archived`).
- **Tables:**
  - `notifications`: Stores deduped in-app alerts with entity linkback (`entity_type`, `entity_id`), JSONB data payload, read state, and audit triggers.
  - `alert_configurations`: Per-branch settings for email alert enable/disable, SMTP recipients, minimum stock threshold days, and daily cron toggle.
- **PostgreSQL Functions (SECURITY DEFINER):**
  - `generate_system_alerts(p_branch_id)`: Scans `raw_materials` and `product_variants` against `min_stock_level`, inserts deduplicated `critical` or `warning` notifications (24h dedup window).
  - `check_stock_integrity()`: Scans all 4 stock tables (`raw_materials`, `batches`, `finished_goods_lots`, `product_variants`) for any negative stock and returns a structured JSON violations report.
  - `mark_notification_read(p_notification_id, p_user_id)`: Atomic single-read update.
  - `mark_all_notifications_read(p_user_id, p_branch_id)`: Batch atomic read sweep.
- **Indexes:** Optimized read path on `(branch_id, is_read, created_at DESC)`, `(type, severity)`, and `(entity_type, entity_id)`.

### 2.2 Backend Services

#### `NotificationService` (`apps/api/src/services/notification.service.ts`)
- `getNotifications(filter)`: Retrieve all notifications with optional filters (`is_read`, `severity`, `type`), returns list with `unread_count` in meta.
- `getUnreadCount()`: Lightweight single-value read for TopBar badge.
- `markAsRead(id, userId)`: Marks a single notification read, logs actor.
- `markAllAsRead(userId)`: Atomic sweep marks all unread notifications as read.
- `triggerAlertScan()`: Compares all active raw materials and product variants against their `min_stock_level` thresholds, creates missing unread alerts, returns scan telemetry.
- `checkStockIntegrity()`: Verifies zero-negative-stock guarantee across all 4 stock tables — fulfills Master Plan Section 4, Rule 4 compliance.
- `dispatchEmailAlert(_notification)`: Pluggable email dispatch — Resend API when `RESEND_API_KEY` is configured, dev logger fallback otherwise.

#### `SuggestionService` (`apps/api/src/services/suggestion.service.ts`)
- `getProductionSuggestions(targetRunwayDays)`: For every active product variant:
  - Calculates **30d, 60d, 90d sales velocity** from completed sale items.
  - Computes **weighted daily velocity**: `V = 0.60 × V_30d + 0.25 × V_60d + 0.15 × V_90d`.
  - Determines **Days of Inventory Remaining** (`stock ÷ daily_velocity`).
  - Assigns **urgency** (`critical` ≤7 days, `high` ≤14 days, `medium` ≤runway, `healthy`).
  - Calculates **suggested compounding batch volume** (with 5% bottling buffer).
  - Runs Formula BOM `scaleFormula()` to verify **raw material sufficiency** per ingredient.
  - Returns `shortages[]`, `all_ingredients[]`, `estimated_production_cost`, and `create_batch_payload` for one-click batch creation.
- Results sorted by urgency (critical → high → medium → healthy), then days remaining ascending.

### 2.3 API Endpoints
Mounted at `/api/v1/notifications/*` and `/api/v1/suggestions/*` and `/api/v1/system/*`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/notifications` | List all notifications with filters |
| `GET` | `/api/v1/notifications/unread-count` | Real-time unread badge count |
| `POST` | `/api/v1/notifications/:id/read` | Mark single notification read |
| `POST` | `/api/v1/notifications/read-all` | Mark all notifications read |
| `POST` | `/api/v1/notifications/scan` | Manually trigger threshold inventory scan |
| `GET` | `/api/v1/system/integrity-check` | Negative-stock guard review across all tables |
| `GET` | `/api/v1/suggestions/production` | Smart production replenishment suggestions |

### 2.4 Frontend Components

#### `NotificationCenter` (`apps/web/src/components/layout/NotificationCenter.tsx`)
- **Mounted in `TopBar.tsx`** replacing the static bell icon.
- Live unread count badge with `animate-pulse` for critical alerts.
- Popover dropdown with filter pills (All / Unread / Critical), severity icons, time stamps, individual mark-read and mark-all-read actions.
- 30-second background refetch interval.
- Quick-access footer shortcuts: **Smart Production** → `/suggestions`, **Manage Alerts** → `/alerts`.
- Manual scan trigger via `RefreshCw` icon button.

#### `AlertsPage` (`apps/web/src/pages/AlertsPage.tsx` at `/alerts`)
- 4-card telemetry header: Active Alerts count, Critical Shortages, Material/Variant alarm counts, Ledger Integrity status.
- Full tabbed filter bar: All / Unread / Critical / Raw Materials / Finished Goods with counts.
- Searchable alert list with SKU, stock values, and threshold display.
- Inline action buttons: **Create PO** (raw material alerts) → `/purchase-orders`, **Suggest Batch** (finished goods alerts) → `/suggestions`.
- **Stock Integrity Guard Modal**: Full audit report of the negative-stock constraint check with pass/fail status and violation detail table.

#### `ProductionSuggestionsPage` (`apps/web/src/pages/ProductionSuggestionsPage.tsx` at `/suggestions`)
- **Target Runway Selector**: 15d / 30d / 45d / 60d buttons with live recalculation.
- 4-card telemetry: Critical replenishment count, target runway, materials readiness, suggested compounding volume (ml).
- Expandable suggestion rows per SKU showing:
  - Sales velocity telemetry (30d/60d/90d units, weighted daily run-rate).
  - Days of stock remaining with color-coded urgency indicator.
  - Suggested batch size (units + ml) and estimated compounding cost.
  - BOM sufficiency badge (100% Materials Ready / N Shortage(s)).
  - Expandable BOM ingredient table with required vs available vs shortage per raw material, with inline **Order PO** shortcut for shortages.
- **"Create Batch" button**: Pre-fills the Batch Production wizard via `sessionStorage` and navigates to `/batches?wizard=open`.

## 3. Verification & Acceptance Criteria

### Tests (`apps/api/test/notifications.test.ts`) — 7 tests passing
1. **AC1 — Threshold Trigger**: Alerts trigger at defined `min_stock_level` thresholds for raw materials and finished goods.
2. **AC2 — Notification Lifecycle**: Single and batch mark-as-read works; unread count reaches 0 after mark-all.
3. **AC3 — Negative-Stock Guard**: `checkStockIntegrity()` confirms 0 violations across all 4 stock tables — no path bypasses the guard.
4. **AC4 — Velocity Calculation**: `getProductionSuggestions(30)` returns valid 30d/60d/90d velocity, days remaining, and urgency for all variants.
5. **AC5 — BOM Sufficiency**: Formula BOM is resolved and ingredient sufficiency checked for each suggestion.
6. **AC6 — Dynamic Suggestions**: Suggestions change when seeded sales data changes — velocity increases after an injected sale.
7. **AC7 — API Endpoints**: All 5 API endpoints return 200 with correct structure via HTTP fetch.

### Full Monorepo Test Results
- **Test Files:** 10 passed (10)
- **Tests:** 62 passed (62)
- **API TypeScript build:** ✅ Zero errors
- **Web TypeScript + Vite build:** ✅ Zero errors (1680 modules)

## 4. Assumptions
- Email alerts use a dev fallback logger unless `RESEND_API_KEY` is provided in `apps/api/.env`. The service is fully pluggable.
- The `pg_cron` extension required for automated daily PostgreSQL sweeps is seeded in the migration but activating it requires a live Supabase project with `pg_cron` enabled. The Node.js service-layer `triggerAlertScan()` replicates this logic fully for the dev environment.
- Suggestion daily velocity baseline for items with no historical sales is set to `0.05 units/day` (conservative, to avoid zero-division and show real urgency once sales begin).
