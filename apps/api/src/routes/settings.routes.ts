import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { sendSuccess } from '../utils/response.js';

export const settingsRouter = Router();

// Default fallback settings when starting up in dev without remote db
const DEFAULT_SETTINGS = {
  id: '00000000-0000-0000-0000-000000000002',
  company_name: 'Mahatir Perfumes',
  currency: 'USD',
  currency_symbol: '$',
  tax_percentage: '5.00',
  invoice_prefix: 'MP-INV-',
  logo_url: null,
  contact_email: 'contact@mahatirperfumes.com',
  phone: '+1 (555) 019-8822',
  address: '100 Perfumer Way, Fragrance Boulevard',
};

// GET /api/v1/settings
settingsRouter.get('/settings', async (_req: Request, res: Response) => {
  try {
    const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: new Error('Query timeout') }), 800),
    );

    const queryPromise = supabaseAdmin
      .from('app_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

    if (error || !data) {
      return sendSuccess(res, DEFAULT_SETTINGS);
    }
    return sendSuccess(res, data);
  } catch (_err) {
    return sendSuccess(res, DEFAULT_SETTINGS);
  }
});
