import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole, DEMO_USERS } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { InventoryService } from '../services/inventory.service.js';
import { FormulaService } from '../services/formula.service.js';
import { BatchService } from '../services/batch.service.js';
import { ProductService } from '../services/product.service.js';
import { BottlingService } from '../services/bottling.service.js';
import { SalesService } from '../services/sales.service.js';
import { NotificationService } from '../services/notification.service.js';

export const usersRouter = Router();

// Ensure all user management routes require admin role
usersRouter.use(requireAuth);
usersRouter.use(requireRole('admin'));

const createUserSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(2),
  password: z.string().min(8),
  role: z.enum(['admin', 'production_manager', 'sales_staff', 'inventory_manager']),
  branch_id: z.string().uuid().optional(),
});

const updateUserSchema = z.object({
  full_name: z.string().min(2).optional(),
  role: z.enum(['admin', 'production_manager', 'sales_staff', 'inventory_manager']).optional(),
  is_active: z.boolean().optional(),
  branch_id: z.string().uuid().optional(),
});

const RECENT_ACTIVITY_WINDOW_MS = 15 * 60 * 1000;

async function fetchProfilesWithActivity() {
  const [{ data: profiles, error: profileError }, { data: authUsers, error: authError }] = await Promise.all([
    supabaseAdmin.from('profiles').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
    supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  if (profileError) throw profileError;

  const authUserMap = new Map((authUsers?.users || []).map((authUser) => [authUser.id, authUser]));
  const now = Date.now();
  const enrichedProfiles = (profiles || []).map((profile) => {
    const authUser = authUserMap.get(profile.id);
    const lastSignInAt = authUser?.last_sign_in_at || null;
    const isRecentlyActive = lastSignInAt
      ? now - new Date(lastSignInAt).getTime() <= RECENT_ACTIVITY_WINDOW_MS
      : false;

    return {
      ...profile,
      last_sign_in_at: lastSignInAt,
      is_recently_active: isRecentlyActive,
    };
  });

  return { users: enrichedProfiles, authError };
}

// In-memory fallback list initialized with demo users
let memoryProfiles = Object.values(DEMO_USERS).map((u) => ({
  id: u.id,
  email: u.email,
  full_name: u.fullName,
  role: u.role,
  branch_id: u.branchId,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}));

// GET /api/v1/users
usersRouter.get('/users', async (_req: Request, res: Response) => {
  try {
    const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: new Error('Timeout') }), 800),
    );

    const queryPromise = fetchProfilesWithActivity();

    const result = await Promise.race([queryPromise, timeoutPromise]);

    if ('error' in result) {
      return sendSuccess(res, memoryProfiles, { total: memoryProfiles.length, recently_active_count: 0 });
    }
    const recentlyActiveCount = result.users.filter((user: { is_recently_active: boolean }) => user.is_recently_active).length;
    return sendSuccess(res, result.users, {
      total: result.users.length,
      recently_active_count: recentlyActiveCount,
      auth_directory_warning: result.authError?.message,
    });
  } catch (_err) {
    return sendSuccess(res, memoryProfiles, { total: memoryProfiles.length, recently_active_count: 0 });
  }
});

// POST /api/v1/users/clear-demo-data
usersRouter.post('/users/clear-demo-data', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin.rpc('clear_demo_data');
    if (error) {
      if (error.message.includes('clear_demo_data') || error.code === 'PGRST202') {
        InventoryService.clearDemoData();
        FormulaService.clearDemoData();
        BatchService.clearDemoData();
        ProductService.clearDemoData();
        BottlingService.clearDemoData();
        SalesService.clearDemoData();
        NotificationService.clearDemoData();
        return sendSuccess(res, { cleared: true, already_cleared: false, storage: 'memory-fallback' });
      }
      return sendError(res, error.message, 400, 'DEMO_DATA_CLEAR_FAILED');
    }

    return sendSuccess(res, data);
  } catch (_err) {
    return sendError(res, 'Demo data cleanup service is unavailable', 503, 'DEMO_DATA_CLEAR_UNAVAILABLE');
  }
});

// POST /api/v1/users
usersRouter.post(
  '/users',
  validate({ body: createUserSchema }),
  async (req: Request, res: Response) => {
    const { email, full_name, password, role, branch_id } = req.body;
    const branchId = branch_id || '00000000-0000-0000-0000-000000000001';

    try {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, role },
      });

      if (authError || !authData.user) {
        return sendError(res, authError?.message || 'Unable to create authentication user', 400, 'AUTH_USER_CREATE_FAILED');
      }

      const { data, error } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: authData.user.id,
          email,
          full_name,
          role,
          branch_id: branchId,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        return sendError(res, error.message, 400, 'PROFILE_CREATE_FAILED');
      }

      return sendSuccess(res, { ...data, last_sign_in_at: null, is_recently_active: false }, null, 201);
    } catch (_err) {
      return sendError(res, 'User creation service is unavailable', 503, 'USER_CREATE_UNAVAILABLE');
    }
  },
);

// PATCH /api/v1/users/:id
usersRouter.patch(
  '/users/:id',
  validate({ body: updateUserSchema }),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates = req.body;

    try {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error || !data) {
        const idx = memoryProfiles.findIndex((p) => p.id === id);
        if (idx !== -1) {
          memoryProfiles[idx] = {
            ...memoryProfiles[idx]!,
            ...updates,
            updated_at: new Date().toISOString(),
          };
          return sendSuccess(res, memoryProfiles[idx]);
        }
        return sendError(res, 'User not found', 404, 'NOT_FOUND');
      }

      return sendSuccess(res, data);
    } catch (_err) {
      const idx = memoryProfiles.findIndex((p) => p.id === id);
      if (idx !== -1) {
        memoryProfiles[idx] = {
          ...memoryProfiles[idx]!,
          ...updates,
          updated_at: new Date().toISOString(),
        };
        return sendSuccess(res, memoryProfiles[idx]);
      }
      return sendError(res, 'User not found', 404, 'NOT_FOUND');
    }
  },
);

// DELETE /api/v1/users/:id
usersRouter.delete('/users/:id', async (req: Request, res: Response) => {
  const routeId = req.params.id;
  const id = Array.isArray(routeId) ? routeId[0] : routeId;

  if (!id) {
    return sendError(res, 'User ID is required', 400, 'INVALID_USER_ID');
  }

  if (id === req.user?.id) {
    return sendError(res, 'You cannot delete your own administrator account', 400, 'SELF_DELETE_FORBIDDEN');
  }

  try {
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (authError) {
      return sendError(res, authError.message, 400, 'AUTH_USER_DELETE_FAILED');
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ is_active: false, deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (profileError) {
      return sendError(res, profileError.message, 400, 'PROFILE_DELETE_FAILED');
    }

    return sendSuccess(res, { id, deleted: true });
  } catch (_err) {
    return sendError(res, 'User deletion service is unavailable', 503, 'USER_DELETE_UNAVAILABLE');
  }
});
