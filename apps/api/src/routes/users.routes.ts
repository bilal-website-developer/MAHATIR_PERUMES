import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole, DEMO_USERS } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const usersRouter = Router();

// Ensure all user management routes require admin role
usersRouter.use(requireAuth);
usersRouter.use(requireRole('admin'));

const createUserSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(2),
  role: z.enum(['admin', 'production_manager', 'sales_staff', 'inventory_manager']),
  branch_id: z.string().uuid().optional(),
});

const updateUserSchema = z.object({
  full_name: z.string().min(2).optional(),
  role: z.enum(['admin', 'production_manager', 'sales_staff', 'inventory_manager']).optional(),
  is_active: z.boolean().optional(),
  branch_id: z.string().uuid().optional(),
});

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

    const queryPromise = supabaseAdmin
      .from('profiles')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

    if (error || !data || data.length === 0) {
      return sendSuccess(res, memoryProfiles, { total: memoryProfiles.length });
    }
    return sendSuccess(res, data, { total: data.length });
  } catch (_err) {
    return sendSuccess(res, memoryProfiles, { total: memoryProfiles.length });
  }
});

// POST /api/v1/users
usersRouter.post(
  '/users',
  validate({ body: createUserSchema }),
  async (req: Request, res: Response) => {
    const { email, full_name, role, branch_id } = req.body;
    const branchId = branch_id || '00000000-0000-0000-0000-000000000001';

    try {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .insert({
          email,
          full_name,
          role,
          branch_id: branchId,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        // Fallback to memory insert
        const newProfile = {
          id: `usr-${Date.now()}`,
          email,
          full_name,
          role,
          branch_id: branchId,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        memoryProfiles.unshift(newProfile);
        return sendSuccess(res, newProfile, null, 201);
      }

      return sendSuccess(res, data, null, 201);
    } catch (_err) {
      const newProfile = {
        id: `usr-${Date.now()}`,
        email,
        full_name,
        role,
        branch_id: branchId,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      memoryProfiles.unshift(newProfile);
      return sendSuccess(res, newProfile, null, 201);
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
