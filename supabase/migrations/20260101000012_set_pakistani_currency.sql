-- Set the company currency to Pakistani rupees for existing installations.
UPDATE app_settings
SET currency = 'PKR',
    currency_symbol = 'Rs.',
    updated_at = NOW()
WHERE currency IS DISTINCT FROM 'PKR'
   OR currency_symbol IS DISTINCT FROM 'Rs.';
