-- ============================================================================
-- Mahatir Perfumes ERP + POS: Migration 000009
-- Phase 8: Costing, Bidirectional Traceability and Business Intelligence Reports
-- ============================================================================

-- 1. View: Comprehensive Inventory Valuation
CREATE OR REPLACE VIEW view_inventory_valuation AS
SELECT 
    'raw_materials' AS asset_category,
    rm.category::TEXT AS subcategory,
    COUNT(rm.id) AS item_count,
    COALESCE(SUM(rm.current_stock), 0) AS total_units_or_volume,
    COALESCE(SUM(rm.current_stock * rm.cost_per_unit), 0) AS total_valuation
FROM raw_materials rm
WHERE rm.is_active = true AND rm.deleted_at IS NULL
GROUP BY rm.category

UNION ALL

SELECT 
    'bulk_liquid' AS asset_category,
    'macerated_bulk'::TEXT AS subcategory,
    COUNT(b.id) AS item_count,
    COALESCE(SUM(b.remaining_volume), 0) AS total_units_or_volume,
    COALESCE(SUM(b.remaining_volume * b.cost_per_ml), 0) AS total_valuation
FROM batches b
WHERE b.status IN ('bulk', 'partial_bottled') AND b.remaining_volume > 0

UNION ALL

SELECT 
    'finished_goods' AS asset_category,
    'bottled_flacons'::TEXT AS subcategory,
    COUNT(fgl.id) AS item_count,
    COALESCE(SUM(fgl.current_quantity), 0) AS total_units_or_volume,
    COALESCE(SUM(fgl.current_quantity * fgl.unit_cost), 0) AS total_valuation
FROM finished_goods_lots fgl
WHERE fgl.current_quantity > 0;

-- 2. View: Product & SKU Profitability Summary
CREATE OR REPLACE VIEW view_sku_profitability AS
SELECT 
    pv.id AS variant_id,
    pv.sku,
    pv.name AS variant_name,
    p.name AS product_name,
    COUNT(si.id) AS sales_line_count,
    COALESCE(SUM(si.quantity), 0) AS units_sold,
    COALESCE(SUM(si.line_total), 0) AS gross_revenue,
    COALESCE(SUM(si.quantity * si.unit_cost_snapshot), 0) AS total_cogs,
    COALESCE(SUM(si.profit), 0) AS total_profit,
    CASE 
        WHEN COALESCE(SUM(si.line_total), 0) > 0 
        THEN ROUND((COALESCE(SUM(si.profit), 0) / SUM(si.line_total) * 100), 2)
        ELSE 0.00
    END AS gross_margin_percent
FROM product_variants pv
JOIN products p ON pv.product_id = p.id
LEFT JOIN sales_items si ON si.variant_id = pv.id AND si.item_type = 'bottled'
LEFT JOIN sales s ON si.sale_id = s.id AND s.status = 'completed'
GROUP BY pv.id, pv.sku, pv.name, p.name;

-- 3. View: Batch Cost and Loss Analysis
CREATE OR REPLACE VIEW view_batch_cost_analysis AS
SELECT 
    b.id AS batch_id,
    b.batch_code,
    b.perfume_name,
    b.status,
    b.expected_volume,
    b.actual_volume,
    b.remaining_volume,
    b.loss_volume,
    b.loss_percent,
    b.total_cost,
    b.cost_per_ml,
    b.production_date,
    COALESCE(COUNT(br.id), 0) AS bottling_runs_count,
    COALESCE(SUM(br.quantity_bottled), 0) AS total_bottles_produced
FROM batches b
LEFT JOIN bottling_runs br ON br.batch_id = b.id
GROUP BY b.id, b.batch_code, b.perfume_name, b.status, b.expected_volume, b.actual_volume, 
         b.remaining_volume, b.loss_volume, b.loss_percent, b.total_cost, b.cost_per_ml, b.production_date;

