import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { sendSuccess } from '../utils/response.js';

export const branchRouter = Router();

const DEFAULT_BRANCHES = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Main Boutique & Lab',
    code: 'MAIN-01',
    address: '100 Perfumer Way, Fragrance Boulevard',
    phone: '+1 (555) 019-8822',
    email: 'flagship@mahatirperfumes.com',
    is_active: true,
  },
];

// GET /api/v1/branches
branchRouter.get('/branches', async (_req: Request, res: Response) => {
  try {
    const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: new Error('Query timeout') }), 800),
    );

    const queryPromise = supabaseAdmin
      .from('branches')
      .select('*')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name');

    const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

    if (error || !data || data.length === 0) {
      return sendSuccess(res, DEFAULT_BRANCHES, { total: DEFAULT_BRANCHES.length });
    }
    return sendSuccess(res, data, { total: data.length });
  } catch (_err) {
    return sendSuccess(res, DEFAULT_BRANCHES, { total: DEFAULT_BRANCHES.length });
  }
});
