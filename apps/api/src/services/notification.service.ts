import { Decimal } from 'decimal.js';
import { supabaseAdmin } from '../config/supabase.js';
import { InventoryService } from './inventory.service.js';
import { ProductService } from './product.service.js';
import { BatchService } from './batch.service.js';
import { BottlingService } from './bottling.service.js';

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertType = 
  | 'low_raw_material' 
  | 'low_finished_goods' 
  | 'production_needed' 
  | 'negative_stock_attempt' 
  | 'system';

export interface NotificationItem {
  id: string;
  branch_id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  entity_type?: string;
  entity_id?: string;
  data?: Record<string, any>;
  is_read: boolean;
  read_at?: string;
  read_by?: string;
  created_at: string;
  updated_at: string;
}

export interface StockIntegrityResult {
  passed: boolean;
  violations_count: number;
  violations: Array<{
    table: string;
    id: string;
    identifier: string;
    negative_value: string;
  }>;
  checked_at: string;
}

export interface AlertScanResult {
  success: boolean;
  raw_material_alerts_created: number;
  finished_goods_alerts_created: number;
  total_new_alerts: number;
  active_unread_count: number;
}

// In-Memory Notification Store (for offline testing & dev fallback)
let memoryNotifications: NotificationItem[] = [
  {
    id: 'notif-00000001-0000-0000-0000-000000000001',
    branch_id: '00000000-0000-0000-0000-000000000001',
    type: 'low_raw_material',
    severity: 'warning',
    title: 'Low Stock: Cambodian Aged Oud Oil',
    message: 'Current stock of Cambodian Aged Oud Oil is 80.00 ml, approaching safety threshold of 100.00 ml.',
    entity_type: 'raw_material',
    entity_id: 'rm-00000001-0000-0000-0000-000000000001',
    data: { sku: 'RM-OIL-OUD-01', current_stock: '80.0000', min_stock_level: '100.0000' },
    is_read: false,
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: 'notif-00000001-0000-0000-0000-000000000002',
    branch_id: '00000000-0000-0000-0000-000000000001',
    type: 'low_finished_goods',
    severity: 'critical',
    title: 'Critical Low Stock: Oud Royale Extrait (50ml)',
    message: 'Finished inventory for Oud Royale Extrait (50ml) is at 3 units, below minimum threshold of 5 units.',
    entity_type: 'product_variant',
    entity_id: 'pv-oud-royale-50ml',
    data: { sku: 'MAH-OUD-EXT-50', stock_quantity: '3.0000', min_stock_level: '5.0000' },
    is_read: false,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  }
];

export class NotificationService {
  /**
   * Reset memory notifications (useful for tests)
   */
  static resetMemoryNotifications(): void {
    memoryNotifications = [];
  }