-- 4. Function: Backward Traceability from Sale Item
CREATE OR REPLACE FUNCTION trace_backward_from_sale(p_sale_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'sale', jsonb_build_object(
            'id', s.id,
            'invoice_number', s.invoice_number,
            'total_amount', s.total_amount,
            'status', s.status,
            'created_at', s.created_at,
            'customer', jsonb_build_object('name', c.name, 'phone', c.phone)
        ),
        'items', jsonb_agg(
            jsonb_build_object(
                'item_type', si.item_type,
                'quantity', si.quantity,
                'unit_price', si.unit_price,
                'unit_cost_snapshot', si.unit_cost_snapshot,
                'line_profit', si.profit,
                'lot', CASE WHEN fgl.id IS NOT NULL THEN jsonb_build_object(
                    'lot_number', fgl.lot_number,
                    'unit_cost', fgl.unit_cost,
                    'bottling_run', jsonb_build_object(
                        'run_code', br.run_code,
                        'quantity_bottled', br.quantity_bottled,
                        'created_at', br.created_at
                    )
                ) ELSE NULL END,
                'batch', jsonb_build_object(
                    'batch_code', b.batch_code,
                    'perfume_name', b.perfume_name,
                    'cost_per_ml', b.cost_per_ml,
                    'production_date', b.production_date,
                    'formula_version', b.formula_version_label
                )
            )
        )
    )
    INTO v_result
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    JOIN sales_items si ON si.sale_id = s.id
    LEFT JOIN finished_goods_lots fgl ON si.lot_id = fgl.id
    LEFT JOIN bottling_runs br ON fgl.id = br.lot_id
    LEFT JOIN batches b ON (si.batch_id = b.id OR fgl.batch_id = b.id OR br.batch_id = b.id)
    WHERE s.id = p_sale_id
    GROUP BY s.id, s.invoice_number, s.total_amount, s.status, s.created_at, c.name, c.phone;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 5. Function: Forward Traceability from Batch
CREATE OR REPLACE FUNCTION trace_forward_from_batch(p_batch_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'batch', jsonb_build_object(
            'id', b.id,
            'batch_code', b.batch_code,
            'perfume_name', b.perfume_name,
            'actual_volume', b.actual_volume,
            'remaining_volume', b.remaining_volume,
            'cost_per_ml', b.cost_per_ml,
            'status', b.status,
            'production_date', b.production_date
        ),
        'bottling_runs', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'run_code', br.run_code,
                    'quantity_bottled', br.quantity_bottled,
                    'unit_cost', br.unit_cost,
                    'created_at', br.created_at,
                    'variant_sku', pv.sku,
                    'variant_name', pv.name,
                    'lot_number', fgl.lot_number,
                    'current_lot_stock', fgl.current_quantity
                )
            ), '[]'::jsonb)
            FROM bottling_runs br
            LEFT JOIN product_variants pv ON br.variant_id = pv.id
            LEFT JOIN finished_goods_lots fgl ON br.lot_id = fgl.id
            WHERE br.batch_id = b.id
        ),
        'sales', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'invoice_number', s.invoice_number,
                    'sale_date', s.created_at,
                    'customer_name', COALESCE(c.name, 'Walk-in Boutique Client'),
                    'item_type', si.item_type,
                    'quantity', si.quantity,
                    'unit_price', si.unit_price,
                    'line_total', si.line_total,
                    'line_profit', si.profit
                )
            ), '[]'::jsonb)
            FROM sales_items si
            JOIN sales s ON si.sale_id = s.id AND s.status = 'completed'
            LEFT JOIN customers c ON s.customer_id = c.id
            LEFT JOIN finished_goods_lots fgl ON si.lot_id = fgl.id
            WHERE si.batch_id = b.id OR fgl.batch_id = b.id
        )
    )
    INTO v_result
    FROM batches b
    WHERE b.id = p_batch_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
