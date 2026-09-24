-- supabase/seed.sql
-- Seed data for Mahatir Perfumes ERP + POS

-- Ensure default branch exists
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

-- Ensure default app settings exists
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
