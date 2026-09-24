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
    currency TEXT NOT NULL DEFAULT 'PKR',
    currency_symbol TEXT NOT NULL DEFAULT 'Rs. ',
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
    'PKR',
    'Rs. ',
    5.00,
    'MP-INV-',
    NULL,
    'contact@mahatirperfumes.com',
    '+1 (555) 019-8822',
    '100 Perfumer Way, Fragrance Boulevard'
)
ON CONFLICT (id) DO NOTHING;
