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
SELECT id, false, 14.00 FROM branches WHERE is_default = true
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
        SELECT id INTO v_branch_id FROM branches WHERE is_default = true LIMIT 1;
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
        SELECT pv.id, pv.sku, pv.name AS variant_name, p.name AS product_name, pv.stock_quantity, pv.min_stock_level
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.id
        WHERE pv.is_active = true 
          AND pv.deleted_at IS NULL
          AND pv.min_stock_level > 0
          AND pv.stock_quantity <= pv.min_stock_level
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
                CASE WHEN v_rec.stock_quantity <= 0 THEN 'critical'::alert_severity ELSE 'warning'::alert_severity END,
                'Low Finished Goods Stock: ' || v_rec.product_name || ' (' || v_rec.variant_name || ')',
                'Finished inventory for ' || v_rec.product_name || ' (' || v_rec.variant_name || ') is ' || v_rec.stock_quantity || ' units, below threshold of ' || v_rec.min_stock_level || '.',
                'product_variant',
                v_rec.id,
                jsonb_build_object(
                    'sku', v_rec.sku,
                    'product_name', v_rec.product_name,
                    'variant_name', v_rec.variant_name,
                    'stock_quantity', v_rec.stock_quantity,
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
        SELECT id, batch_number, remaining_volume 
        FROM batches 
        WHERE remaining_volume < 0
    LOOP
        v_violations := v_violations || jsonb_build_object(
            'table', 'batches',
            'id', v_rec.id,
            'batch_number', v_rec.batch_number,
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
        SELECT id, sku, name, stock_quantity 
        FROM product_variants 
        WHERE stock_quantity < 0
    LOOP
        v_violations := v_violations || jsonb_build_object(
            'table', 'product_variants',
            'id', v_rec.id,
            'sku', v_rec.sku,
            'name', v_rec.name,
            'negative_stock', v_rec.stock_quantity
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
