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
