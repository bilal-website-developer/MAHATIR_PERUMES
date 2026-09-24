-- One-time cleanup for seeded/demo transactional data.
CREATE TABLE IF NOT EXISTS demo_data_clearance (
    id BOOLEAN PRIMARY KEY DEFAULT true,
    cleared_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

    DELETE FROM payments;
    DELETE FROM sales_items;
    DELETE FROM sales;
    DELETE FROM customers;
    DELETE FROM notifications;
    DELETE FROM alert_configurations;
    DELETE FROM bottling_runs;
    DELETE FROM finished_goods_lots;
    DELETE FROM packaging_recipe_items;
    DELETE FROM product_variants;
    DELETE FROM products;
    DELETE FROM packaging_recipes;
    DELETE FROM bulk_inventory;
    DELETE FROM batch_losses;
    DELETE FROM batch_usage;
    DELETE FROM batches;
    DELETE FROM formula_ingredients;
    DELETE FROM formulas;
    DELETE FROM purchase_order_items;
    DELETE FROM purchase_orders;
    DELETE FROM supplier_materials;
    DELETE FROM suppliers;
    DELETE FROM stock_movements;
    DELETE FROM raw_materials;
    DELETE FROM dilution_presets;
    DELETE FROM audit_log;

    RETURN jsonb_build_object('cleared', true, 'already_cleared', false);
END;
$$;
