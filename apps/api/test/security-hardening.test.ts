import { describe, it, expect } from 'vitest';
import { ROLE_PERMISSIONS } from '../src/config/permissions.js';
import { InventoryService } from '../src/services/inventory.service.js';
import { BatchService } from '../src/services/batch.service.js';

describe('Phase 10: Security Hardening & Immutability Audit', () => {
  it('1. Role permission matrix enforces strict separation of duties', () => {
    // Admin has full resource permissions
    const adminPerms = ROLE_PERMISSIONS['admin'];
    expect(adminPerms).toBeDefined();
    expect(adminPerms.users).toContain('create');
    expect(adminPerms.users).toContain('delete');
    expect(adminPerms.audit_log).toContain('read');
    expect(adminPerms.purchase_approval).toContain('approve');
    expect(adminPerms.raw_materials).toContain('create');

    // Sales staff has POS access, but NO user management or raw material editing
    const salesPerms = ROLE_PERMISSIONS['sales_staff'];
    expect(salesPerms.pos).toContain('create');
    expect(salesPerms.users).toBeUndefined();
    expect(salesPerms.audit_log).toBeUndefined();
    expect(salesPerms.raw_materials?.length || 0).toBe(0);

    // Inventory manager cannot approve purchase orders or manage users
    const invPerms = ROLE_PERMISSIONS['inventory_manager'];
    expect(invPerms.raw_materials).toContain('create');
    expect(invPerms.purchases).toContain('create');
    expect(invPerms.users).toBeUndefined();
    expect(invPerms.purchase_approval).toBeUndefined();

    // Production manager can create formulas and batches but not manage users
    const prodPerms = ROLE_PERMISSIONS['production_manager'];
    expect(prodPerms.formulas).toContain('create');
    expect(prodPerms.batches).toContain('create');
    expect(prodPerms.users).toBeUndefined();
    expect(prodPerms.pos).toBeUndefined();
  });

  it('2. Immutability: confirmed purchases cannot be re-confirmed or double-credited', async () => {
    const suppliersRes = await InventoryService.getSuppliers();
    const materialsRes = await InventoryService.getRawMaterials({ activeOnly: true });

    expect(suppliersRes.data.length).toBeGreaterThan(0);
    expect(materialsRes.data.length).toBeGreaterThan(0);

    const supplier = suppliersRes.data[0];
    const material = materialsRes.data[0];

    const po = await InventoryService.createPurchaseOrder(
      {
        supplier_id: supplier.id,
        notes: 'Immutability Check PO',
        items: [
          {
            raw_material_id: material.id,
            quantity: 50,
            unit: material.base_unit,
            unit_cost: 10,
          },
        ],
      },
      'usr-test-admin',
    );

    // Submit and approve PO before confirmation
    await InventoryService.submitPurchaseOrder(po.id);
    await InventoryService.approvePurchaseOrder(po.id, 'usr-test-admin');

    // First confirmation succeeds
    const confirmedResult = await InventoryService.confirmPurchase(po.id, 'usr-test-admin');
    expect(confirmedResult.po.status).toBe('received');

    // Second confirmation attempt must fail due to immutability
    await expect(
      InventoryService.confirmPurchase(po.id, 'usr-test-admin'),
    ).rejects.toThrow(/already been confirmed and received/i);
  });

  it('3. Immutability: completed batches cannot be re-confirmed', async () => {
    const batchesRes = await BatchService.getBatches({});
    const completedBatch = batchesRes.data.find(
      (b) => b.status === 'bulk' || b.status === 'completed',
    );
    if (completedBatch) {
      await expect(
        BatchService.confirmBatch(
          completedBatch.id,
          completedBatch.actual_volume,
          '',
          'usr-test-admin',
        ),
      ).rejects.toThrow(/cannot be confirmed because status is/i);
    }
  });

  it('4. Input sanitization & mandatory justification for adjustments', async () => {
    const materialsRes = await InventoryService.getRawMaterials({ activeOnly: true });
    const targetMat = materialsRes.data[0];

    // Missing or too short reason must be rejected
    await expect(
      InventoryService.adjustStock(targetMat.id, 10, '   ', 'usr-test-admin'),
    ).rejects.toThrow(/mandatory reason/i);
  });
});
