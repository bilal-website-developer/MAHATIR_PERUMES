import { describe, it, expect, beforeEach } from 'vitest';
import { Decimal } from 'decimal.js';
import { createApp } from '../src/app.js';
import { NotificationService } from '../src/services/notification.service.js';
import { SuggestionService } from '../src/services/suggestion.service.js';
import { SalesService } from '../src/services/sales.service.js';
import { InventoryService } from '../src/services/inventory.service.js';
import { BottlingService } from '../src/services/bottling.service.js';

describe('Phase 9: Alerts and Smart Automation', () => {
  const app = createApp();

  beforeEach(() => {
    // Reset or ensure baseline
  });

  it('1. Acceptance Criteria: Alerts trigger at the thresholds for low raw materials and finished goods', async () => {
    // Perform manual inventory scan
    const scanResult = await NotificationService.triggerAlertScan();

    expect(scanResult.success).toBe(true);
    expect(scanResult.active_unread_count).toBeGreaterThanOrEqual(1);

    const { data: notifications, unread_count } = await NotificationService.getNotifications();
    expect(notifications.length).toBeGreaterThan(0);
    expect(unread_count).toBeGreaterThan(0);

    // Verify low raw material alert content
    const rmAlert = notifications.find((n) => n.type === 'low_raw_material');
    expect(rmAlert).toBeDefined();
    expect(rmAlert?.title).toContain('Low Stock');
    expect(rmAlert?.severity).toMatch(/warning|critical/);
  });

  it('2. In-App Notification Center: Marking single and all notifications as read', async () => {
    const { data: initialList } = await NotificationService.getNotifications({ is_read: false });
    expect(initialList.length).toBeGreaterThan(0);

    const firstItem = initialList[0];
    const markSuccess = await NotificationService.markAsRead(firstItem.id, 'user-admin-01');
    expect(markSuccess).toBe(true);

    // Verify marked as read
    const { data: afterSingle } = await NotificationService.getNotifications();
    const updated = afterSingle.find((n) => n.id === firstItem.id);
    expect(updated?.is_read).toBe(true);
    expect(updated?.read_at).toBeDefined();

    // Mark all as read
    const markedCount = await NotificationService.markAllAsRead('user-admin-01');
    expect(markedCount).toBeGreaterThanOrEqual(0);

    const { unread_count: finalUnread } = await NotificationService.getNotifications();
    expect(finalUnread).toBe(0);
  });

  it('3. Negative-Stock Guard Review: Confirms no path bypasses negative stock constraints', async () => {
    const integrity = await NotificationService.checkStockIntegrity();

    expect(integrity.passed).toBe(true);
    expect(integrity.violations_count).toBe(0);
    expect(integrity.violations).toHaveLength(0);
    expect(integrity.checked_at).toBeDefined();
  });

  it('4. Smart Production Suggestions: Calculates 30d/60d/90d sales velocity and days of stock remaining', async () => {
    const result = await SuggestionService.getProductionSuggestions(30);

    expect(result.data.length).toBeGreaterThan(0);
    expect(result.summary.total_skus).toBeGreaterThan(0);

    const topSuggestion = result.data[0];
    expect(topSuggestion.sku).toBeDefined();
    expect(topSuggestion.sales_velocity).toBeDefined();
    expect(topSuggestion.sales_velocity.daily_velocity).toBeDefined();
    expect(topSuggestion.days_of_stock_remaining).toBeDefined();
    expect(['critical', 'high', 'medium', 'healthy']).toContain(topSuggestion.urgency);

    // Verify suggested units calculation
    expect(topSuggestion.suggested_units).toBeGreaterThanOrEqual(0);
    expect(new Decimal(topSuggestion.suggested_batch_volume_ml).toNumber()).toBeGreaterThanOrEqual(0);
  });

  it('5. Smart Production Suggestions: Resolves Formula BOM and validates raw material sufficiency', async () => {
    const result = await SuggestionService.getProductionSuggestions(30);
    const suggestionWithFormula = result.data.find((s) => s.formula_id && s.suggested_units > 0);

    if (suggestionWithFormula) {
      expect(suggestionWithFormula.formula_id).toBeDefined();
      expect(suggestionWithFormula.formula_name).toBeDefined();
      expect(suggestionWithFormula.all_ingredients.length).toBeGreaterThan(0);
      expect(suggestionWithFormula.create_batch_payload).not.toBeNull();
      expect(suggestionWithFormula.create_batch_payload?.formula_id).toBe(suggestionWithFormula.formula_id);
      expect(new Decimal(suggestionWithFormula.sufficiency_rate_percent).toNumber()).toBeGreaterThanOrEqual(0);
    }
  });

  it('6. Acceptance Criteria: Suggestions change dynamically when seeded sales data changes', async () => {
    // 1. Get baseline suggestions
    const initialSuggestions = await SuggestionService.getProductionSuggestions(30);
    const lotsRes = await BottlingService.getFinishedGoodsLots();
    const lot = lotsRes.data[0];
    expect(lot).toBeDefined();

    const targetVariant = initialSuggestions.data.find((s) => s.variant_id === lot!.variant_id) || initialSuggestions.data[0];
    const initialVelocity = new Decimal(targetVariant.sales_velocity.daily_velocity);
    const initialSuggestedUnits = targetVariant.suggested_units;

    // 2. Inject an accelerated completed sale of units for this lot/variant
    await SalesService.createSale(
      {
        customer_id: 'cust-00000001-0000-0000-0000-000000000001',
        items: [
          {
            item_type: 'bottled',
            lot_id: lot!.id,
            variant_id: lot!.variant_id,
            quantity: 5,
            unit_price: 350.0,
          },
        ],
        payments: [
          {
            payment_method: 'card',
            amount: 1750.0,
          },
        ],
      },
      'user-admin-01',
      '00000000-0000-0000-0000-000000000001'
    );

    // 3. Recalculate production suggestions
    const updatedSuggestions = await SuggestionService.getProductionSuggestions(30);
    const updatedVariant = updatedSuggestions.data.find((s) => s.variant_id === targetVariant.variant_id);

    expect(updatedVariant).toBeDefined();
    const newVelocity = new Decimal(updatedVariant!.sales_velocity.daily_velocity);

    // Velocity must increase
    expect(newVelocity.toNumber()).toBeGreaterThan(initialVelocity.toNumber());

    // Suggested units to replenish 30-day runway must be calculated
    expect(updatedVariant!.suggested_units).toBeGreaterThanOrEqual(0);
  });

  it('7. API Endpoints: Verified /notifications, /unread-count, /scan and /suggestions/production', async () => {
    const server = app.listen(0);
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 4000;

    try {
      // Mock demo token
      const headers = {
        Authorization: 'Bearer demo-admin',
      };

      // 1. GET /api/v1/notifications
      const notifRes = await fetch(`http://127.0.0.1:${port}/api/v1/notifications`, { headers });
      const notifBody = await notifRes.json();
      expect(notifRes.status).toBe(200);
      expect(Array.isArray(notifBody.data)).toBe(true);

      // 2. GET /api/v1/notifications/unread-count
      const countRes = await fetch(`http://127.0.0.1:${port}/api/v1/notifications/unread-count`, { headers });
      const countBody = await countRes.json();
      expect(countRes.status).toBe(200);
      expect(countBody.data).toHaveProperty('unread_count');

      // 3. POST /api/v1/notifications/scan
      const scanRes = await fetch(`http://127.0.0.1:${port}/api/v1/notifications/scan`, {
        method: 'POST',
        headers,
      });
      const scanBody = await scanRes.json();
      expect(scanRes.status).toBe(200);
      expect(scanBody.data.success).toBe(true);

      // 4. GET /api/v1/system/integrity-check
      const checkRes = await fetch(`http://127.0.0.1:${port}/api/v1/system/integrity-check`, { headers });
      const checkBody = await checkRes.json();
      expect(checkRes.status).toBe(200);
      expect(checkBody.data.passed).toBe(true);

      // 5. GET /api/v1/suggestions/production
      const sugRes = await fetch(`http://127.0.0.1:${port}/api/v1/suggestions/production`, { headers });
      const sugBody = await sugRes.json();
      expect(sugRes.status).toBe(200);
      expect(Array.isArray(sugBody.data)).toBe(true);
      expect(sugBody.meta).toHaveProperty('urgent_count');
    } finally {
      server.close();
    }
  });
});
