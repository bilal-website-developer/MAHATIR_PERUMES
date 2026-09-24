import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, DEMO_USERS } from '../middleware/auth.js';
import { ROLE_PERMISSIONS, UserRole } from '../config/permissions.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// POST /api/v1/auth/login
authRouter.post(
  '/auth/login',
  validate({ body: loginSchema }),
  async (req: Request, res: Response) => {
    const { email } = req.body;

    // Check for demo login
    for (const [token, demoUser] of Object.entries(DEMO_USERS)) {
      if (demoUser.email.toLowerCase() === email.toLowerCase()) {
        return sendSuccess(res, {
          token,
          user: demoUser,
          permissions: ROLE_PERMISSIONS[demoUser.role],
        });
      }
    }

    // Try Supabase Auth
    try {
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email: req.body.email,
        password: req.body.password,
      });

      if (error || !data.user || !data.session) {
        return sendError(res, error?.message || 'Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }

      // Fetch user profile
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      const role = (profile?.role || 'sales_staff') as UserRole;
      const user = {
        id: data.user.id,
        email: data.user.email,
        fullName: profile?.full_name || 'Staff Member',
        role,
        branchId: profile?.branch_id || '00000000-0000-0000-0000-000000000001',
      };

      return sendSuccess(res, {
        token: data.session.access_token,
        user,
        permissions: ROLE_PERMISSIONS[role],
      });
    } catch (_err) {
      return sendError(res, 'Authentication service error', 500, 'AUTH_ERROR');
    }
  },
);

// GET /api/v1/auth/me
authRouter.get('/auth/me', requireAuth, (req: Request, res: Response) => {
  if (!req.user) {
    return sendError(res, 'Not authenticated', 401, 'UNAUTHORIZED');
  }

  return sendSuccess(res, {
    user: req.user,
    permissions: ROLE_PERMISSIONS[req.user.role],
  });
});
