import { describe, it, expect, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { hasPermission } from '../src/config/permissions.js';
import { supabaseAdmin } from '../src/config/supabase.js';
import { InventoryService } from '../src/services/inventory.service.js';
import { isDemoAuthEnabled, loadAuthenticatedUserProfile } from '../src/middleware/auth.js';

describe('Phase 1: Authentication, Roles, Permissions and Audit', () => {
  const app = createApp();

  it('Permission Matrix correctly permits and denies roles based on Master Plan', () => {
    // Admin has access to everything
    expect(hasPermission('admin', 'users', 'create')).toBe(true);
    expect(hasPermission('admin', 'purchases', 'approve')).toBe(true);

    // Production Manager can manage formulas and batches, but cannot manage users or approve purchases
    expect(hasPermission('production_manager', 'formulas', 'create')).toBe(true);
    expect(hasPermission('production_manager', 'batches', 'create')).toBe(true);
    expect(hasPermission('production_manager', 'users', 'create')).toBe(false);
    expect(hasPermission('production_manager', 'purchases', 'approve')).toBe(false);

    // Inventory Manager can create raw materials and POs, but cannot approve purchases or edit formulas
    expect(hasPermission('inventory_manager', 'raw_materials', 'create')).toBe(true);
    expect(hasPermission('inventory_manager', 'purchases', 'create')).toBe(true);
    expect(hasPermission('inventory_manager', 'purchases', 'approve')).toBe(false);
    expect(hasPermission('inventory_manager', 'formulas', 'create')).toBe(false);

    // Sales staff has POS access, but no raw materials or formulas access
    expect(hasPermission('sales_staff', 'pos', 'create')).toBe(true);
    expect(hasPermission('sales_staff', 'formulas', 'read')).toBe(false);
    expect(hasPermission('sales_staff', 'raw_materials', 'read')).toBe(false);
  });

  it('disables built-in demo authentication in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(isDemoAuthEnabled()).toBe(false);
    vi.unstubAllEnvs();
  });

  it('returns a specific JSON error when a protected request has no authorization header', async () => {
    const server = app.listen(0);
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 4000;

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/users`);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toMatchObject({
        code: 'MISSING_AUTHORIZATION',
        message: 'Authorization header is required.',
      });
    } finally {
      server.close();
    }
  });

  it('returns a specific JSON error when Supabase rejects a bearer token', async () => {
    const getUserSpy = vi.spyOn(supabaseAdmin.auth, 'getUser').mockResolvedValue({
      data: { user: null },
      error: {
        name: 'AuthApiError',
        message: 'Invalid JWT',
        status: 401,
        code: 'bad_jwt',
      },
    } as never);
    const server = app.listen(0);
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 4000;

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/users`, {
        headers: { Authorization: 'Bearer invalid-test-token' },
      });
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toMatchObject({ code: 'INVALID_OR_FOREIGN_TOKEN' });
      expect(body.error.message).toContain('different Supabase project');
    } finally {
      getUserSpy.mockRestore();
      server.close();
    }
  });

  it('does not fall back to sales staff when the profile lookup fails', async () => {
    const fromSpy = vi.spyOn(supabaseAdmin, 'from').mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: null,
            error: { code: 'PGRST301', message: 'Invalid service key' },
          }),
        }),
      }),
    } as never);

    try {
      const result = await loadAuthenticatedUserProfile({
        id: '55555555-5555-5555-5555-555555555555',
        email: 'admin@example.com',
      });

      expect(result.user).toBeUndefined();
      expect(result.error).toMatchObject({
        status: 503,
        code: 'PROFILE_LOOKUP_FAILED',
      });
    } finally {
      fromSpy.mockRestore();
    }
  });

  it('POST /api/v1/auth/login succeeds for demo admin credentials and returns user and token', async () => {
    const server = app.listen(0);
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 4000;

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@mahatir.com',
          password: 'password123',
        }),
      });

      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.data).toHaveProperty('token', 'demo-admin');
      expect(body.data.user).toHaveProperty('role', 'admin');
      expect(body.data).toHaveProperty('permissions');
    } finally {
      server.close();
    }
  });

  it('POST /api/v1/users/clear-demo-data clears memory fixtures after a successful database cleanup', async () => {
    const rpcSpy = vi.spyOn(supabaseAdmin, 'rpc').mockResolvedValue({
      data: { cleared: true, already_cleared: false },
      error: null,
    } as never);
    const server = app.listen(0);
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 4000;

    try {
      const before = await InventoryService.getRawMaterials({ activeOnly: true });
      expect(before.data.some((material) => material.id.includes('00000001'))).toBe(true);

      const response = await fetch(`http://127.0.0.1:${port}/api/v1/users/clear-demo-data`, {
        method: 'POST',
        headers: { Authorization: 'Bearer demo-admin' },
      });
      const body = await response.json();
      const after = await InventoryService.getRawMaterials({ activeOnly: true });

      expect(response.status).toBe(200);
      expect(body.data.memory_fallback_cleared).toBe(true);
      expect(after.data.some((material) => material.id.includes('00000001'))).toBe(false);
    } finally {
      rpcSpy.mockRestore();
      server.close();
    }
  });

  it('GET /api/v1/users permits Admin but rejects unauthorized Sales Staff with 403', async () => {
    const server = app.listen(0);
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 4000;

    try {
      // 1. Unauthenticated request -> 401
      const resUnauth = await fetch(`http://127.0.0.1:${port}/api/v1/users`);
      expect(resUnauth.status).toBe(401);
      const unauthBody = await resUnauth.json();
      expect(unauthBody.error.code).toBe('MISSING_AUTHORIZATION');

      // 2. Sales staff request -> 403 Forbidden
      const resSales = await fetch(`http://127.0.0.1:${port}/api/v1/users`, {
        headers: { Authorization: 'Bearer demo-sales' },
      });
      expect(resSales.status).toBe(403);

      // 3. Admin request -> 200 OK
      const resAdmin = await fetch(`http://127.0.0.1:${port}/api/v1/users`, {
        headers: { Authorization: 'Bearer demo-admin' },
      });
      const bodyAdmin = await resAdmin.json();
      expect(resAdmin.status).toBe(200);
      expect(Array.isArray(bodyAdmin.data)).toBe(true);
      expect(bodyAdmin.data.length).toBeGreaterThan(0);
    } finally {
      server.close();
    }
  });

  it('GET /api/v1/audit-log permits Admin and rejects other roles', async () => {
    const server = app.listen(0);
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 4000;

    try {
      // Non-admin request -> 403 Forbidden
      const resProduction = await fetch(`http://127.0.0.1:${port}/api/v1/audit-log`, {
        headers: { Authorization: 'Bearer demo-production' },
      });
      expect(resProduction.status).toBe(403);

      // Admin request -> 200 OK
      const resAdmin = await fetch(`http://127.0.0.1:${port}/api/v1/audit-log`, {
        headers: { Authorization: 'Bearer demo-admin' },
      });
      const body = await resAdmin.json();
      expect(resAdmin.status).toBe(200);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.data[0]).toHaveProperty('table_name');
      expect(body.data[0]).toHaveProperty('action');
    } finally {
      server.close();
    }
  });
});
