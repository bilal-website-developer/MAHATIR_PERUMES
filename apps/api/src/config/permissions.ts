export type UserRole =
  | 'admin'
  | 'production_manager'
  | 'sales_staff'
  | 'inventory_manager';

export type AppResource =
  | 'users'
  | 'audit_log'
  | 'settings'
  | 'raw_materials'
  | 'suppliers'
  | 'purchases'
  | 'purchase_approval'
  | 'formulas'
  | 'batches'
  | 'bottling'
  | 'pos'
  | 'dilution'
  | 'reports';

export type Action = 'create' | 'read' | 'update' | 'delete' | 'approve';

// Matrix mapping each role to allowed resources and actions
export const ROLE_PERMISSIONS: Record<UserRole, Partial<Record<AppResource, Action[]>>> = {
  admin: {
    users: ['create', 'read', 'update', 'delete'],
    audit_log: ['read'],
    settings: ['create', 'read', 'update'],
    raw_materials: ['create', 'read', 'update', 'delete'],
    suppliers: ['create', 'read', 'update', 'delete'],
    purchases: ['create', 'read', 'update', 'delete', 'approve'],
    purchase_approval: ['approve'],
    formulas: ['create', 'read', 'update', 'delete'],
    batches: ['create', 'read', 'update', 'delete'],
    bottling: ['create', 'read', 'update'],
    pos: ['create', 'read', 'update', 'delete'],
    dilution: ['create', 'read'],
    reports: ['read'],
  },
  production_manager: {
    formulas: ['create', 'read', 'update'],
    batches: ['create', 'read', 'update'],
    bottling: ['create', 'read', 'update'],
    dilution: ['create', 'read'],
    raw_materials: ['read'],
    reports: ['read'],
  },
  inventory_manager: {
    raw_materials: ['create', 'read', 'update'],
    suppliers: ['create', 'read', 'update'],
    purchases: ['create', 'read', 'update'],
    // Note: Purchase approval is strictly Admin only
    bottling: ['read'],
    batches: ['read'],
    reports: ['read'],
  },
  sales_staff: {
    pos: ['create', 'read'],
    raw_materials: [], // No access to secret formulas/raw oils
    formulas: [], // No access
    batches: [], // No access
    reports: ['read'], // Can only view own cashier/daily shift
  },
};

export function hasPermission(
  role: UserRole,
  resource: AppResource,
  action: Action,
): boolean {
  if (role === 'admin') return true;
  const allowedActions = ROLE_PERMISSIONS[role]?.[resource];
  return allowedActions ? allowedActions.includes(action) : false;
}
