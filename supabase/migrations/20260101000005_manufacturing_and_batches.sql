-- 20260101000005_manufacturing_and_batches.sql
-- Mahatir Perfumes ERP + POS: Manufacturing Batches, Bulk Inventory & Loss Tracking

-- 1. Create Enums if not exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'batch_status') THEN
        CREATE TYPE batch_status AS ENUM (
            'draft',
            'bulk',
            'partial_bottled',
            'completed',
            'reversed'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'loss_reason_type') THEN
        CREATE TYPE loss_reason_type AS ENUM (
            'evaporation',
            'spillage',
            'testing',
            'filtration',
            'other'
        );
    END IF;
END $$;

-- 2. Batches Table
CREATE TABLE IF NOT EXISTS batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT DEFAULT '00000000-0000-0000-0000-000000000001',
    batch_code TEXT NOT NULL UNIQUE,
    perfume_name TEXT NOT NULL,
    formula_id UUID NOT NULL REFERENCES formulas(id) ON DELETE RESTRICT,
    formula_version INT NOT NULL,
    formula_version_label TEXT NOT NULL,
    production_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expected_volume NUMERIC(18, 4) NOT NULL CHECK (expected_volume > 0),
    actual_volume NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (actual_volume >= 0),
    remaining_volume NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (remaining_volume >= 0),
    total_cost NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (total_cost >= 0),
    cost_per_ml NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (cost_per_ml >= 0),
    loss_percent NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (loss_percent >= 0),
    loss_volume NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (loss_volume >= 0),
    status batch_status NOT NULL DEFAULT 'draft',
    notes TEXT,
    reversal_reason TEXT,
    reversed_at TIMESTAMPTZ,
    reversed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status);
CREATE INDEX IF NOT EXISTS idx_batches_formula ON batches(formula_id);
CREATE INDEX IF NOT EXISTS idx_batches_created_at ON batches(created_at DESC);

-- Attach updated_at trigger
DROP TRIGGER IF EXISTS trg_batches_updated_at ON batches;
CREATE TRIGGER trg_batches_updated_at
    BEFORE UPDATE ON batches
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Attach generic audit trigger
DROP TRIGGER IF EXISTS trg_batches_audit ON batches;
CREATE TRIGGER trg_batches_audit
    AFTER INSERT OR UPDATE OR DELETE ON batches
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_func();

