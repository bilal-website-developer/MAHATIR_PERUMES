-- 20260101000004_formulas_and_bom.sql
-- Mahatir Perfumes ERP + POS: Formula / BOM Engine with Versions, Locking & Scaling

-- 1. Create Enums if not exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'formula_status') THEN
        CREATE TYPE formula_status AS ENUM (
            'active',
            'archived',
            'draft'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quantity_type') THEN
        CREATE TYPE quantity_type AS ENUM (
            'percent',
            'fixed_ml'
        );
    END IF;
END $$;

-- 2. Formulas Table
CREATE TABLE IF NOT EXISTS formulas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT DEFAULT '00000000-0000-0000-0000-000000000001',
    perfume_name TEXT NOT NULL,
    code TEXT NOT NULL,
    version INT NOT NULL DEFAULT 1 CHECK (version >= 1),
    version_label TEXT NOT NULL DEFAULT 'V1',
    status formula_status NOT NULL DEFAULT 'active',
    is_locked BOOLEAN NOT NULL DEFAULT false,
    locked_reason TEXT,
    locked_at TIMESTAMPTZ,
    target_concentration TEXT NOT NULL DEFAULT 'EDP',
    notes TEXT,
    description TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_formulas_perfume_name ON formulas(perfume_name);
CREATE INDEX IF NOT EXISTS idx_formulas_status ON formulas(status);
CREATE INDEX IF NOT EXISTS idx_formulas_code ON formulas(code);

-- Unique rule: Only ONE Active version per perfume name within a branch
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_formula_per_perfume
ON formulas (branch_id, lower(trim(perfume_name)))
WHERE status = 'active' AND deleted_at IS NULL;

-- Attach updated_at trigger
DROP TRIGGER IF EXISTS trg_formulas_updated_at ON formulas;
CREATE TRIGGER trg_formulas_updated_at
    BEFORE UPDATE ON formulas
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Attach generic audit trigger
DROP TRIGGER IF EXISTS trg_formulas_audit ON formulas;
CREATE TRIGGER trg_formulas_audit
    AFTER INSERT OR UPDATE OR DELETE ON formulas
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_func();

-- 3. Formula Ingredients Table
CREATE TABLE IF NOT EXISTS formula_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    formula_id UUID NOT NULL REFERENCES formulas(id) ON DELETE CASCADE,
    raw_material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE RESTRICT,
    quantity_type quantity_type NOT NULL,
    value NUMERIC(18, 4) NOT NULL CHECK (value > 0),
    position INT NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_formula_ingredients_formula ON formula_ingredients(formula_id);
CREATE INDEX IF NOT EXISTS idx_formula_ingredients_material ON formula_ingredients(raw_material_id);

-- Attach generic audit trigger
DROP TRIGGER IF EXISTS trg_formula_ingredients_audit ON formula_ingredients;
CREATE TRIGGER trg_formula_ingredients_audit
    AFTER INSERT OR UPDATE OR DELETE ON formula_ingredients
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_func();

-- 4. DB Trigger to Enforce Formula Immutability when Locked
CREATE OR REPLACE FUNCTION check_formula_lock()
RETURNS TRIGGER AS $$
DECLARE
    v_is_locked BOOLEAN;
BEGIN
    -- Check if parent formula is locked
    IF TG_TABLE_NAME = 'formulas' THEN
        -- If formula was already locked and an edit is attempted (other than un-locking, which is restricted)
        IF OLD.is_locked = true AND NEW.is_locked = true THEN
            -- Only allow updated_at or status changes to archived
            IF OLD.perfume_name != NEW.perfume_name OR OLD.code != NEW.code OR OLD.target_concentration != NEW.target_concentration THEN
                RAISE EXCEPTION 'Formula % (Version %) is locked and cannot be edited. Please create a new version (V+1).',
                    OLD.perfume_name, OLD.version_label;
            END IF;
        END IF;
        RETURN NEW;
    ELSIF TG_TABLE_NAME = 'formula_ingredients' THEN
        SELECT is_locked INTO v_is_locked
        FROM formulas
        WHERE id = COALESCE(NEW.formula_id, OLD.formula_id);

        IF v_is_locked = true THEN
            RAISE EXCEPTION 'Cannot modify ingredients of a locked formula. Please create a new version (V+1).';
        END IF;
        RETURN COALESCE(NEW, OLD);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_formula_lock ON formulas;
CREATE TRIGGER trg_check_formula_lock
    BEFORE UPDATE ON formulas
    FOR EACH ROW
    EXECUTE FUNCTION check_formula_lock();

DROP TRIGGER IF EXISTS trg_check_ingredient_lock ON formula_ingredients;
CREATE TRIGGER trg_check_ingredient_lock
    BEFORE INSERT OR UPDATE OR DELETE ON formula_ingredients
    FOR EACH ROW
    EXECUTE FUNCTION check_formula_lock();

-- 5. Row Level Security
ALTER TABLE formulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE formula_ingredients ENABLE ROW LEVEL SECURITY;

-- Read policies: Production managers, Admin, and Inventory managers can read formulas
CREATE POLICY "Allow read formulas" ON formulas
    FOR SELECT TO authenticated
    USING (deleted_at IS NULL AND auth_role() IN ('admin', 'production_manager', 'inventory_manager'));

CREATE POLICY "Allow read formula_ingredients" ON formula_ingredients
    FOR SELECT TO authenticated
    USING (auth_role() IN ('admin', 'production_manager', 'inventory_manager'));

-- Write policies: Production Manager and Admin only
CREATE POLICY "Manage formulas" ON formulas
    FOR ALL TO authenticated
    USING (auth_role() IN ('admin', 'production_manager'))
    WITH CHECK (auth_role() IN ('admin', 'production_manager'));

CREATE POLICY "Manage formula_ingredients" ON formula_ingredients
    FOR ALL TO authenticated
    USING (auth_role() IN ('admin', 'production_manager'))
    WITH CHECK (auth_role() IN ('admin', 'production_manager'));

-- 6. DB Function: scale_formula(p_formula_id, p_total_ml)
CREATE OR REPLACE FUNCTION scale_formula(
    p_formula_id UUID,
    p_total_ml NUMERIC(18, 4)
)
RETURNS JSONB AS $$
DECLARE
    v_formula RECORD;
    v_item RECORD;
    v_fixed_total NUMERIC(18, 4) := 0;
    v_percent_total NUMERIC(18, 4) := 0;
    v_remaining_ml NUMERIC(18, 4);
    v_req_qty NUMERIC(18, 4);
    v_shortage NUMERIC(18, 4);
    v_line_cost NUMERIC(18, 4);
    v_total_cost NUMERIC(18, 4) := 0;
    v_is_fulfillable BOOLEAN := true;
    v_items JSONB := '[]'::jsonb;
    v_item_obj JSONB;
BEGIN
    SELECT * INTO v_formula FROM formulas WHERE id = p_formula_id AND deleted_at IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Formula with ID % not found.', p_formula_id;
    END IF;

    IF p_total_ml <= 0 THEN
        RAISE EXCEPTION 'Target volume must be greater than zero.';
    END IF;

    -- Calculate fixed vs percentage totals
    FOR v_item IN
        SELECT fi.*, rm.name as rm_name, rm.sku as rm_sku, rm.category as rm_category,
               rm.base_unit, rm.current_stock, rm.cost_per_unit
        FROM formula_ingredients fi
        JOIN raw_materials rm ON rm.id = fi.raw_material_id
        WHERE fi.formula_id = p_formula_id
        ORDER BY fi.position ASC, fi.created_at ASC
    LOOP
        IF v_item.quantity_type = 'fixed_ml' THEN
            v_fixed_total := v_fixed_total + v_item.value;
        ELSIF v_item.quantity_type = 'percent' THEN
            v_percent_total := v_percent_total + v_item.value;
        END IF;
    END LOOP;

    -- Validation
    IF v_fixed_total > p_total_ml THEN
        RAISE EXCEPTION 'Total fixed ingredients (% ml) exceeds target batch volume (% ml).', v_fixed_total, p_total_ml;
    END IF;

    IF v_percent_total > 0 AND abs(v_percent_total - 100.0000) > 0.001 THEN
        RAISE EXCEPTION 'Formula percentage ingredients must sum to 100%% of remaining volume. Current sum: %%%', v_percent_total;
    END IF;

    v_remaining_ml := p_total_ml - v_fixed_total;

    -- Scale each ingredient
    FOR v_item IN
        SELECT fi.*, rm.name as rm_name, rm.sku as rm_sku, rm.category as rm_category,
               rm.base_unit, rm.current_stock, rm.cost_per_unit
        FROM formula_ingredients fi
        JOIN raw_materials rm ON rm.id = fi.raw_material_id
        WHERE fi.formula_id = p_formula_id
        ORDER BY fi.position ASC, fi.created_at ASC
    LOOP
        IF v_item.quantity_type = 'fixed_ml' THEN
            v_req_qty := ROUND(v_item.value, 4);
        ELSE
            v_req_qty := ROUND(v_remaining_ml * (v_item.value / 100.0000), 4);
        END IF;

        IF v_item.current_stock < v_req_qty THEN
            v_shortage := ROUND(v_req_qty - v_item.current_stock, 4);
            v_is_fulfillable := false;
        ELSE
            v_shortage := 0.0000;
        END IF;

        v_line_cost := ROUND(v_req_qty * v_item.cost_per_unit, 4);
        v_total_cost := v_total_cost + v_line_cost;

        v_item_obj := jsonb_build_object(
            'ingredient_id', v_item.id,
            'raw_material_id', v_item.raw_material_id,
            'name', v_item.rm_name,
            'sku', v_item.rm_sku,
            'category', v_item.rm_category,
            'base_unit', v_item.base_unit,
            'quantity_type', v_item.quantity_type,
            'formula_value', v_item.value,
            'required_quantity', v_req_qty,
            'available_stock', v_item.current_stock,
            'shortage', v_shortage,
            'unit_cost', v_item.cost_per_unit,
            'line_cost', v_line_cost
        );

        v_items := v_items || v_item_obj;
    END LOOP;

    RETURN jsonb_build_object(
        'formula_id', v_formula.id,
        'perfume_name', v_formula.perfume_name,
        'version_label', v_formula.version_label,
        'target_total_ml', p_total_ml,
        'fixed_ml_total', v_fixed_total,
        'remaining_ml', v_remaining_ml,
        'is_fulfillable', v_is_fulfillable,
        'estimated_total_cost', v_total_cost,
        'cost_per_ml', CASE WHEN p_total_ml > 0 THEN ROUND(v_total_cost / p_total_ml, 4) ELSE 0 END,
        'ingredients', v_items
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
