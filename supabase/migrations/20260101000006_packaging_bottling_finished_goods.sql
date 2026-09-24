-- ==============================================================================
-- Mahatir Perfumes ERP - Migration 000006: Packaging, Bottling & Finished Goods
-- ==============================================================================

-- 1. Packaging Recipes Table
-- Defines packaging BOM per bottle size (e.g. 50ml flacon requires 1 bottle, 1 cap, 1 label, 1 box)
CREATE TABLE IF NOT EXISTS packaging_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    size_ml NUMERIC(18, 4) NOT NULL CHECK (size_ml > 0),
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_packaging_recipes_branch ON packaging_recipes(branch_id);
CREATE INDEX IF NOT EXISTS idx_packaging_recipes_size ON packaging_recipes(size_ml);

-- 2. Packaging Recipe Items Table
CREATE TABLE IF NOT EXISTS packaging_recipe_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES packaging_recipes(id) ON DELETE CASCADE,
    raw_material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE RESTRICT,
    quantity_per_unit NUMERIC(18, 4) NOT NULL CHECK (quantity_per_unit > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pkg_recipe_items_recipe ON packaging_recipe_items(recipe_id);
CREATE INDEX IF NOT EXISTS idx_pkg_recipe_items_material ON packaging_recipe_items(raw_material_id);

-- 3. Products Table (Master Perfume Catalogue)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    formula_id UUID REFERENCES formulas(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'fragrance',
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_product_code UNIQUE (branch_id, code)
);

CREATE INDEX IF NOT EXISTS idx_products_branch ON products(branch_id);
CREATE INDEX IF NOT EXISTS idx_products_formula ON products(formula_id);

-- 4. Product Variants Table (Sellable SKUs per bottle size)
CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    packaging_recipe_id UUID REFERENCES packaging_recipes(id) ON DELETE SET NULL,
    sku VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    size_ml NUMERIC(18, 4) NOT NULL CHECK (size_ml > 0),
    selling_price NUMERIC(18, 4) NOT NULL CHECK (selling_price >= 0),
    barcode VARCHAR(100),
    current_stock NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
    min_stock_level NUMERIC(18, 4) NOT NULL DEFAULT 5 CHECK (min_stock_level >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_product_variant_sku UNIQUE (sku)
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_recipe ON product_variants(packaging_recipe_id);

-- 5. Finished Goods Lots Table (Inventory by manufacturing batch)
CREATE TABLE IF NOT EXISTS finished_goods_lots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
    lot_number VARCHAR(100) NOT NULL,
    initial_quantity NUMERIC(18, 4) NOT NULL CHECK (initial_quantity > 0),
    current_quantity NUMERIC(18, 4) NOT NULL CHECK (current_quantity >= 0),
    unit_cost NUMERIC(18, 4) NOT NULL CHECK (unit_cost >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fg_lots_variant ON finished_goods_lots(variant_id);
CREATE INDEX IF NOT EXISTS idx_fg_lots_batch ON finished_goods_lots(batch_id);

-- 6. Bottling Runs Table (Execution history)
CREATE TABLE IF NOT EXISTS bottling_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    run_code VARCHAR(100) NOT NULL,
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    lot_id UUID REFERENCES finished_goods_lots(id) ON DELETE SET NULL,
    quantity_bottled NUMERIC(18, 4) NOT NULL CHECK (quantity_bottled > 0),
    bulk_volume_deducted NUMERIC(18, 4) NOT NULL CHECK (bulk_volume_deducted > 0),
    packaging_cost_total NUMERIC(18, 4) NOT NULL DEFAULT 0,
    bulk_cost_total NUMERIC(18, 4) NOT NULL DEFAULT 0,
    unit_cost NUMERIC(18, 4) NOT NULL CHECK (unit_cost >= 0),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bottling_runs_batch ON bottling_runs(batch_id);
CREATE INDEX IF NOT EXISTS idx_bottling_runs_variant ON bottling_runs(variant_id);

-- 7. Add Triggers
CREATE TRIGGER trg_packaging_recipes_updated_at
    BEFORE UPDATE ON packaging_recipes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_product_variants_updated_at
    BEFORE UPDATE ON product_variants
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_fg_lots_updated_at
    BEFORE UPDATE ON finished_goods_lots
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Attach Audit Log Triggers
CREATE TRIGGER trg_audit_packaging_recipes
    AFTER INSERT OR UPDATE OR DELETE ON packaging_recipes
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER trg_audit_products
    AFTER INSERT OR UPDATE OR DELETE ON products
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER trg_audit_product_variants
    AFTER INSERT OR UPDATE OR DELETE ON product_variants
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER trg_audit_fg_lots
    AFTER INSERT OR UPDATE OR DELETE ON finished_goods_lots
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER trg_audit_bottling_runs
    AFTER INSERT OR UPDATE OR DELETE ON bottling_runs
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- 8. Enable Row-Level Security
ALTER TABLE packaging_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE packaging_recipe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE finished_goods_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bottling_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read packaging_recipes" ON packaging_recipes FOR SELECT USING (true);
CREATE POLICY "Manage packaging_recipes" ON packaging_recipes FOR ALL USING (
    has_role(ARRAY['admin'::user_role, 'production_manager'::user_role, 'inventory_manager'::user_role])
);

CREATE POLICY "Read packaging_recipe_items" ON packaging_recipe_items FOR SELECT USING (true);
CREATE POLICY "Manage packaging_recipe_items" ON packaging_recipe_items FOR ALL USING (
    has_role(ARRAY['admin'::user_role, 'production_manager'::user_role, 'inventory_manager'::user_role])
);

CREATE POLICY "Read products" ON products FOR SELECT USING (true);
CREATE POLICY "Manage products" ON products FOR ALL USING (
    has_role(ARRAY['admin'::user_role, 'production_manager'::user_role])
);

CREATE POLICY "Read product_variants" ON product_variants FOR SELECT USING (true);
CREATE POLICY "Manage product_variants" ON product_variants FOR ALL USING (
    has_role(ARRAY['admin'::user_role, 'production_manager'::user_role])
);

CREATE POLICY "Read finished_goods_lots" ON finished_goods_lots FOR SELECT USING (true);
CREATE POLICY "Manage finished_goods_lots" ON finished_goods_lots FOR ALL USING (
    has_role(ARRAY['admin'::user_role, 'production_manager'::user_role])
);

CREATE POLICY "Read bottling_runs" ON bottling_runs FOR SELECT USING (true);
CREATE POLICY "Manage bottling_runs" ON bottling_runs FOR ALL USING (
    has_role(ARRAY['admin'::user_role, 'production_manager'::user_role])
);

-- ==============================================================================
-- 9. Atomic Bottling RPC: bottle_batch
-- ==============================================================================
CREATE OR REPLACE FUNCTION bottle_batch(
    p_batch_id UUID,
    p_variant_id UUID,
    p_quantity NUMERIC,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_batch RECORD;
    v_bulk RECORD;
    v_variant RECORD;
    v_product RECORD;
    v_recipe RECORD;
    v_item RECORD;
    v_mat RECORD;
    v_bulk_needed NUMERIC(18, 4);
    v_packaging_cost NUMERIC(18, 4) := 0;
    v_line_packaging_cost NUMERIC(18, 4);
    v_bulk_cost NUMERIC(18, 4);
    v_unit_cost NUMERIC(18, 4);
    v_lot_id UUID;
    v_run_id UUID;
    v_run_code VARCHAR(100);
    v_lot_number VARCHAR(100);
    v_remaining_bulk NUMERIC(18, 4);
    v_count INT;
BEGIN
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Bottling quantity must be greater than zero.';
    END IF;

    -- 1. Lock and fetch Batch
    SELECT * INTO v_batch
    FROM batches
    WHERE id = p_batch_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Batch with ID % not found.', p_batch_id;
    END IF;

    IF v_batch.status NOT IN ('bulk', 'draft') THEN
        RAISE EXCEPTION 'Batch % is in status %, cannot bottle.', v_batch.batch_code, v_batch.status;
    END IF;

    -- 2. Lock and fetch Variant
    SELECT pv.*, p.name AS product_name, p.branch_id
    INTO v_variant
    FROM product_variants pv
    JOIN products p ON p.id = pv.product_id
    WHERE pv.id = p_variant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product variant with ID % not found.', p_variant_id;
    END IF;

    -- 3. Calculate bulk liquid required
    v_bulk_needed := ROUND(p_quantity * v_variant.size_ml, 4);

    -- Check Bulk Inventory
    SELECT * INTO v_bulk
    FROM bulk_inventory
    WHERE batch_id = p_batch_id AND branch_id = v_batch.branch_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bulk inventory for batch % not found.', v_batch.batch_code;
    END IF;

    IF v_bulk.current_volume < v_bulk_needed THEN
        RAISE EXCEPTION 'Insufficient bulk liquid in batch %. Required: % ml, Available: % ml.',
            v_batch.batch_code, v_bulk_needed, v_bulk.current_volume;
    END IF;

    -- 4. Check & Validate Packaging Materials
    IF v_variant.packaging_recipe_id IS NOT NULL THEN
        FOR v_item IN
            SELECT pri.raw_material_id, pri.quantity_per_unit, rm.name, rm.current_stock, rm.cost_per_unit
            FROM packaging_recipe_items pri
            JOIN raw_materials rm ON rm.id = pri.raw_material_id
            WHERE pri.recipe_id = v_variant.packaging_recipe_id
            FOR UPDATE OF rm
        LOOP
            IF v_item.current_stock < (p_quantity * v_item.quantity_per_unit) THEN
                RAISE EXCEPTION 'Insufficient packaging material "%". Required: %, Available: %.',
                    v_item.name, (p_quantity * v_item.quantity_per_unit), v_item.current_stock;
            END IF;

            v_line_packaging_cost := ROUND(v_item.cost_per_unit * (p_quantity * v_item.quantity_per_unit), 4);
            v_packaging_cost := v_packaging_cost + v_line_packaging_cost;
        END LOOP;
    END IF;

    -- 5. Deduct Bulk Liquid
    v_remaining_bulk := v_bulk.current_volume - v_bulk_needed;
    UPDATE bulk_inventory
    SET current_volume = v_remaining_bulk,
        status = CASE WHEN v_remaining_bulk = 0 THEN 'consumed' ELSE 'available' END,
        updated_at = NOW()
    WHERE id = v_bulk.id;

    UPDATE batches
    SET remaining_volume = v_remaining_bulk,
        updated_at = NOW()
    WHERE id = p_batch_id;

    -- 6. Deduct Packaging Materials and append to stock ledger
    IF v_variant.packaging_recipe_id IS NOT NULL THEN
        FOR v_item IN
            SELECT pri.raw_material_id, pri.quantity_per_unit, rm.current_stock, rm.cost_per_unit, rm.base_unit
            FROM packaging_recipe_items pri
            JOIN raw_materials rm ON rm.id = pri.raw_material_id
            WHERE pri.recipe_id = v_variant.packaging_recipe_id
        LOOP
            -- Deduct stock
            UPDATE raw_materials
            SET current_stock = current_stock - (p_quantity * v_item.quantity_per_unit),
                updated_at = NOW()
            WHERE id = v_item.raw_material_id;

            -- Insert ledger movement
            INSERT INTO stock_movements (
                branch_id, item_type, item_id, quantity, unit, unit_cost,
                total_cost, reference_type, reference_id, reason, user_id
            ) VALUES (
                v_batch.branch_id, 'raw_material', v_item.raw_material_id,
                -(p_quantity * v_item.quantity_per_unit), v_item.base_unit,
                v_item.cost_per_unit,
                ROUND(-(p_quantity * v_item.quantity_per_unit) * v_item.cost_per_unit, 4),
                'bottling_consumption', p_batch_id,
                'Packaging consumed for bottling ' || p_quantity || ' units of ' || v_variant.sku,
                p_user_id
            );
        END LOOP;
    END IF;

    -- 7. Costing Calculation:
    -- Unit Cost = (Cost Per ml * Size in ml) + (Packaging Cost Total / Quantity)
    v_bulk_cost := ROUND(v_batch.cost_per_ml * v_bulk_needed, 4);
    v_unit_cost := ROUND((v_batch.cost_per_ml * v_variant.size_ml) + (v_packaging_cost / p_quantity), 4);

    -- 8. Generate Codes
    SELECT COUNT(*) + 1 INTO v_count FROM bottling_runs;
    v_run_code := 'BTL-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(v_count::TEXT, 4, '0');
    v_lot_number := 'LOT-' || v_batch.batch_code || '-' || v_variant.sku;

    -- 9. Insert Finished Goods Lot
    INSERT INTO finished_goods_lots (
        branch_id, variant_id, batch_id, lot_number,
        initial_quantity, current_quantity, unit_cost
    ) VALUES (
        v_batch.branch_id, p_variant_id, p_batch_id, v_lot_number,
        p_quantity, p_quantity, v_unit_cost
    ) RETURNING id INTO v_lot_id;

    -- 10. Update Product Variant Stock
    UPDATE product_variants
    SET current_stock = current_stock + p_quantity,
        updated_at = NOW()
    WHERE id = p_variant_id;

    -- 11. Record Bottling Run
    INSERT INTO bottling_runs (
        branch_id, run_code, batch_id, variant_id, lot_id,
        quantity_bottled, bulk_volume_deducted, packaging_cost_total,
        bulk_cost_total, unit_cost, created_by
    ) VALUES (
        v_batch.branch_id, v_run_code, p_batch_id, p_variant_id, v_lot_id,
        p_quantity, v_bulk_needed, v_packaging_cost,
        v_bulk_cost, v_unit_cost, p_user_id
    ) RETURNING id INTO v_run_id;

    RETURN jsonb_build_object(
        'success', true,
        'run_code', v_run_code,
        'lot_number', v_lot_number,
        'quantity_bottled', p_quantity,
        'bulk_volume_deducted', v_bulk_needed,
        'packaging_cost', v_packaging_cost,
        'bulk_cost', v_bulk_cost,
        'unit_cost', v_unit_cost,
        'remaining_bulk_volume', v_remaining_bulk
    );
END;
$$;
