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
