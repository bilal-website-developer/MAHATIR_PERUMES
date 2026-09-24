-- ==============================================================================
-- Mahatir Perfumes ERP - Migration 000007: POS Sales System
-- ==============================================================================

-- 1. Enums
DO $$ BEGIN
    CREATE TYPE sale_status AS ENUM ('completed', 'voided', 'refunded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE sale_item_type AS ENUM ('bottled', 'decant');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM ('cash', 'card', 'bank_transfer', 'split');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    notes TEXT,
    loyalty_points NUMERIC(18, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_customers_branch ON customers(branch_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- 3. Sales Invoices Table
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    invoice_number VARCHAR(100) NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    cashier_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status sale_status NOT NULL DEFAULT 'completed',
    subtotal NUMERIC(18, 4) NOT NULL CHECK (subtotal >= 0),
    discount_amount NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    tax_amount NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    total_amount NUMERIC(18, 4) NOT NULL CHECK (total_amount >= 0),
    payment_method payment_method NOT NULL DEFAULT 'cash',
    payment_status VARCHAR(50) NOT NULL DEFAULT 'paid',
    notes TEXT,
    void_reason TEXT,
    voided_at TIMESTAMPTZ,
    voided_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_sales_invoice UNIQUE (branch_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_sales_branch ON sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);

-- 4. Sales Items Table (Bottled SKUs or Decant Bulk Liquid)
CREATE TABLE IF NOT EXISTS sales_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    item_type sale_item_type NOT NULL DEFAULT 'bottled',
    variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
    batch_id UUID REFERENCES batches(id) ON DELETE RESTRICT,
    lot_id UUID REFERENCES finished_goods_lots(id) ON DELETE RESTRICT,
    item_name VARCHAR(255) NOT NULL,
    quantity NUMERIC(18, 4) NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(18, 4) NOT NULL CHECK (unit_price >= 0),
    unit_cost_snapshot NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (unit_cost_snapshot >= 0),
    line_subtotal NUMERIC(18, 4) NOT NULL CHECK (line_subtotal >= 0),
    line_discount NUMERIC(18, 4) NOT NULL DEFAULT 0,
    line_total NUMERIC(18, 4) NOT NULL CHECK (line_total >= 0),
    profit NUMERIC(18, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_items_sale ON sales_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_items_variant ON sales_items(variant_id);
CREATE INDEX IF NOT EXISTS idx_sales_items_batch ON sales_items(batch_id);

-- 5. Payments Table (Supports split payments)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    payment_method payment_method NOT NULL,
    amount NUMERIC(18, 4) NOT NULL CHECK (amount > 0),
    reference_code VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(sale_id);

-- 6. Attach Triggers
CREATE TRIGGER trg_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_sales_updated_at
    BEFORE UPDATE ON sales
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Attach Audit Log Triggers
CREATE TRIGGER trg_audit_customers
    AFTER INSERT OR UPDATE OR DELETE ON customers
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER trg_audit_sales
    AFTER INSERT OR UPDATE OR DELETE ON sales
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER trg_audit_sales_items
    AFTER INSERT OR UPDATE OR DELETE ON sales_items
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER trg_audit_payments
    AFTER INSERT OR UPDATE OR DELETE ON payments
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- 7. Enable Row-Level Security
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read customers" ON customers FOR SELECT USING (true);
CREATE POLICY "Manage customers" ON customers FOR ALL USING (
    has_role(ARRAY['admin'::user_role, 'sales_staff'::user_role, 'production_manager'::user_role, 'inventory_manager'::user_role])
);

CREATE POLICY "Read sales" ON sales FOR SELECT USING (true);
CREATE POLICY "Create sales" ON sales FOR INSERT WITH CHECK (
    has_role(ARRAY['admin'::user_role, 'sales_staff'::user_role])
);
CREATE POLICY "Manage sales" ON sales FOR UPDATE USING (
    has_role(ARRAY['admin'::user_role])
);

CREATE POLICY "Read sales_items" ON sales_items FOR SELECT USING (true);
CREATE POLICY "Insert sales_items" ON sales_items FOR INSERT WITH CHECK (
    has_role(ARRAY['admin'::user_role, 'sales_staff'::user_role])
);

CREATE POLICY "Read payments" ON payments FOR SELECT USING (true);
CREATE POLICY "Insert payments" ON payments FOR INSERT WITH CHECK (
    has_role(ARRAY['admin'::user_role, 'sales_staff'::user_role])
);

-- ==============================================================================
-- 8. Atomic POS Sale RPC: create_sale
-- ==============================================================================
CREATE OR REPLACE FUNCTION create_sale(
    p_branch_id UUID,
    p_customer_id UUID,
    p_cashier_id UUID,
    p_items JSONB,
    p_payments JSONB,
    p_discount_amount NUMERIC,
    p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sale_id UUID;
    v_invoice_num VARCHAR(100);
    v_count INT;
    v_subtotal NUMERIC(18, 4) := 0;
    v_total NUMERIC(18, 4);
    v_item RECORD;
    v_lot RECORD;
    v_batch RECORD;
    v_variant RECORD;
    v_qty NUMERIC(18, 4);
    v_unit_price NUMERIC(18, 4);
    v_line_subtotal NUMERIC(18, 4);
    v_line_discount NUMERIC(18, 4);
    v_line_total NUMERIC(18, 4);
    v_unit_cost NUMERIC(18, 4);
    v_profit NUMERIC(18, 4);
    v_pay RECORD;
    v_pay_total NUMERIC(18, 4) := 0;
BEGIN
    -- 1. Validate Payments
    FOR v_pay IN SELECT * FROM jsonb_to_recordset(p_payments) AS (
        payment_method TEXT,
        amount NUMERIC,
        reference_code TEXT
    ) LOOP
        v_pay_total := v_pay_total + v_pay.amount;
    END LOOP;

    -- 2. Generate Gapless Sequential Invoice Number
    SELECT COUNT(*) + 1 INTO v_count FROM sales WHERE branch_id = p_branch_id;
    v_invoice_num := 'INV-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(v_count::TEXT, 5, '0');

    -- 3. Insert Sale Header (placeholder subtotal and total, updated after items)
    INSERT INTO sales (
        branch_id, invoice_number, customer_id, cashier_id,
        status, subtotal, discount_amount, total_amount,
        notes
    ) VALUES (
        p_branch_id, v_invoice_num, p_customer_id, p_cashier_id,
        'completed', 0, COALESCE(p_discount_amount, 0), 0,
        p_notes
    ) RETURNING id INTO v_sale_id;

    -- 4. Process Each Item (Row locking prevents overselling)
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS (
        item_type TEXT,
        variant_id UUID,
        batch_id UUID,
        lot_id UUID,
        quantity NUMERIC,
        unit_price NUMERIC,
        line_discount NUMERIC
    ) LOOP
        v_qty := v_item.quantity;
        v_unit_price := v_item.unit_price;
        v_line_subtotal := ROUND(v_qty * v_unit_price, 4);
        v_line_discount := COALESCE(v_item.line_discount, 0);
        v_line_total := v_line_subtotal - v_line_discount;
        v_subtotal := v_subtotal + v_line_subtotal;

        IF v_item.item_type = 'bottled' THEN
            -- Check & Lock Finished Goods Lot
            SELECT fgl.*, pv.name AS var_name
            INTO v_lot
            FROM finished_goods_lots fgl
            JOIN product_variants pv ON pv.id = fgl.variant_id
            WHERE fgl.id = v_item.lot_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Finished goods lot with ID % not found.', v_item.lot_id;
            END IF;

            IF v_lot.current_quantity < v_qty THEN
                RAISE EXCEPTION 'Insufficient stock in lot %. Required: %, Available: %',
                    v_lot.lot_number, v_qty, v_lot.current_quantity;
            END IF;

            -- Deduct Lot Stock
            UPDATE finished_goods_lots
            SET current_quantity = current_quantity - v_qty,
                updated_at = NOW()
            WHERE id = v_lot.id;

            -- Deduct Variant Stock
            UPDATE product_variants
            SET current_stock = current_stock - v_qty,
                updated_at = NOW()
            WHERE id = v_lot.variant_id;

            v_unit_cost := v_lot.unit_cost;
            v_profit := v_line_total - (v_qty * v_unit_cost);

            INSERT INTO sales_items (
                sale_id, item_type, variant_id, batch_id, lot_id,
                item_name, quantity, unit_price, unit_cost_snapshot,
                line_subtotal, line_discount, line_total, profit
            ) VALUES (
                v_sale_id, 'bottled', v_lot.variant_id, v_lot.batch_id, v_lot.id,
                v_lot.var_name, v_qty, v_unit_price, v_unit_cost,
                v_line_subtotal, v_line_discount, v_line_total, v_profit
            );

        ELSIF v_item.item_type = 'decant' THEN
            -- Check & Lock Bulk Liquid Batch
            SELECT *
            INTO v_batch
            FROM batches
            WHERE id = v_item.batch_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Batch with ID % not found for decant dispensing.', v_item.batch_id;
            END IF;

            IF v_batch.remaining_volume < v_qty THEN
                RAISE EXCEPTION 'Insufficient bulk liquid in batch %. Required: % ml, Available: % ml',
                    v_batch.batch_code, v_qty, v_batch.remaining_volume;
            END IF;

            -- Deduct Bulk Liquid from batch & bulk_inventory
            UPDATE batches
            SET remaining_volume = remaining_volume - v_qty,
                updated_at = NOW()
            WHERE id = v_batch.id;

            UPDATE bulk_inventory
            SET current_volume = current_volume - v_qty,
                status = CASE WHEN current_volume - v_qty = 0 THEN 'consumed' ELSE 'available' END,
                updated_at = NOW()
            WHERE batch_id = v_batch.id;

            v_unit_cost := v_batch.cost_per_ml;
            v_profit := v_line_total - (v_qty * v_unit_cost);

            INSERT INTO sales_items (
                sale_id, item_type, batch_id,
                item_name, quantity, unit_price, unit_cost_snapshot,
                line_subtotal, line_discount, line_total, profit
            ) VALUES (
                v_sale_id, 'decant', v_batch.id,
                v_batch.perfume_name || ' (Decant ' || v_qty || ' ml)', v_qty, v_unit_price, v_unit_cost,
                v_line_subtotal, v_line_discount, v_line_total, v_profit
            );
        END IF;
    END LOOP;

    -- 5. Calculate Final Total & Update Sale Header
    v_total := v_subtotal - COALESCE(p_discount_amount, 0);

    UPDATE sales
    SET subtotal = v_subtotal,
        total_amount = v_total
    WHERE id = v_sale_id;

    -- 6. Insert Payments
    FOR v_pay IN SELECT * FROM jsonb_to_recordset(p_payments) AS (
        payment_method TEXT,
        amount NUMERIC,
        reference_code TEXT
    ) LOOP
        INSERT INTO payments (
            sale_id, payment_method, amount, reference_code
        ) VALUES (
            v_sale_id, v_pay.payment_method::payment_method, v_pay.amount, v_pay.reference_code
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'sale_id', v_sale_id,
        'invoice_number', v_invoice_num,
        'subtotal', v_subtotal,
        'total_amount', v_total
    );
END;
$$;