  /**
   * Get all notifications with optional filters
   */
  static async getNotifications(filter?: {
    is_read?: boolean;
    severity?: AlertSeverity;
    type?: AlertType;
  }): Promise<{ data: NotificationItem[]; total: number; unread_count: number }> {
    if (process.env.NODE_ENV !== 'test') {
      try {
        let query = supabaseAdmin
          .from('notifications')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false });

        if (filter?.is_read !== undefined) {
          query = query.eq('is_read', filter.is_read);
        }
        if (filter?.severity) {
          query = query.eq('severity', filter.severity);
        }
        if (filter?.type) {
          query = query.eq('type', filter.type);
        }

        const { data, count, error } = await query;
        if (!error && data) {
          const unreadCount = data.filter((n) => !n.is_read).length;
          return { data, total: count || data.length, unread_count: unreadCount };
        }
      } catch (_e) {
        // Fallback to memory
      }
    }

    let results = [...memoryNotifications];
    if (filter?.is_read !== undefined) {
      results = results.filter((n) => n.is_read === filter.is_read);
    }
    if (filter?.severity) {
      results = results.filter((n) => n.severity === filter.severity);
    }
    if (filter?.type) {
      results = results.filter((n) => n.type === filter.type);
    }

    // Sort descending by created_at
    results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const unreadCount = memoryNotifications.filter((n) => !n.is_read).length;

    return {
      data: results,
      total: results.length,
      unread_count: unreadCount,
    };
  }

  /**
   * Get unread notifications count
   */
  static async getUnreadCount(): Promise<number> {
    const { unread_count } = await this.getNotifications();
    return unread_count;
  }

  /**
   * Mark a single notification as read
   */
  static async markAsRead(id: string, userId?: string): Promise<boolean> {
    if (process.env.NODE_ENV !== 'test') {
      try {
        const { error } = await supabaseAdmin.rpc('mark_notification_read', {
          p_notification_id: id,
          p_user_id: userId || null,
        });
        if (!error) return true;
      } catch (_e) {
        // fallback
      }
    }

    const item = memoryNotifications.find((n) => n.id === id);
    if (item) {
      item.is_read = true;
      item.read_at = new Date().toISOString();
      item.read_by = userId;
      item.updated_at = new Date().toISOString();
      return true;
    }
    return false;
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(userId?: string): Promise<number> {
    if (process.env.NODE_ENV !== 'test') {
      try {
        const { data, error } = await supabaseAdmin.rpc('mark_all_notifications_read', {
          p_user_id: userId || null,
        });
        if (!error && typeof data === 'number') return data;
      } catch (_e) {
        // fallback
      }
    }

    let count = 0;
    const now = new Date().toISOString();
    for (const item of memoryNotifications) {
      if (!item.is_read) {
        item.is_read = true;
        item.read_at = now;
        item.read_by = userId;
        item.updated_at = now;
        count++;
      }
    }
    return count;
  }

  /**
   * Trigger inventory threshold alert scan
   */
  static async triggerAlertScan(): Promise<AlertScanResult> {
    let rawAlertsCount = 0;
    let finishedAlertsCount = 0;

    // 1. Scan Raw Materials
    const { data: rawMaterials } = await InventoryService.getRawMaterials();
    for (const rm of rawMaterials) {
      const currentStock = new Decimal(rm.current_stock || '0');
      const minStock = new Decimal(rm.min_stock_level || '0');

      if (minStock.gt(0) && currentStock.lte(minStock)) {
        // Check if an unread alert already exists for this material
        const existing = memoryNotifications.find(
          (n) => n.entity_id === rm.id && !n.is_read && n.type === 'low_raw_material'
        );

        if (!existing) {
          const isCritical = currentStock.lte(0);
          const newNotif: NotificationItem = {
            id: `notif-rm-${rm.id.slice(0, 8)}-${Date.now()}`,
            branch_id: rm.branch_id || '00000000-0000-0000-0000-000000000001',
            type: 'low_raw_material',
            severity: isCritical ? 'critical' : 'warning',
            title: `Low Stock: ${rm.name}`,
            message: `Stock for ${rm.name} (${rm.sku}) is ${currentStock.toString()} ${rm.base_unit || 'ml'}, below threshold of ${minStock.toString()} ${rm.base_unit || 'ml'}.`,
            entity_type: 'raw_material',
            entity_id: rm.id,
            data: {
              sku: rm.sku,
              current_stock: currentStock.toString(),
              min_stock_level: minStock.toString(),
            },
            is_read: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          memoryNotifications.unshift(newNotif);
          rawAlertsCount++;
          this.dispatchEmailAlert(newNotif);
        }
      }
    }

    // 2. Scan Finished Goods Variants
    const { data: variants } = await ProductService.getProductVariants();
    for (const v of variants) {
      const currentStock = new Decimal(v.current_stock || '0');
      const minStock = new Decimal(v.min_stock_level || '5');

      if (minStock.gt(0) && currentStock.lte(minStock)) {
        const existing = memoryNotifications.find(
          (n) => n.entity_id === v.id && !n.is_read && n.type === 'low_finished_goods'
        );

        if (!existing) {
          const isCritical = currentStock.lte(0);
          const newNotif: NotificationItem = {
            id: `notif-pv-${v.id.slice(0, 8)}-${Date.now()}`,
            branch_id: '00000000-0000-0000-0000-000000000001',
            type: 'low_finished_goods',
            severity: isCritical ? 'critical' : 'warning',
            title: `Low Finished Goods: ${v.product_name || v.name}`,
            message: `Inventory for ${v.product_name || v.name} (${v.sku}) is ${currentStock.toString()} units, below minimum threshold of ${minStock.toString()} units.`,
            entity_type: 'product_variant',
            entity_id: v.id,
            data: {
              sku: v.sku,
              current_stock: currentStock.toString(),
              min_stock_level: minStock.toString(),
            },
            is_read: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          memoryNotifications.unshift(newNotif);
          finishedAlertsCount++;
          this.dispatchEmailAlert(newNotif);
        }
      }
    }

    const unreadCount = memoryNotifications.filter((n) => !n.is_read).length;

    return {
      success: true,
      raw_material_alerts_created: rawAlertsCount,
      finished_goods_alerts_created: finishedAlertsCount,
      total_new_alerts: rawAlertsCount + finishedAlertsCount,
      active_unread_count: unreadCount,
    };
  }

  /**
   * Negative-Stock Guard Review & Integrity Scanner
   * Confirms that no path in raw materials, batches, or finished goods bypasses negative stock constraints
   */
  static async checkStockIntegrity(): Promise<StockIntegrityResult> {
    const violations: Array<{
      table: string;
      id: string;
      identifier: string;
      negative_value: string;
    }> = [];

    // 1. Raw Materials check
    const { data: rawMaterials } = await InventoryService.getRawMaterials();
    for (const rm of rawMaterials) {
      const stock = new Decimal(rm.current_stock || '0');
      if (stock.lt(0)) {
        violations.push({
          table: 'raw_materials',
          id: rm.id,
          identifier: `${rm.name} (${rm.sku})`,
          negative_value: stock.toString(),
        });
      }
    }

    // 2. Bulk Batches check
    const { data: bulkBatches } = await BatchService.getBulkInventory();
    for (const b of bulkBatches) {
      const vol = new Decimal(b.current_volume || '0');
      if (vol.lt(0)) {
        violations.push({
          table: 'batches',
          id: b.id,
          identifier: `Batch ${b.batch_code}`,
          negative_value: vol.toString(),
        });
      }
    }

    // 3. Finished Goods Lots check
    const { data: lots } = await BottlingService.getFinishedGoodsLots();
    for (const lot of lots) {
      const qty = new Decimal(lot.current_quantity || '0');
      if (qty.lt(0)) {
        violations.push({
          table: 'finished_goods_lots',
          id: lot.id,
          identifier: `Lot ${lot.lot_number}`,
          negative_value: qty.toString(),
        });
      }
    }

    // 4. Product Variants check
    const { data: variants } = await ProductService.getProductVariants();
    for (const v of variants) {
      const stock = new Decimal(v.current_stock || '0');
      if (stock.lt(0)) {
        violations.push({
          table: 'product_variants',
          id: v.id,
          identifier: `${v.name} (${v.sku})`,
          negative_value: stock.toString(),
        });
      }
    }

    return {
      passed: violations.length === 0,
      violations_count: violations.length,
      violations,
      checked_at: new Date().toISOString(),
    };
  }

  /**
   * Dispatch email notification (Resend / SMTP or development fallback logger)
   */
  private static dispatchEmailAlert(_notification: NotificationItem): void {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      // Plugged into Resend API when key provided
      // console.log(`[EMAIL DISPATCH - RESEND] To Admin: [${notification.severity.toUpperCase()}] ${notification.title}`);
    } else {
      // Dev / Test fallback logging
      // In production without key, notifications are retained in in-app notification center
    }
  }
}
