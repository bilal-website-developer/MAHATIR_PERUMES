-- 20260101000003_raw_materials_and_purchasing.sql
-- Mahatir Perfumes ERP + POS: Raw Materials, Units, Suppliers, Purchase Orders & Stock Ledger

-- 1. Create Enums if not exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'raw_material_category') THEN
        CREATE TYPE raw_material_category AS ENUM (
            'oil',
            'alcohol',
            'fixative',
            'packaging'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'po_status') THEN
        CREATE TYPE po_status AS ENUM (
            'draft',
            'pending_approval',
            'approved',
            'rejected',
            'received',
            'cancelled'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_movement_type') THEN
        CREATE TYPE stock_movement_type AS ENUM (
            'purchase_receive',
            'stock_adjustment',
            'batch_consumption',
            'bottling_consumption',
            'sale',
            'return',
            'transfer'
        );
    END IF;
END $$;

-- 2. Standard Units and Unit Conversions
CREATE TABLE IF NOT EXISTS units (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('volume', 'weight', 'count')),
    is_base BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed standard units
INSERT INTO units (code, name, symbol, category, is_base) VALUES
    ('ml', 'Millilitre', 'ml', 'volume', true),
    ('l', 'Litre', 'L', 'volume', false),
    ('g', 'Gram', 'g', 'weight', true),
    ('kg', 'Kilogram', 'kg', 'weight', false),
    ('pcs', 'Pieces / Units', 'pcs', 'count', true)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS unit_conversions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_unit TEXT NOT NULL REFERENCES units(code) ON DELETE RESTRICT,
    to_unit TEXT NOT NULL REFERENCES units(code) ON DELETE RESTRICT,
    multiplier NUMERIC(18, 4) NOT NULL CHECK (multiplier > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_unit_conversion UNIQUE (from_unit, to_unit)
);

INSERT INTO unit_conversions (from_unit, to_unit, multiplier) VALUES
    ('l', 'ml', 1000.0000),
    ('ml', 'l', 0.0010),
    ('kg', 'g', 1000.0000),
    ('g', 'kg', 0.0010)
ON CONFLICT (from_unit, to_unit) DO UPDATE SET multiplier = EXCLUDED.multiplier;

-- 3. Raw Materials Table
CREATE TABLE IF NOT EXISTS raw_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT DEFAULT '00000000-0000-0000-0000-000000000001',
    name TEXT NOT NULL,
    sku TEXT NOT NULL,
    category raw_material_category NOT NULL,
    base_unit TEXT NOT NULL REFERENCES units(code) ON DELETE RESTRICT,
    secondary_unit TEXT REFERENCES units(code) ON DELETE RESTRICT,
    conversion_rate NUMERIC(18, 4) NOT NULL DEFAULT 1.0000 CHECK (conversion_rate > 0),
    cost_per_unit NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (cost_per_unit >= 0),
    min_stock_level NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (min_stock_level >= 0),
    current_stock NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (current_stock >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_raw_materials_branch_sku UNIQUE (branch_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_raw_materials_category ON raw_materials(category);
CREATE INDEX IF NOT EXISTS idx_raw_materials_current_stock ON raw_materials(current_stock);
CREATE INDEX IF NOT EXISTS idx_raw_materials_active ON raw_materials(is_active);

-- Attach updated_at and audit triggers
DROP TRIGGER IF EXISTS trg_raw_materials_updated_at ON raw_materials;
CREATE TRIGGER trg_raw_materials_updated_at
    BEFORE UPDATE ON raw_materials
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_raw_materials_audit ON raw_materials;
CREATE TRIGGER trg_raw_materials_audit
    AFTER INSERT OR UPDATE OR DELETE ON raw_materials
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_func();

-- 4. Suppliers Table
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT DEFAULT '00000000-0000-0000-0000-000000000001',
    name TEXT NOT NULL,
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    payment_terms TEXT NOT NULL DEFAULT 'Net 30',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(is_active);

DROP TRIGGER IF EXISTS trg_suppliers_updated_at ON suppliers;
CREATE TRIGGER trg_suppliers_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_suppliers_audit ON suppliers;
CREATE TRIGGER trg_suppliers_audit
    AFTER INSERT OR UPDATE OR DELETE ON suppliers
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_func();

-- Link Table: Supplier Materials
CREATE TABLE IF NOT EXISTS supplier_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    raw_material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
    supplier_sku TEXT,
    last_price NUMERIC(18, 4) CHECK (last_price IS NULL OR last_price >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_supplier_material UNIQUE (supplier_id, raw_material_id)
);

DROP TRIGGER IF EXISTS trg_supplier_materials_updated_at ON supplier_materials;
CREATE TRIGGER trg_supplier_materials_updated_at
    BEFORE UPDATE ON supplier_materials
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_supplier_materials_audit ON supplier_materials;
CREATE TRIGGER trg_supplier_materials_audit
    AFTER INSERT OR UPDATE OR DELETE ON supplier_materials
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_func();

-- 5. Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT DEFAULT '00000000-0000-0000-0000-000000000001',
    po_number TEXT NOT NULL UNIQUE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    status po_status NOT NULL DEFAULT 'draft',
    total_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (total_amount >= 0),
    notes TEXT,
    rejection_reason TEXT,
    approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);

DROP TRIGGER IF EXISTS trg_purchase_orders_updated_at ON purchase_orders;
CREATE TRIGGER trg_purchase_orders_updated_at
    BEFORE UPDATE ON purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_purchase_orders_audit ON purchase_orders;
CREATE TRIGGER trg_purchase_orders_audit
    AFTER INSERT OR UPDATE OR DELETE ON purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_func();

-- 6. Purchase Order Items
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    raw_material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE RESTRICT,
    quantity NUMERIC(18, 4) NOT NULL CHECK (quantity > 0),
    unit TEXT NOT NULL REFERENCES units(code) ON DELETE RESTRICT,
    unit_cost NUMERIC(18, 4) NOT NULL CHECK (unit_cost >= 0),
    line_total NUMERIC(18, 4) NOT NULL CHECK (line_total >= 0),
    converted_quantity NUMERIC(18, 4) NOT NULL CHECK (converted_quantity > 0),
    converted_unit_cost NUMERIC(18, 4) NOT NULL CHECK (converted_unit_cost >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_items_po_id ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_items_material ON purchase_order_items(raw_material_id);

DROP TRIGGER IF EXISTS trg_purchase_order_items_audit ON purchase_order_items;
CREATE TRIGGER trg_purchase_order_items_audit
    AFTER INSERT OR UPDATE OR DELETE ON purchase_order_items
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_func();

-- 7. Stock Movements (The Append-Only Ledger)
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT DEFAULT '00000000-0000-0000-0000-000000000001',
    item_type TEXT NOT NULL DEFAULT 'raw_material',
    item_id UUID NOT NULL,
    quantity NUMERIC(18, 4) NOT NULL,
    unit TEXT NOT NULL REFERENCES units(code) ON DELETE RESTRICT,
    unit_cost NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (unit_cost >= 0),
    total_cost NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    reference_type stock_movement_type NOT NULL,
    reference_id UUID,
    reason TEXT,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON stock_movements(item_id, item_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at DESC);

-- Attach generic audit trigger
DROP TRIGGER IF EXISTS trg_stock_movements_audit ON stock_movements;
CREATE TRIGGER trg_stock_movements_audit
    AFTER INSERT OR UPDATE OR DELETE ON stock_movements
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_func();

-- 8. Row Level Security Policies
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Read policies: Authenticated users can view master data
CREATE POLICY "Allow read units" ON units FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read unit_conversions" ON unit_conversions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read raw_materials" ON raw_materials FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "Allow read suppliers" ON suppliers FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "Allow read supplier_materials" ON supplier_materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read purchase_orders" ON purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read purchase_order_items" ON purchase_order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read stock_movements" ON stock_movements FOR SELECT TO authenticated USING (true);

-- Write policies: Inventory Manager and Admin can manage materials & suppliers
CREATE POLICY "Manage raw_materials" ON raw_materials
    FOR ALL TO authenticated
    USING (auth_role() IN ('admin', 'inventory_manager'))
    WITH CHECK (auth_role() IN ('admin', 'inventory_manager'));

CREATE POLICY "Manage suppliers" ON suppliers
    FOR ALL TO authenticated
    USING (auth_role() IN ('admin', 'inventory_manager'))
    WITH CHECK (auth_role() IN ('admin', 'inventory_manager'));

CREATE POLICY "Manage supplier_materials" ON supplier_materials
    FOR ALL TO authenticated
    USING (auth_role() IN ('admin', 'inventory_manager'))
    WITH CHECK (auth_role() IN ('admin', 'inventory_manager'));

CREATE POLICY "Create purchase_orders" ON purchase_orders
    FOR INSERT TO authenticated
    WITH CHECK (auth_role() IN ('admin', 'inventory_manager'));

CREATE POLICY "Update purchase_orders" ON purchase_orders
    FOR UPDATE TO authenticated
    USING (auth_role() IN ('admin', 'inventory_manager'))
    WITH CHECK (auth_role() IN ('admin', 'inventory_manager'));

-- 9. PostgreSQL RPC Functions for Inventory Actions

-- Function: confirm_purchase(p_po_id, p_user_id)
CREATE OR REPLACE FUNCTION confirm_purchase(
    p_po_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_po RECORD;
    v_item RECORD;
    v_rm RECORD;
    v_new_stock NUMERIC(18, 4);
    v_new_wac NUMERIC(18, 4);
    v_items_processed INT := 0;
BEGIN
    -- 1. Lock and validate purchase order
    SELECT * INTO v_po
    FROM purchase_orders
    WHERE id = p_po_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Purchase order with ID % not found.', p_po_id;
    END IF;

    -- Idempotency check: double confirm rejection
    IF v_po.status = 'received' THEN
        RAISE EXCEPTION 'Purchase order % has already been confirmed and received.', v_po.po_number;
    END IF;

    IF v_po.status != 'approved' THEN
        RAISE EXCEPTION 'Purchase order % cannot be received because its status is %, not approved.', v_po.po_number, v_po.status;
    END IF;

    -- 2. Process each item in the purchase order
    FOR v_item IN
        SELECT poi.*, rm.name as material_name
        FROM purchase_order_items poi
        JOIN raw_materials rm ON rm.id = poi.raw_material_id
        WHERE poi.purchase_order_id = p_po_id
    LOOP
        -- Lock raw material for update
        SELECT * INTO v_rm
        FROM raw_materials
        WHERE id = v_item.raw_material_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Raw material % (ID: %) not found.', v_item.material_name, v_item.raw_material_id;
        END IF;

        -- Calculate weighted average cost (WAC)
        -- Formula: ((old_stock * old_cost) + (converted_qty * converted_cost)) / (old_stock + converted_qty)
        IF v_rm.current_stock <= 0 THEN
            v_new_wac := ROUND(v_item.converted_unit_cost, 4);
        ELSE
            v_new_wac := ROUND(
                ((v_rm.current_stock * v_rm.cost_per_unit) + (v_item.converted_quantity * v_item.converted_unit_cost))
                / (v_rm.current_stock + v_item.converted_quantity),
                4
            );
        END IF;

        v_new_stock := v_rm.current_stock + v_item.converted_quantity;

        -- Record ledger movement in stock_movements
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
            v_po.branch_id,
            'raw_material',
            v_item.raw_material_id,
            v_item.converted_quantity,
            v_rm.base_unit,
            v_item.converted_unit_cost,
            v_item.line_total,
            'purchase_receive',
            p_po_id,
            'PO confirmation: ' || v_po.po_number,
            p_user_id
        );

        -- Update raw material stock and weighted average cost atomically
        UPDATE raw_materials
        SET
            current_stock = v_new_stock,
            cost_per_unit = v_new_wac,
            updated_at = NOW()
        WHERE id = v_item.raw_material_id;

        v_items_processed := v_items_processed + 1;
    END LOOP;

    -- 3. Update PO status to received
    UPDATE purchase_orders
    SET
        status = 'received',
        received_at = NOW(),
        updated_at = NOW()
    WHERE id = p_po_id;

    RETURN jsonb_build_object(
        'success', true,
        'po_id', p_po_id,
        'po_number', v_po.po_number,
        'items_processed', v_items_processed,
        'status', 'received'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: adjust_stock(p_raw_material_id, p_delta, p_reason, p_user_id, p_branch_id)
CREATE OR REPLACE FUNCTION adjust_stock(
    p_raw_material_id UUID,
    p_delta NUMERIC(18, 4),
    p_reason TEXT,
    p_user_id UUID,
    p_branch_id UUID DEFAULT '00000000-0000-0000-0000-000000000001'
)
RETURNS JSONB AS $$
DECLARE
    v_rm RECORD;
    v_new_stock NUMERIC(18, 4);
BEGIN
    -- Mandatory reason validation
    IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
        RAISE EXCEPTION 'Stock adjustment requires a mandatory reason.';
    END IF;

    IF p_delta = 0 THEN
        RAISE EXCEPTION 'Stock adjustment delta cannot be zero.';
    END IF;

    -- Lock raw material
    SELECT * INTO v_rm
    FROM raw_materials
    WHERE id = p_raw_material_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Raw material with ID % not found.', p_raw_material_id;
    END IF;

    v_new_stock := v_rm.current_stock + p_delta;

    -- Negative stock prevention with precise feedback
    IF v_new_stock < 0 THEN
        RAISE EXCEPTION 'Insufficient stock for %: need % %, available % %.',
            v_rm.name,
            abs(p_delta),
            v_rm.base_unit,
            v_rm.current_stock,
            v_rm.base_unit;
    END IF;

    -- Record ledger movement
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
        COALESCE(p_branch_id, v_rm.branch_id),
        'raw_material',
        p_raw_material_id,
        p_delta,
        v_rm.base_unit,
        v_rm.cost_per_unit,
        ROUND(p_delta * v_rm.cost_per_unit, 4),
        'stock_adjustment',
        NULL,
        trim(p_reason),
        p_user_id
    );

    -- Update current_stock
    UPDATE raw_materials
    SET
        current_stock = v_new_stock,
        updated_at = NOW()
    WHERE id = p_raw_material_id;

    RETURN jsonb_build_object(
        'success', true,
        'material_id', p_raw_material_id,
        'material_name', v_rm.name,
        'previous_stock', v_rm.current_stock,
        'new_stock', v_new_stock,
        'delta', p_delta,
        'unit', v_rm.base_unit
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