-- 3. Batch Usage Table (Snapshots of raw materials consumed)
CREATE TABLE IF NOT EXISTS batch_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    raw_material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE RESTRICT,
    quantity_used NUMERIC(18, 4) NOT NULL CHECK (quantity_used > 0),
    unit TEXT NOT NULL,
    unit_cost_snapshot NUMERIC(18, 4) NOT NULL CHECK (unit_cost_snapshot >= 0),
    line_cost NUMERIC(18, 4) NOT NULL CHECK (line_cost >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batch_usage_batch ON batch_usage(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_usage_material ON batch_usage(raw_material_id);

-- Attach audit trigger
DROP TRIGGER IF EXISTS trg_batch_usage_audit ON batch_usage;
CREATE TRIGGER trg_batch_usage_audit
    AFTER INSERT OR UPDATE OR DELETE ON batch_usage
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_func();

-- 4. Batch Losses Table
CREATE TABLE IF NOT EXISTS batch_losses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    reason_type loss_reason_type NOT NULL,
    volume_ml NUMERIC(18, 4) NOT NULL CHECK (volume_ml > 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batch_losses_batch ON batch_losses(batch_id);

-- Attach audit trigger
DROP TRIGGER IF EXISTS trg_batch_losses_audit ON batch_losses;
CREATE TRIGGER trg_batch_losses_audit
    AFTER INSERT OR UPDATE OR DELETE ON batch_losses
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_func();

-- 5. Bulk Inventory Table
CREATE TABLE IF NOT EXISTS bulk_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT DEFAULT '00000000-0000-0000-0000-000000000001',
    batch_id UUID NOT NULL UNIQUE REFERENCES batches(id) ON DELETE RESTRICT,
    perfume_name TEXT NOT NULL,
    initial_volume NUMERIC(18, 4) NOT NULL CHECK (initial_volume > 0),
    current_volume NUMERIC(18, 4) NOT NULL CHECK (current_volume >= 0),
    cost_per_ml NUMERIC(18, 4) NOT NULL CHECK (cost_per_ml >= 0),
    status TEXT NOT NULL DEFAULT 'available',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bulk_inventory_batch ON bulk_inventory(batch_id);
CREATE INDEX IF NOT EXISTS idx_bulk_inventory_current_volume ON bulk_inventory(current_volume);

-- Attach updated_at & audit triggers
DROP TRIGGER IF EXISTS trg_bulk_inventory_updated_at ON bulk_inventory;
CREATE TRIGGER trg_bulk_inventory_updated_at
    BEFORE UPDATE ON bulk_inventory
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_bulk_inventory_audit ON bulk_inventory;
CREATE TRIGGER trg_bulk_inventory_audit
    AFTER INSERT OR UPDATE OR DELETE ON bulk_inventory
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_func();

-- 6. Row Level Security
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_losses ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read batches" ON batches
    FOR SELECT TO authenticated
    USING (auth_role() IN ('admin', 'production_manager', 'inventory_manager'));

CREATE POLICY "Manage batches" ON batches
    FOR ALL TO authenticated
    USING (auth_role() IN ('admin', 'production_manager'))
    WITH CHECK (auth_role() IN ('admin', 'production_manager'));

CREATE POLICY "Allow read batch_usage" ON batch_usage
    FOR SELECT TO authenticated
    USING (auth_role() IN ('admin', 'production_manager', 'inventory_manager'));

CREATE POLICY "Manage batch_usage" ON batch_usage
    FOR ALL TO authenticated
    USING (auth_role() IN ('admin', 'production_manager'))
    WITH CHECK (auth_role() IN ('admin', 'production_manager'));

CREATE POLICY "Allow read batch_losses" ON batch_losses
    FOR SELECT TO authenticated
    USING (auth_role() IN ('admin', 'production_manager', 'inventory_manager'));

CREATE POLICY "Manage batch_losses" ON batch_losses
    FOR ALL TO authenticated
    USING (auth_role() IN ('admin', 'production_manager'))
    WITH CHECK (auth_role() IN ('admin', 'production_manager'));

CREATE POLICY "Allow read bulk_inventory" ON bulk_inventory
    FOR SELECT TO authenticated
    USING (auth_role() IN ('admin', 'production_manager', 'inventory_manager', 'sales_staff'));

CREATE POLICY "Manage bulk_inventory" ON bulk_inventory
    FOR ALL TO authenticated
    USING (auth_role() IN ('admin', 'production_manager'))
    WITH CHECK (auth_role() IN ('admin', 'production_manager'));

-- 7. Database Function: confirm_batch(...)
-- Atomically checks stock, deducts raw materials via stock_movements, snapshots costs,
-- records losses, creates bulk liquid inventory, and locks the formula.
CREATE OR REPLACE FUNCTION confirm_batch(
    p_batch_id UUID,
    p_actual_volume NUMERIC(18, 4),
    p_loss_reason TEXT,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_batch RECORD;
    v_formula RECORD;
    v_item RECORD;
    v_rm RECORD;
    v_req_qty NUMERIC(18, 4);
    v_line_cost NUMERIC(18, 4);
    v_total_cost NUMERIC(18, 4) := 0;
    v_cost_per_ml NUMERIC(18, 4);
    v_loss_vol NUMERIC(18, 4) := 0;
    v_loss_pct NUMERIC(18, 4) := 0;
    v_remaining_ml NUMERIC(18, 4);
    v_fixed_total NUMERIC(18, 4) := 0;
BEGIN
    -- 1. Lock batch record
    SELECT * INTO v_batch FROM batches WHERE id = p_batch_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Batch with ID % not found.', p_batch_id;
    END IF;

    IF v_batch.status != 'draft' THEN
        RAISE EXCEPTION 'Batch % cannot be confirmed because status is %, not draft.', v_batch.batch_code, v_batch.status;
    END IF;

    IF p_actual_volume <= 0 THEN
        RAISE EXCEPTION 'Actual volume produced must be greater than zero.';
    END IF;

    IF p_actual_volume > v_batch.expected_volume THEN
        RAISE EXCEPTION 'Actual volume (% ml) cannot exceed expected batch volume (% ml).', p_actual_volume, v_batch.expected_volume;
    END IF;

    -- Calculate loss
    IF p_actual_volume < v_batch.expected_volume THEN
        v_loss_vol := v_batch.expected_volume - p_actual_volume;
        v_loss_pct := ROUND((v_loss_vol / v_batch.expected_volume) * 100, 4);
        IF p_loss_reason IS NULL OR length(trim(p_loss_reason)) = 0 THEN
            RAISE EXCEPTION 'Loss detected (% ml / %%%). A mandatory loss reason must be provided.', v_loss_vol, v_loss_pct;
        END IF;
    END IF;

    -- 2. Fetch formula
    SELECT * INTO v_formula FROM formulas WHERE id = v_batch.formula_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Formula for batch % not found.', v_batch.batch_code;
    END IF;

    -- Calculate fixed total
    SELECT COALESCE(SUM(value), 0) INTO v_fixed_total
    FROM formula_ingredients
    WHERE formula_id = v_batch.formula_id AND quantity_type = 'fixed_ml';

    v_remaining_ml := v_batch.expected_volume - v_fixed_total;

    -- 3. Stock availability verification step (ALL or NOTHING)
    FOR v_item IN
        SELECT fi.*, rm.name as rm_name, rm.current_stock
        FROM formula_ingredients fi
        JOIN raw_materials rm ON rm.id = fi.raw_material_id
        WHERE fi.formula_id = v_batch.formula_id
    LOOP
        IF v_item.quantity_type = 'fixed_ml' THEN
            v_req_qty := v_item.value;
        ELSE
            v_req_qty := ROUND(v_remaining_ml * (v_item.value / 100.0000), 4);
        END IF;

        IF v_item.current_stock < v_req_qty THEN
            RAISE EXCEPTION 'Insufficient stock for %: need % %, available % %.',
                v_item.rm_name, v_req_qty, 'base units', v_item.current_stock, 'base units';
        END IF;
    END LOOP;

    -- 4. Deduction step: Deduct materials, record stock movements and snapshot costs
    FOR v_item IN
        SELECT fi.*, rm.name as rm_name, rm.base_unit, rm.cost_per_unit
        FROM formula_ingredients fi
        JOIN raw_materials rm ON rm.id = fi.raw_material_id
        WHERE fi.formula_id = v_batch.formula_id
    LOOP
        -- Lock raw material
        SELECT * INTO v_rm FROM raw_materials WHERE id = v_item.raw_material_id FOR UPDATE;

        IF v_item.quantity_type = 'fixed_ml' THEN
            v_req_qty := v_item.value;
        ELSE
            v_req_qty := ROUND(v_remaining_ml * (v_item.value / 100.0000), 4);
        END IF;

        v_line_cost := ROUND(v_req_qty * v_rm.cost_per_unit, 4);
        v_total_cost := v_total_cost + v_line_cost;

        -- Update raw material balance
        UPDATE raw_materials
        SET current_stock = current_stock - v_req_qty,
            updated_at = NOW()
        WHERE id = v_item.raw_material_id;

        -- Record ledger movement (Negative for consumption)
        INSERT INTO stock_movements (
            branch_id,
            item_type,
            item_id,
            quantity,
            unit,
            unit_cost,
            total_cost,
            reference_type,
            reference_id,
            reason,
            user_id
        ) VALUES (
            v_batch.branch_id,
            'raw_material',
            v_item.raw_material_id,
            -v_req_qty,
            v_rm.base_unit,
            v_rm.cost_per_unit,
            v_line_cost,
            'batch_consumption',
            p_batch_id,
            'Batch manufacturing: ' || v_batch.batch_code,
            p_user_id
        );

        -- Record batch usage snapshot
        INSERT INTO batch_usage (
            batch_id,
            raw_material_id,
            quantity_used,
            unit,
            unit_cost_snapshot,
            line_cost
        ) VALUES (
            p_batch_id,
            v_item.raw_material_id,
            v_req_qty,
            v_rm.base_unit,
            v_rm.cost_per_unit,
            v_line_cost
        );
    END LOOP;

    -- 5. Cost per ml = Total Cost / Actual Volume (losses raise the cost per ml!)
    v_cost_per_ml := ROUND(v_total_cost / p_actual_volume, 4);

    -- 6. Record batch loss if applicable
    IF v_loss_vol > 0 THEN
        INSERT INTO batch_losses (
            batch_id,
            reason_type,
            volume_ml,
            notes
        ) VALUES (
            p_batch_id,
            'evaporation',
            v_loss_vol,
            trim(p_loss_reason)
        );
    END IF;

    -- 7. Update batch record
    UPDATE batches
    SET actual_volume = p_actual_volume,
        remaining_volume = p_actual_volume,
        total_cost = v_total_cost,
        cost_per_ml = v_cost_per_ml,
        loss_percent = v_loss_pct,
        loss_volume = v_loss_vol,
        status = 'bulk',
        production_date = NOW(),
        updated_at = NOW()
    WHERE id = p_batch_id;

    -- 8. Create bulk inventory record
    INSERT INTO bulk_inventory (
        branch_id,
        batch_id,
        perfume_name,
        initial_volume,
        current_volume,
        cost_per_ml,
        status
    ) VALUES (
        v_batch.branch_id,
        p_batch_id,
        v_batch.perfume_name,
        p_actual_volume,
        p_actual_volume,
        v_cost_per_ml,
        'available'
    )
    ON CONFLICT (batch_id) DO UPDATE SET
        current_volume = EXCLUDED.current_volume,
        cost_per_ml = EXCLUDED.cost_per_ml,
        updated_at = NOW();

    -- 9. Auto-lock the formula
    UPDATE formulas
    SET is_locked = true,
        locked_reason = 'Locked upon commercial batch production ' || v_batch.batch_code,
        locked_at = NOW(),
        updated_at = NOW()
    WHERE id = v_batch.formula_id AND is_locked = false;

    RETURN jsonb_build_object(
        'success', true,
        'batch_id', p_batch_id,
        'batch_code', v_batch.batch_code,
        'actual_volume', p_actual_volume,
        'total_cost', v_total_cost,
        'cost_per_ml', v_cost_per_ml,
        'loss_volume', v_loss_vol,
        'loss_percent', v_loss_pct,
        'status', 'bulk'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Database Function: reverse_batch(...)
-- Atomic reversal: restores raw materials to warehouse stock, records compensating ledger movements,
-- removes bulk liquid and marks batch as reversed.
CREATE OR REPLACE FUNCTION reverse_batch(
    p_batch_id UUID,
    p_reason TEXT,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_batch RECORD;
    v_usage RECORD;
    v_bulk RECORD;
BEGIN
    IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
        RAISE EXCEPTION 'A mandatory audit reason is required to reverse a confirmed batch.';
    END IF;

    SELECT * INTO v_batch FROM batches WHERE id = p_batch_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Batch with ID % not found.', p_batch_id;
    END IF;

    IF v_batch.status = 'reversed' THEN
        RAISE EXCEPTION 'Batch % is already reversed.', v_batch.batch_code;
    END IF;

    IF v_batch.status != 'bulk' THEN
        RAISE EXCEPTION 'Cannot reverse batch % in status %. Only un-bottled bulk batches can be reversed.',
            v_batch.batch_code, v_batch.status;
    END IF;

    -- Verify bulk inventory hasn't been partially consumed
    SELECT * INTO v_bulk FROM bulk_inventory WHERE batch_id = p_batch_id;
    IF FOUND AND v_bulk.current_volume < v_bulk.initial_volume THEN
        RAISE EXCEPTION 'Cannot reverse batch %: % ml of bulk liquid has already been bottled or decanted.',
            v_batch.batch_code, (v_bulk.initial_volume - v_bulk.current_volume);
    END IF;

    -- Re-credit each consumed material
    FOR v_usage IN SELECT * FROM batch_usage WHERE batch_id = p_batch_id LOOP
        UPDATE raw_materials
        SET current_stock = current_stock + v_usage.quantity_used,
            updated_at = NOW()
        WHERE id = v_usage.raw_material_id;

        -- Record compensating ledger movement
        INSERT INTO stock_movements (
            branch_id,
            item_type,
            item_id,
            quantity,
            unit,
            unit_cost,
            total_cost,
            reference_type,
            reference_id,
            reason,
            user_id
        ) VALUES (
            v_batch.branch_id,
            'raw_material',
            v_usage.raw_material_id,
            v_usage.quantity_used,
            v_usage.unit,
            v_usage.unit_cost_snapshot,
            v_usage.line_cost,
            'return',
            p_batch_id,
            'Batch reversal: ' || v_batch.batch_code || ' - Reason: ' || trim(p_reason),
            p_user_id
        );
    END LOOP;

    -- Update batch status
    UPDATE batches
    SET status = 'reversed',
        reversal_reason = trim(p_reason),
        reversed_at = NOW(),
        reversed_by = p_user_id,
        remaining_volume = 0,
        updated_at = NOW()
    WHERE id = p_batch_id;

    -- Remove or mark bulk inventory as depleted
    UPDATE bulk_inventory
    SET current_volume = 0,
        status = 'reversed',
        updated_at = NOW()
    WHERE batch_id = p_batch_id;

    RETURN jsonb_build_object(
        'success', true,
        'batch_id', p_batch_id,
        'batch_code', v_batch.batch_code,
        'status', 'reversed',
        'reason', trim(p_reason)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
