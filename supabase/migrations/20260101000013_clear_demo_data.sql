-- One-time cleanup for records explicitly registered as demo data.
CREATE TABLE IF NOT EXISTS demo_data_clearance (
    id BOOLEAN PRIMARY KEY DEFAULT true,
    cleared_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS demo_data_registry (
    table_name TEXT NOT NULL,
    row_id UUID NOT NULL,
    PRIMARY KEY (table_name, row_id)
);

CREATE OR REPLACE FUNCTION clear_demo_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM demo_data_clearance WHERE id = true) THEN
        RETURN jsonb_build_object('cleared', false, 'already_cleared', true);
    END IF;

    INSERT INTO demo_data_clearance (id) VALUES (true);

    -- Only rows registered by the seed process may be removed. User-created
    -- rows are never inferred from branch, age, or ownership.
    DELETE FROM payments WHERE id IN (SELECT row_id FROM demo_data_registry WHERE table_name = 'payments');
    DELETE FROM sales_items WHERE id IN (SELECT row_id FROM demo_data_registry WHERE table_name = 'sales_items');
    DELETE FROM sales WHERE id IN (SELECT row_id FROM demo_data_registry WHERE table_name = 'sales');
    DELETE FROM customers WHERE id IN (SELECT row_id FROM demo_data_registry WHERE table_name = 'customers');
    DELETE FROM notifications WHERE id IN (SELECT row_id FROM demo_data_registry WHERE table_name = 'notifications');
    DELETE FROM alert_configurations WHERE id IN (SELECT row_id FROM demo_data_registry WHERE table_name = 'alert_configurations');
    DELETE FROM bottling_runs WHERE id IN (SELECT row_id FROM demo_data_registry WHERE table_name = 'bottling_runs');
    DELETE FROM finished_goods_lots WHERE id IN (SELECT row_id FROM demo_data_registry WHERE table_name = 'finished_goods_lots');
    DELETE FROM packaging_recipe_items WHERE id IN (SELECT row_id FROM demo_data_registry WHERE table_name = 'packaging_recipe_items');
    DELETE FROM product_variants WHERE id IN (SELECT row_id FROM demo_data_registry WHERE table_name = 'product_variants');
    DELETE FROM products WHERE id IN (SELECT row_id FROM demo_data_registry WHERE table_name = 'products');
    DELETE FROM packaging_recipes WHERE id IN (SELECT row_id FROM demo_data_registry WHERE table_name = 'packaging_recipes');
    DELETE FROM bulk_inventory WHERE id IN (SELECT row_id FROM demo_data_registry WHERE table_name = 'bulk_inventory');
    DELETE FROM batch_losses WHERE id IN (SELECT row_id FROM demo_data_registry WHERE table_name = 'batch_losses');
    DELETE FROM batch_usage WHERE id IN (SELECT row_id FROM demo_data_registry WHERE table_name = 'batch_usage');
    DELETE FROM batches WHERE id IN (SELECT row_id FROM demo_data_registry WHERE table_name = 'batches');
    DELETE FROM formula_ingredients WHERE id IN (SELECT row_id FROM demo_data_registry WHERE table_name = 'formula_ingredients');
    DELETE FROM formulas WHERE id IN (SELECT row_id FROM demo_data_registry WHERE table_name = 'formulas');
    DELETE FROM purchase_order_items WHERE id IN (SELECT row_id FROM demo_data_registry WHERE table_name = 'purchase_order_items');
    DELETE FROM purchase_orders WHERE id IN (SELECT row_id FROM demo_data_registry WHERE table_name = 'purchase_orders');
    DELETE FROM supplier_materials WHERE id IN (SELECT row_id FROM demo_data_registry WHERE table_name = 'supplier_materials');
    DELETE FROM suppliers WHERE id IN (SELECT row_id FROM demo_data_registry WHERE table_name = 'suppliers');
    DELETE FROM stock_movements WHERE id IN (SELECT row_id FROM demo_data_registry WHERE table_name = 'stock_movements');
    DELETE FROM raw_materials WHERE id IN (SELECT row_id FROM demo_data_registry WHERE table_name = 'raw_materials');
    DELETE FROM dilution_presets WHERE id IN (SELECT row_id FROM demo_data_registry WHERE table_name = 'dilution_presets');
    DELETE FROM audit_log WHERE id IN (SELECT row_id FROM demo_data_registry WHERE table_name = 'audit_log');
    DELETE FROM demo_data_registry;

    RETURN jsonb_build_object('cleared', true, 'already_cleared', false);
END;
$$;
