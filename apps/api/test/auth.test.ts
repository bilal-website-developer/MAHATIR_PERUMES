import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';
import { hasPermission } from '../src/config/permissions.js';

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

  it('GET /api/v1/users permits Admin but rejects unauthorized Sales Staff with 403', async () => {
    const server = app.listen(0);
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 4000;

    try {
      // 1. Unauthenticated request -> 401
      const resUnauth = await fetch(`http://127.0.0.1:${port}/api/v1/users`);
      expect(resUnauth.status).toBe(401);

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
