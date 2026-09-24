-- 20260101000000_initial_conventions.sql
-- Mahatir Perfumes ERP + POS: Initial Extensions, Triggers, and Audit Logging

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Standard updated_at Trigger Function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Audit Log Table
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    row_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')),
    old_data JSONB,
    new_data JSONB,
    user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast audit queries
CREATE INDEX IF NOT EXISTS idx_audit_log_table_row ON audit_log (table_name, row_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log (user_id);

-- Enable Row Level Security on audit_log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Temporary / Default select policy for audit_log (Admin access policy will be tightened in Phase 1)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'audit_log' AND policyname = 'Allow read audit log'
    ) THEN
        CREATE POLICY "Allow read audit log" ON audit_log
            FOR SELECT USING (true);
    END IF;
END $$;

-- 4. Generic Audit Trigger Function
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    audit_row_id UUID;
    acting_user_id UUID;
BEGIN
    -- Extract acting user from Supabase auth JWT claims if available
    BEGIN
        acting_user_id := NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
    EXCEPTION WHEN OTHERS THEN
        acting_user_id := NULL;
    END;

    IF (TG_OP = 'INSERT') THEN
        BEGIN
            audit_row_id := (to_jsonb(NEW) ->> 'id')::UUID;
        EXCEPTION WHEN OTHERS THEN
            audit_row_id := gen_random_uuid();
        END;

        INSERT INTO audit_log (table_name, row_id, action, old_data, new_data, user_id, created_at)
        VALUES (TG_TABLE_NAME::TEXT, audit_row_id, 'INSERT', NULL, to_jsonb(NEW), acting_user_id, NOW());
        RETURN NEW;

    ELSIF (TG_OP = 'UPDATE') THEN
        BEGIN
            audit_row_id := (to_jsonb(NEW) ->> 'id')::UUID;
        EXCEPTION WHEN OTHERS THEN
            audit_row_id := (to_jsonb(OLD) ->> 'id')::UUID;
        END;

        INSERT INTO audit_log (table_name, row_id, action, old_data, new_data, user_id, created_at)
        VALUES (TG_TABLE_NAME::TEXT, audit_row_id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), acting_user_id, NOW());
        RETURN NEW;

    ELSIF (TG_OP = 'DELETE') THEN
        BEGIN
            audit_row_id := (to_jsonb(OLD) ->> 'id')::UUID;
        EXCEPTION WHEN OTHERS THEN
            audit_row_id := gen_random_uuid();
        END;

        INSERT INTO audit_log (table_name, row_id, action, old_data, new_data, user_id, created_at)
        VALUES (TG_TABLE_NAME::TEXT, audit_row_id, 'DELETE', to_jsonb(OLD), NULL, acting_user_id, NOW());
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 20260101000001_branches_and_settings.sql
-- Mahatir Perfumes ERP + POS: Branches & App Settings Tables

-- 1. Branches Table (Multi-branch foundation)
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    address TEXT,
    phone TEXT,
    email TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Index for active branch lookup
CREATE INDEX IF NOT EXISTS idx_branches_active ON branches (is_active) WHERE deleted_at IS NULL;

-- Enable Row Level Security
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

-- Default select/modify policy for branches (Will be tightened in Phase 1)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'branches' AND policyname = 'Allow all access to branches') THEN
        CREATE POLICY "Allow all access to branches" ON branches FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Triggers for branches
DROP TRIGGER IF EXISTS trg_branches_updated_at ON branches;
CREATE TRIGGER trg_branches_updated_at
    BEFORE UPDATE ON branches
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_branches_audit ON branches;
CREATE TRIGGER trg_branches_audit
    AFTER INSERT OR UPDATE OR DELETE ON branches
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_func();

-- Seed Default Branch: Head Office & Flagship Boutique
INSERT INTO branches (id, name, code, address, phone, email, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Main Boutique & Lab',
    'MAIN-01',
    '100 Perfumer Way, Fragrance Boulevard',
    '+1 (555) 019-8822',
    'flagship@mahatirperfumes.com',
    true
)
ON CONFLICT (code) DO NOTHING;


