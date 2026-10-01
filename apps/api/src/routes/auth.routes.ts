import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, DEMO_USERS, isDemoAuthEnabled, loadAuthenticatedUserProfile } from '../middleware/auth.js';
import { ROLE_PERMISSIONS } from '../config/permissions.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const authRouter = Router();

const supabaseAuth = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

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
    if (isDemoAuthEnabled()) {
      for (const [token, demoUser] of Object.entries(DEMO_USERS)) {
        if (demoUser.email.toLowerCase() === email.toLowerCase()) {
          return sendSuccess(res, {
            token,
            user: demoUser,
            permissions: ROLE_PERMISSIONS[demoUser.role],
          });
        }
      }
    }

    // Try Supabase Auth
    try {
      const { data, error } = await supabaseAuth.auth.signInWithPassword({
        email: req.body.email,
        password: req.body.password,
      });

      if (error || !data.user || !data.session) {
        return sendError(res, error?.message || 'Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }

      const profileResult = await loadAuthenticatedUserProfile(data.user);
      if (!profileResult.user) {
        return sendError(
          res,
          profileResult.error.message,
          profileResult.error.status,
          profileResult.error.code,
        );
      }

      const user = profileResult.user;

      return sendSuccess(res, {
        token: data.session.access_token,
        user,
        permissions: ROLE_PERMISSIONS[user.role],
      });
    } catch (err: unknown) {
      console.error('Supabase sign-in failed', err);
      return sendError(res, 'Authentication service unavailable.', 503, 'AUTH_SERVICE_UNAVAILABLE');
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
