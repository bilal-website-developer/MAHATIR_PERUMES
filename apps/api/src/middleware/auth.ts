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

const USER_ROLES: readonly UserRole[] = [
  'admin',
  'production_manager',
  'sales_staff',
  'inventory_manager',
];

export function isUserRole(role: unknown): role is UserRole {
  return typeof role === 'string' && USER_ROLES.includes(role as UserRole);
}

export type ProfileUserResult =
  | { user: AuthenticatedUser; error?: never }
  | { user?: never; error: { status: 403 | 503; code: string; message: string } };

export async function loadAuthenticatedUserProfile(authUser: {
  id: string;
  email?: string;
}): Promise<ProfileUserResult> {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, role, branch_id, is_active, deleted_at')
      .eq('id', authUser.id)
      .maybeSingle();

    if (error) {
      console.error('Authenticated profile lookup failed', {
        userId: authUser.id,
        code: error.code,
        message: error.message,
      });
      return {
        error: {
          status: 503,
          code: 'PROFILE_LOOKUP_FAILED',
          message: 'Could not load your profile. Verify the API Supabase URL and service-role key.',
        },
      };
    }

    if (!profile) {
      return {
        error: {
          status: 403,
          code: 'PROFILE_NOT_FOUND',
          message: 'No profile is linked to this authenticated Supabase user.',
        },
      };
    }

    if (!isUserRole(profile.role)) {
      console.error('Authenticated profile has an invalid role', {
        userId: authUser.id,
        role: profile.role,
      });
      return {
        error: {
          status: 403,
          code: 'INVALID_PROFILE_ROLE',
          message: 'Your profile has an unsupported role. Ask an administrator to correct it.',
        },
      };
    }

    if (!profile.is_active || profile.deleted_at) {
      return {
        error: {
          status: 403,
          code: 'PROFILE_INACTIVE',
          message: 'This account profile is inactive or deleted.',
        },
      };
    }

    return {
      user: {
        id: authUser.id,
        email: authUser.email || profile.email,
        fullName: profile.full_name,
        role: profile.role,
        branchId: profile.branch_id || '00000000-0000-0000-0000-000000000001',
      },
    };
  } catch (error: unknown) {
    console.error('Authenticated profile lookup threw an error', {
      userId: authUser.id,
      message: error instanceof Error ? error.message : 'Unknown profile lookup error',
    });
    return {
      error: {
        status: 503,
        code: 'PROFILE_LOOKUP_FAILED',
        message: 'Could not load your profile. Verify the API Supabase URL and service-role key.',
      },
    };
  }
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

export function isDemoAuthEnabled(): boolean {
  return process.env.NODE_ENV !== 'production';
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    sendError(res, 'Authorization header is required.', 401, 'MISSING_AUTHORIZATION');
    return;
  }

  if (!authHeader.startsWith('Bearer ')) {
    sendError(res, 'Authorization header must use the Bearer scheme.', 401, 'INVALID_AUTHORIZATION');
    return;
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    sendError(res, 'Bearer token is missing.', 401, 'MISSING_BEARER_TOKEN');
    return;
  }

  // 1. Check for demo session tokens (e.g. Bearer demo-admin)
  if (isDemoAuthEnabled() && DEMO_USERS[token]) {
    req.user = DEMO_USERS[token];
    return next();
  }

  // 2. Otherwise verify via Supabase JWT
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      console.warn('Supabase rejected an API bearer token', {
        code: error?.code,
        status: error?.status,
        message: error?.message,
      });
      sendError(
        res,
        'Session token was rejected. It may be expired or from a different Supabase project; verify Vercel SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
        401,
        'INVALID_OR_FOREIGN_TOKEN',
      );
      return;
    }

    const result = await loadAuthenticatedUserProfile(user);
    if (!result.user) {
      sendError(res, result.error.message, result.error.status, result.error.code);
      return;
    }

    req.user = result.user;

    next();
  } catch (err: unknown) {
    console.error('Supabase token verification failed', err);
    sendError(
      res,
      'The authentication service could not verify this token. Check the API Supabase URL and service-role key.',
      503,
      'AUTH_VERIFICATION_UNAVAILABLE',
    );
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'No authenticated user is attached to this request.', 401, 'MISSING_AUTHENTICATED_USER');
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
      sendError(res, 'No authenticated user is attached to this request.', 401, 'MISSING_AUTHENTICATED_USER');
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