-- 2. App Settings Table (Single-row configuration)
CREATE TABLE IF NOT EXISTS app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL DEFAULT 'Mahatir Perfumes',
    currency TEXT NOT NULL DEFAULT 'USD',
    currency_symbol TEXT NOT NULL DEFAULT '$',
    tax_percentage NUMERIC(6, 2) NOT NULL DEFAULT 0.00 CHECK (tax_percentage >= 0 AND tax_percentage <= 100),
    invoice_prefix TEXT NOT NULL DEFAULT 'MP-INV-',
    logo_url TEXT,
    contact_email TEXT DEFAULT 'contact@mahatirperfumes.com',
    phone TEXT DEFAULT '+1 (555) 019-8822',
    address TEXT DEFAULT '100 Perfumer Way, Fragrance Boulevard',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Default select/modify policy for app_settings
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_settings' AND policyname = 'Allow all access to app_settings') THEN
        CREATE POLICY "Allow all access to app_settings" ON app_settings FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Triggers for app_settings
DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON app_settings;
CREATE TRIGGER trg_app_settings_updated_at
    BEFORE UPDATE ON app_settings
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_app_settings_audit ON app_settings;
CREATE TRIGGER trg_app_settings_audit
    AFTER INSERT OR UPDATE OR DELETE ON app_settings
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_func();

-- Seed Default Settings
INSERT INTO app_settings (
    id,
    company_name,
    currency,
    currency_symbol,
    tax_percentage,
    invoice_prefix,
    logo_url,
    contact_email,
    phone,
    address
)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'Mahatir Perfumes',
    'USD',
    '$',
    5.00,
    'MP-INV-',
    NULL,
    'contact@mahatirperfumes.com',
    '+1 (555) 019-8822',
    '100 Perfumer Way, Fragrance Boulevard'
)
ON CONFLICT (id) DO NOTHING;


-- 20260101000002_auth_roles_and_profiles.sql
-- Mahatir Perfumes ERP + POS: Roles, Profiles, RLS, and Permissions

-- 1. Role Enum Definition
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM (
            'admin',
            'production_manager',
            'sales_staff',
            'inventory_manager'
        );
    END IF;
END $$;

