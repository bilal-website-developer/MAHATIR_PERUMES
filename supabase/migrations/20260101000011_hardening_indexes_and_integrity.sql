-- ============================================================================
-- Migration: 20260101000011_hardening_indexes_and_integrity.sql
-- Description: Phase 10 Production Hardening, Performance Indexes & Integrity Verification
-- ============================================================================

-- 1. High-Performance Indexes for Foreign Keys, Searches, & Ledger Lookups
CREATE INDEX IF NOT EXISTS idx_stock_movements_item_composite 
    ON stock_movements(item_type, item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_movements_branch_date 
    ON stock_movements(branch_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_movements_reference 
    ON stock_movements(reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_raw_materials_branch_category 
    ON raw_materials(branch_id, category, is_active);

CREATE INDEX IF NOT EXISTS idx_raw_materials_sku_search 
    ON raw_materials(sku) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_status 
    ON purchase_orders(supplier_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_po_items_po_id 
    ON purchase_order_items(purchase_order_id);

CREATE INDEX IF NOT EXISTS idx_formulas_perfume_status 
    ON formulas(perfume_name, status, version DESC);

CREATE INDEX IF NOT EXISTS idx_formula_items_formula_id 
    ON formula_ingredients(formula_id);

CREATE INDEX IF NOT EXISTS idx_batches_code_perfume 
    ON batches(batch_code, perfume_name);

CREATE INDEX IF NOT EXISTS idx_batches_status_branch 
    ON batches(status, branch_id, production_date DESC);

CREATE INDEX IF NOT EXISTS idx_batch_ingredients_batch_id 
    ON batch_usage(batch_id);

CREATE INDEX IF NOT EXISTS idx_finished_goods_sku 
    ON product_variants(sku) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_finished_goods_perfume_size 
    ON products(name);

CREATE INDEX IF NOT EXISTS idx_bottling_runs_batch_id 
    ON bottling_runs(batch_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bottling_runs_variant_id 
    ON bottling_runs(variant_id);

CREATE INDEX IF NOT EXISTS idx_bottled_lots_variant_expiry 
    ON finished_goods_lots(variant_id, current_quantity);

CREATE INDEX IF NOT EXISTS idx_sales_invoice_number 
    ON sales(invoice_number);

CREATE INDEX IF NOT EXISTS idx_sales_cashier_date 
    ON sales(cashier_id, sale_date DESC);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id 
    ON sales_items(sale_id);

CREATE INDEX IF NOT EXISTS idx_sale_items_lot_id 
    ON sales_items(lot_id);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread 
    ON notifications(branch_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_type_dedup 
    ON notifications(type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_table_row 
    ON audit_log(table_name, row_id, created_at DESC);


-- 2. Stored Procedure: verify_inventory_integrity()
-- Reconciles all physical balances with append-only stock movement ledger entries,
-- and verifies batch volumetric conservation (produced = remaining + bottled + decanted + loss).
CREATE OR REPLACE FUNCTION verify_inventory_integrity(p_branch_id UUID DEFAULT NULL)
RETURNS TABLE (
    check_name TEXT,
    item_id UUID,
    item_reference TEXT,
    cached_value NUMERIC(18, 4),
    ledger_calculated_value NUMERIC(18, 4),
    discrepancy NUMERIC(18, 4),
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Check 1: Raw Materials stock reconciliation
    RETURN QUERY
    WITH ledger_calc AS (
        SELECT 
            sm.item_id,
            COALESCE(SUM(sm.quantity), 0) AS total_ledger
        FROM stock_movements sm
        WHERE sm.item_type = 'raw_material'
          AND (p_branch_id IS NULL OR sm.branch_id = p_branch_id)
        GROUP BY sm.item_id
    )
    SELECT 
        'raw_material_ledger_match'::TEXT AS check_name,
        rm.id AS item_id,
        (rm.sku || ' - ' || rm.name)::TEXT AS item_reference,
        rm.current_stock AS cached_value,
        COALESCE(lc.total_ledger, 0) AS ledger_calculated_value,
        (rm.current_stock - COALESCE(lc.total_ledger, 0)) AS discrepancy,
        CASE 
            WHEN rm.current_stock = COALESCE(lc.total_ledger, 0) THEN 'OK'
            ELSE 'DISCREPANCY'
        END AS status
    FROM raw_materials rm
    LEFT JOIN ledger_calc lc ON rm.id = lc.item_id
    WHERE (p_branch_id IS NULL OR rm.branch_id = p_branch_id);

    -- Check 2: Bottled Finished Goods lot reconciliation
    RETURN QUERY
    WITH lot_ledger AS (
        SELECT 
            sm.item_id AS lot_id,
            COALESCE(SUM(sm.quantity), 0) AS total_ledger
        FROM stock_movements sm
        WHERE sm.item_type = 'finished_goods_lot'
          AND (p_branch_id IS NULL OR sm.branch_id = p_branch_id)
        GROUP BY sm.item_id
    )
    SELECT 
        'finished_goods_lot_match'::TEXT AS check_name,
        bl.id AS item_id,
        (bl.lot_number || ' (' || fgv.sku || ')')::TEXT AS item_reference,
        bl.current_quantity AS cached_value,
        COALESCE(ll.total_ledger, 0) AS ledger_calculated_value,
        (bl.current_quantity - COALESCE(ll.total_ledger, 0)) AS discrepancy,
        CASE 
            WHEN bl.current_quantity = COALESCE(ll.total_ledger, 0) THEN 'OK'
            ELSE 'DISCREPANCY'
        END AS status
    FROM finished_goods_lots bl
    JOIN product_variants fgv ON bl.variant_id = fgv.id
    LEFT JOIN lot_ledger ll ON bl.id = ll.lot_id
    WHERE (p_branch_id IS NULL OR bl.branch_id = p_branch_id);

    -- Check 3: Batch Volumetric Conservation (produced_volume = remaining + bottled + decanted + loss)
    RETURN QUERY
    SELECT 
        'batch_volume_conservation'::TEXT AS check_name,
        b.id AS item_id,
        (b.batch_code || ' - ' || b.perfume_name)::TEXT AS item_reference,
        b.actual_volume AS cached_value,
        (COALESCE(b.remaining_volume, 0) +
         COALESCE((SELECT SUM(br.bulk_volume_deducted) FROM bottling_runs br WHERE br.batch_id = b.id), 0) +
         COALESCE((SELECT SUM(si.quantity) FROM sales_items si WHERE si.batch_id = b.id AND si.item_type = 'decant'), 0) +
         COALESCE(b.loss_volume, 0)) AS ledger_calculated_value,
        (b.actual_volume - (
            COALESCE(b.remaining_volume, 0) +
            COALESCE((SELECT SUM(br.bulk_volume_deducted) FROM bottling_runs br WHERE br.batch_id = b.id), 0) +
            COALESCE((SELECT SUM(si.quantity) FROM sales_items si WHERE si.batch_id = b.id AND si.item_type = 'decant'), 0) +
            COALESCE(b.loss_volume, 0)
        )) AS discrepancy,
        CASE
            WHEN b.actual_volume = (
                COALESCE(b.remaining_volume, 0) +
                COALESCE((SELECT SUM(br.bulk_volume_deducted) FROM bottling_runs br WHERE br.batch_id = b.id), 0) +
                COALESCE((SELECT SUM(si.quantity) FROM sales_items si WHERE si.batch_id = b.id AND si.item_type = 'decant'), 0) +
                COALESCE(b.loss_volume, 0)
            ) THEN 'OK'
            ELSE 'DISCREPANCY'
        END AS status
    FROM batches b
    WHERE b.status IN ('bulk', 'partial_bottled', 'completed');
      AND (p_branch_id IS NULL OR b.branch_id = p_branch_id);
END;
$$;
