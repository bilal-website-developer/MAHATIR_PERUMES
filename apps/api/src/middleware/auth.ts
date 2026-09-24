import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { UserRole, AppResource, Action, hasPermission } from '../config/permissions.js';
import { sendError } from '../utils/response.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  branchId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

// Built-in seed user lookup for local dev testing
export const DEMO_USERS: Record<string, AuthenticatedUser> = {
  'demo-admin': {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'admin@mahatir.com',
    fullName: 'Bilal Ahmad (Founder & Master Perfumer)',
    role: 'admin',
    branchId: '00000000-0000-0000-0000-000000000001',
  },
  'demo-production': {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'production@mahatir.com',
    fullName: 'Farhan Malik (Lab & Batch Lead)',
    role: 'production_manager',
    branchId: '00000000-0000-0000-0000-000000000001',
  },
  'demo-inventory': {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'inventory@mahatir.com',
    fullName: 'Tariq Al-Mansoor (Oils & Materials Custodian)',
    role: 'inventory_manager',
    branchId: '00000000-0000-0000-0000-000000000001',
  },
  'demo-sales': {
    id: '44444444-4444-4444-4444-444444444444',
    email: 'sales@mahatir.com',
    fullName: 'Amina Zahra (Senior Fragrance Consultant)',
    role: 'sales_staff',
    branchId: '00000000-0000-0000-0000-000000000001',
  },
};

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(res, 'Authentication token required', 401, 'UNAUTHORIZED');
    return;
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    sendError(res, 'Invalid authorization format', 401, 'UNAUTHORIZED');
    return;
  }

  // 1. Check for demo session tokens (e.g. Bearer demo-admin)
  if (DEMO_USERS[token]) {
    req.user = DEMO_USERS[token];
    return next();
  }

  // 2. Otherwise verify via Supabase JWT
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      sendError(res, 'Invalid or expired session token', 401, 'UNAUTHORIZED');
      return;
    }

    // Fetch profile from profiles table
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    const role = (profile?.role || user.user_metadata?.role || 'sales_staff') as UserRole;
    const branchId = profile?.branch_id || '00000000-0000-0000-0000-000000000001';

    req.user = {
      id: user.id,
      email: user.email || 'user@mahatir.com',
      fullName: profile?.full_name || user.user_metadata?.full_name || 'Staff Member',
      role,
      branchId,
    };

    next();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Auth verification error';
    sendError(res, msg, 401, 'UNAUTHORIZED');
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'Authentication required', 401, 'UNAUTHORIZED');
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      sendError(
        res,
        `Access forbidden: role '${req.user.role}' lacks permission for this action`,
        403,
        'FORBIDDEN',
      );
      return;
    }

    next();
  };
}

export function requirePermission(resource: AppResource, action: Action) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'Authentication required', 401, 'UNAUTHORIZED');
      return;
    }

    if (!hasPermission(req.user.role, resource, action)) {
      sendError(
        res,
        `Access forbidden: '${req.user.role}' cannot perform '${action}' on '${resource}'`,
        403,
        'FORBIDDEN',
      );
      return;
    }

    next();
  };
}