-- 2. Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'sales_staff',
    branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT DEFAULT '00000000-0000-0000-0000-000000000001',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Index on email and role
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles (email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_branch ON profiles (branch_id);

-- Attach updated_at trigger
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Attach generic audit trigger
DROP TRIGGER IF EXISTS trg_profiles_audit ON profiles;
CREATE TRIGGER trg_profiles_audit
    AFTER INSERT OR UPDATE OR DELETE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_func();

-- 3. Security Definer Helper: auth_role()
CREATE OR REPLACE FUNCTION auth_role()
RETURNS user_role AS $$
DECLARE
    v_role user_role;
    v_user_id UUID;
BEGIN
    BEGIN
        v_user_id := NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    IF v_user_id IS NULL THEN
        RETURN 'sales_staff'::user_role;
    END IF;

    SELECT role INTO v_role
    FROM profiles
    WHERE id = v_user_id AND is_active = true AND deleted_at IS NULL;

    RETURN COALESCE(v_role, 'sales_staff'::user_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 4. Permission Checking Helper: has_role()
CREATE OR REPLACE FUNCTION has_role(required_role user_role)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN auth_role() = required_role OR auth_role() = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Overload: has_role for user_role array
CREATE OR REPLACE FUNCTION has_role(required_roles user_role[])
RETURNS BOOLEAN AS $$
BEGIN
    RETURN auth_role() = ANY(required_roles) OR auth_role() = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Overload: has_role for string/text parameter
CREATE OR REPLACE FUNCTION has_role(required_role text)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN auth_role()::text = required_role OR auth_role() = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Overload: has_role for string/text array
CREATE OR REPLACE FUNCTION has_role(required_roles text[])
RETURNS BOOLEAN AS $$
BEGIN
    RETURN auth_role()::text = ANY(required_roles) OR auth_role() = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 5. Row Level Security on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Profiles are readable by authenticated users" ON profiles;
    CREATE POLICY "Profiles are readable by authenticated users" ON profiles
        FOR SELECT USING (is_active = true);

    DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
    CREATE POLICY "Admins can manage all profiles" ON profiles
        FOR ALL USING (auth_role() = 'admin')
        WITH CHECK (auth_role() = 'admin');

    DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
    CREATE POLICY "Users can update their own profile" ON profiles
        FOR UPDATE USING (
            id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID
        )
        WITH CHECK (
            id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID
        );
END $$;

-- 6. Tighten RLS on audit_log: Only Admin can read
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow read audit log" ON audit_log;
    DROP POLICY IF EXISTS "Admin only read audit log" ON audit_log;

    CREATE POLICY "Admin only read audit log" ON audit_log
        FOR SELECT USING (auth_role() = 'admin');
END $$;

-- 7. Seed Demo Profiles for Each Role
INSERT INTO profiles (id, email, full_name, role, branch_id, is_active)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'admin@mahatir.com', 'Bilal Ahmad (Founder & Master Perfumer)', 'admin', '00000000-0000-0000-0000-000000000001', true),
    ('22222222-2222-2222-2222-222222222222', 'production@mahatir.com', 'Farhan Malik (Lab & Batch Lead)', 'production_manager', '00000000-0000-0000-0000-000000000001', true),
    ('33333333-3333-3333-3333-333333333333', 'inventory@mahatir.com', 'Tariq Al-Mansoor (Oils & Materials Custodian)', 'inventory_manager', '00000000-0000-0000-0000-000000000001', true),
    ('44444444-4444-4444-4444-444444444444', 'sales@mahatir.com', 'Amina Zahra (Senior Fragrance Consultant)', 'sales_staff', '00000000-0000-0000-0000-000000000001', true)
ON CONFLICT (email) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active;


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


-- ============================================================================
-- Mahatir Perfumes ERP + POS: Migration 000008
-- Phase 7: Dilution Calculator and Studio Presets
-- ============================================================================

-- 1. Dilution Presets Table
CREATE TABLE IF NOT EXISTS dilution_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT DEFAULT '00000000-0000-0000-0000-000000000001',
    name TEXT NOT NULL,
    concentration_type TEXT NOT NULL CHECK (concentration_type IN ('extrait', 'edp', 'edt', 'edc', 'custom')),
    oil_percentage NUMERIC(6, 4) NOT NULL CHECK (oil_percentage > 0 AND oil_percentage <= 100),
    alcohol_percentage NUMERIC(6, 4) NOT NULL CHECK (alcohol_percentage >= 0 AND alcohol_percentage <= 100),
    fixative_percentage NUMERIC(6, 4) NOT NULL DEFAULT 0.0000 CHECK (fixative_percentage >= 0),
    water_percentage NUMERIC(6, 4) NOT NULL DEFAULT 0.0000 CHECK (water_percentage >= 0),
    description TEXT,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dilution_presets_concentration ON dilution_presets(concentration_type);

DROP TRIGGER IF EXISTS trg_dilution_presets_updated_at ON dilution_presets;
CREATE TRIGGER trg_dilution_presets_updated_at
    BEFORE UPDATE ON dilution_presets
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_dilution_presets_audit ON dilution_presets;
CREATE TRIGGER trg_dilution_presets_audit
    AFTER INSERT OR UPDATE OR DELETE ON dilution_presets
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_func();

-- 2. Row Level Security
ALTER TABLE dilution_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dilution_presets_select" ON dilution_presets;
CREATE POLICY "dilution_presets_select" ON dilution_presets
    FOR SELECT TO authenticated
    USING (branch_id = current_setting('app.current_branch_id', true)::UUID OR branch_id = '00000000-0000-0000-0000-000000000001'::UUID);

DROP POLICY IF EXISTS "dilution_presets_modify" ON dilution_presets;
CREATE POLICY "dilution_presets_modify" ON dilution_presets
    FOR ALL TO authenticated
    USING (has_role('admin') OR has_role('production_manager'));

-- 3. Seed Industry Standard Dilution Presets
INSERT INTO dilution_presets (name, concentration_type, oil_percentage, alcohol_percentage, fixative_percentage, water_percentage, description, is_default)
VALUES
    ('Signature Extrait de Parfum (30%)', 'extrait', 30.0000, 65.0000, 5.0000, 0.0000, 'Ultra-concentrated luxury perfume extrait with 5% Ambroxan/fixative enhancer for maximum longevity.', true),
    ('Grand Extrait Pure (40%)', 'extrait', 40.0000, 60.0000, 0.0000, 0.0000, 'Heavy concentration pure extrait for pure attar and rich oud formulas.', false),
    ('Standard Eau de Parfum (20%)', 'edp', 20.0000, 77.0000, 3.0000, 0.0000, 'Classic luxury EDP ratio balancing projection and persistence with 3% fixative.', true),
    ('Intense Eau de Parfum (25%)', 'edp', 25.0000, 72.0000, 3.0000, 0.0000, 'High-intensity EDP formulation for cooler climates or evening fragrances.', false),
    ('Standard Eau de Toilette (10%)', 'edt', 10.0000, 88.0000, 2.0000, 0.0000, 'Fresh, luminous daily scent with quick radiant sillage.', true),
    ('Light Eau de Toilette (8%)', 'edt', 8.0000, 90.0000, 2.0000, 0.0000, 'Subtle daytime Eau de Toilette composition.', false),
    ('Artisanal Eau de Cologne (4%)', 'edc', 4.0000, 93.0000, 1.0000, 2.0000, 'Traditional sparkling citrus splash cologne with 2% distilled water softening.', true)
ON CONFLICT DO NOTHING;

-- 4. Pure Database Helper Function for Dilution Calculation
CREATE OR REPLACE FUNCTION calculate_dilution(
    p_target_volume NUMERIC,
    p_oil_percent NUMERIC,
    p_fixative_percent NUMERIC DEFAULT 0,
    p_water_percent NUMERIC DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
    v_alcohol_percent NUMERIC;
    v_oil_ml NUMERIC;
    v_alcohol_ml NUMERIC;
    v_fixative_ml NUMERIC;
    v_water_ml NUMERIC;
BEGIN
    IF p_target_volume <= 0 THEN
        RAISE EXCEPTION 'Target volume must be greater than zero';
    END IF;

    IF p_oil_percent <= 0 OR p_oil_percent > 100 THEN
        RAISE EXCEPTION 'Oil percentage must be between 0.01 and 100';
    END IF;

    v_alcohol_percent := 100.0000 - p_oil_percent - COALESCE(p_fixative_percent, 0) - COALESCE(p_water_percent, 0);

    IF v_alcohol_percent < 0 THEN
        RAISE EXCEPTION 'Sum of oil, fixative, and water percentages exceeds 100%%';
    END IF;

    v_oil_ml := ROUND((p_target_volume * p_oil_percent / 100.0000), 4);
    v_fixative_ml := ROUND((p_target_volume * COALESCE(p_fixative_percent, 0) / 100.0000), 4);
    v_water_ml := ROUND((p_target_volume * COALESCE(p_water_percent, 0) / 100.0000), 4);
    v_alcohol_ml := ROUND((p_target_volume * v_alcohol_percent / 100.0000), 4);

    RETURN jsonb_build_object(
        'target_volume_ml', p_target_volume,
        'oil_percent', p_oil_percent,
        'oil_ml', v_oil_ml,
        'alcohol_percent', v_alcohol_percent,
        'alcohol_ml', v_alcohol_ml,
        'fixative_percent', COALESCE(p_fixative_percent, 0),
        'fixative_ml', v_fixative_ml,
        'water_percent', COALESCE(p_water_percent, 0),
        'water_ml', v_water_ml
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;


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


-- ============================================================================
-- Mahatir Perfumes ERP + POS: Migration 000010
-- Phase 9: Alerts, In-App Notification Center, Stock Integrity & Automation
-- ============================================================================

-- 1. Enums
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_severity') THEN
        CREATE TYPE alert_severity AS ENUM ('info', 'warning', 'critical');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_type') THEN
        CREATE TYPE alert_type AS ENUM (
            'low_raw_material', 
            'low_finished_goods', 
            'production_needed', 
            'negative_stock_attempt', 
            'system'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_status') THEN
        CREATE TYPE notification_status AS ENUM ('unread', 'read', 'archived');
    END IF;
END $$;

-- 2. Tables
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    type alert_type NOT NULL,
    severity alert_severity NOT NULL DEFAULT 'info',
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    entity_type VARCHAR(100), -- 'raw_material', 'product_variant', 'batch', etc.
    entity_id UUID,
    data JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    read_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS alert_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE UNIQUE,
    email_alerts_enabled BOOLEAN NOT NULL DEFAULT false,
    email_recipients TEXT[] DEFAULT ARRAY[]::TEXT[],
    low_stock_days_threshold NUMERIC(10, 2) NOT NULL DEFAULT 14.00,
    daily_cron_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Seed default alert configuration for main branch
INSERT INTO alert_configurations (branch_id, email_alerts_enabled, low_stock_days_threshold)
SELECT id, false, 14.00 FROM branches WHERE code = 'MAIN-01'
ON CONFLICT (branch_id) DO NOTHING;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_branch_read ON notifications(branch_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type_severity ON notifications(type, severity);
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON notifications(entity_type, entity_id);

-- 4. Audit & Timestamp Triggers
DROP TRIGGER IF EXISTS trg_notifications_updated_at ON notifications;
CREATE TRIGGER trg_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_alert_configurations_updated_at ON alert_configurations;
CREATE TRIGGER trg_alert_configurations_updated_at
    BEFORE UPDATE ON alert_configurations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_audit_notifications ON notifications;
CREATE TRIGGER trg_audit_notifications
    AFTER INSERT OR UPDATE OR DELETE ON notifications
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- 5. Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read notifications"
    ON notifications FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to update read status"
    ON notifications FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow admin to manage alert configurations"
    ON alert_configurations FOR ALL
    TO authenticated
    USING (auth_role() = 'admin')
    WITH CHECK (auth_role() = 'admin');

CREATE POLICY "Allow staff to view alert configurations"
    ON alert_configurations FOR SELECT
    TO authenticated
    USING (true);

-- 6. RPC: generate_system_alerts()
CREATE OR REPLACE FUNCTION generate_system_alerts(p_branch_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_branch_id UUID;
    v_raw_count INT := 0;
    v_finished_count INT := 0;
    v_rec RECORD;
BEGIN
    IF p_branch_id IS NULL THEN
        SELECT id INTO v_branch_id FROM branches WHERE code = 'MAIN-01' LIMIT 1;
    ELSE
        v_branch_id := p_branch_id;
    END IF;

    -- 1. Scan Raw Materials below min_stock_level
    FOR v_rec IN 
        SELECT id, name, sku, current_stock, min_stock_level
        FROM raw_materials
        WHERE is_active = true 
          AND deleted_at IS NULL
          AND min_stock_level > 0
          AND current_stock <= min_stock_level
    LOOP
        -- Check if unread alert exists within last 24 hours
        IF NOT EXISTS (
            SELECT 1 FROM notifications
            WHERE entity_type = 'raw_material'
              AND entity_id = v_rec.id
              AND is_read = false
              AND created_at >= (NOW() - INTERVAL '24 HOURS')
        ) THEN
            INSERT INTO notifications (
                branch_id,
                type,
                severity,
                title,
                message,
                entity_type,
                entity_id,
                data
            ) VALUES (
                v_branch_id,
                'low_raw_material',
                CASE WHEN v_rec.current_stock <= 0 THEN 'critical'::alert_severity ELSE 'warning'::alert_severity END,
                'Low Raw Material Stock: ' || v_rec.name,
                'Stock level for ' || v_rec.name || ' (' || v_rec.sku || ') is ' || v_rec.current_stock || ', below minimum threshold of ' || v_rec.min_stock_level || '.',
                'raw_material',
                v_rec.id,
                jsonb_build_object(
                    'sku', v_rec.sku,
                    'current_stock', v_rec.current_stock,
                    'min_stock_level', v_rec.min_stock_level
                )
            );
            v_raw_count := v_raw_count + 1;
        END IF;
    END LOOP;

    -- 2. Scan Finished Goods Variants below min_stock_level
    FOR v_rec IN 
        SELECT pv.id, pv.sku, pv.name AS variant_name, p.name AS product_name, pv.current_stock, pv.min_stock_level
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.id
        WHERE pv.is_active = true 
          AND pv.deleted_at IS NULL
          AND pv.min_stock_level > 0
          AND pv.current_stock <= pv.min_stock_level
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM notifications
            WHERE entity_type = 'product_variant'
              AND entity_id = v_rec.id
              AND is_read = false
              AND created_at >= (NOW() - INTERVAL '24 HOURS')
        ) THEN
            INSERT INTO notifications (
                branch_id,
                type,
                severity,
                title,
                message,
                entity_type,
                entity_id,
                data
            ) VALUES (
                v_branch_id,
                'low_finished_goods',
                CASE WHEN v_rec.current_stock <= 0 THEN 'critical'::alert_severity ELSE 'warning'::alert_severity END,
                'Low Finished Goods Stock: ' || v_rec.product_name || ' (' || v_rec.variant_name || ')',
                'Finished inventory for ' || v_rec.product_name || ' (' || v_rec.variant_name || ') is ' || v_rec.current_stock || ' units, below threshold of ' || v_rec.min_stock_level || '.',
                'product_variant',
                v_rec.id,
                jsonb_build_object(
                    'sku', v_rec.sku,
                    'product_name', v_rec.product_name,
                    'variant_name', v_rec.variant_name,
                    'current_stock', v_rec.current_stock,
                    'min_stock_level', v_rec.min_stock_level
                )
            );
            v_finished_count := v_finished_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'raw_material_alerts_created', v_raw_count,
        'finished_goods_alerts_created', v_finished_count,
        'total_new_alerts', (v_raw_count + v_finished_count)
    );
END;
$$;

-- 7. RPC: check_stock_integrity() - Negative Stock Guard Review
CREATE OR REPLACE FUNCTION check_stock_integrity()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_violations JSONB := '[]'::jsonb;
    v_rec RECORD;
BEGIN
    -- 1. Check raw materials
    FOR v_rec IN 
        SELECT id, name, sku, current_stock 
        FROM raw_materials 
        WHERE current_stock < 0
    LOOP
        v_violations := v_violations || jsonb_build_object(
            'table', 'raw_materials',
            'id', v_rec.id,
            'name', v_rec.name,
            'sku', v_rec.sku,
            'negative_stock', v_rec.current_stock
        );
    END LOOP;

    -- 2. Check bulk batches
    FOR v_rec IN 
        SELECT id, batch_code, remaining_volume
        FROM batches 
        WHERE remaining_volume < 0
    LOOP
        v_violations := v_violations || jsonb_build_object(
            'table', 'batches',
            'id', v_rec.id,
            'batch_code', v_rec.batch_code,
            'negative_volume', v_rec.remaining_volume
        );
    END LOOP;

    -- 3. Check finished goods lots
    FOR v_rec IN 
        SELECT id, lot_number, current_quantity 
        FROM finished_goods_lots 
        WHERE current_quantity < 0
    LOOP
        v_violations := v_violations || jsonb_build_object(
            'table', 'finished_goods_lots',
            'id', v_rec.id,
            'lot_number', v_rec.lot_number,
            'negative_quantity', v_rec.current_quantity
        );
    END LOOP;

    -- 4. Check product variants
    FOR v_rec IN 
        SELECT id, sku, name, current_stock
        FROM product_variants 
        WHERE current_stock < 0
    LOOP
        v_violations := v_violations || jsonb_build_object(
            'table', 'product_variants',
            'id', v_rec.id,
            'sku', v_rec.sku,
            'name', v_rec.name,
            'negative_stock', v_rec.current_stock
        );
    END LOOP;

    RETURN jsonb_build_object(
        'passed', (jsonb_array_length(v_violations) = 0),
        'violations_count', jsonb_array_length(v_violations),
        'violations', v_violations,
        'checked_at', clock_timestamp()
    );
END;
$$;

-- 8. RPC: mark_notification_read()
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID, p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE notifications
    SET is_read = true,
        read_at = clock_timestamp(),
        read_by = p_user_id
    WHERE id = p_notification_id;

    RETURN FOUND;
END;
$$;

-- 9. RPC: mark_all_notifications_read()
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id UUID DEFAULT NULL, p_branch_id UUID DEFAULT NULL)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INT;
BEGIN
    UPDATE notifications
    SET is_read = true,
        read_at = clock_timestamp(),
        read_by = p_user_id
    WHERE is_read = false
      AND (p_branch_id IS NULL OR branch_id = p_branch_id);

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;


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
    ON sales(cashier_id, created_at DESC);

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
        WHERE b.status IN ('bulk', 'partial_bottled', 'completed')
      AND (p_branch_id IS NULL OR b.branch_id = p_branch_id);
END;
$$;
