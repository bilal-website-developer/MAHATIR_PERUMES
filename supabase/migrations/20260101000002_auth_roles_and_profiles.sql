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
