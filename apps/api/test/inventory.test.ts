import { describe, it, expect, beforeEach } from 'vitest';
import { Decimal } from 'decimal.js';
import { InventoryService, RawMaterial } from '../src/services/inventory.service.js';

describe('Phase 2: Inventory & Purchasing Engine', () => {
  describe('Unit Conversion Logic', () => {
    it('accurately converts 5 L of Ethanol into 5000 ml base units', () => {
      const ethanolMaterial: RawMaterial = {
        id: 'rm-test-ethanol',
        branch_id: '00000000-0000-0000-0000-000000000001',
        name: 'Perfume Grade Denatured Ethanol 96%',
        sku: 'RM-ETH-01',
        category: 'alcohol',
        base_unit: 'ml',
        secondary_unit: 'l',
        conversion_rate: '1000.0000',
        cost_per_unit: '0.0180',
        min_stock_level: '10000.0000',
        current_stock: '45000.0000',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Buying 5 L at $18.00 per Litre
      const { convertedQty, convertedCost, lineTotal } = InventoryService.convertToBaseUnit(
        5,
        18,
        'l',
        ethanolMaterial,
      );

      expect(convertedQty.toNumber()).toBe(5000);
      expect(convertedCost.toNumber()).toBe(0.018); // $18 / 1000 ml = $0.018 per ml
      expect(lineTotal.toNumber()).toBe(90); // 5 L * $18 = $90
    });

    it('accurately converts 1.5 kg Ambroxan crystals into 1500 g base units', () => {
      const ambroxan: RawMaterial = {
        id: 'rm-test-ambroxan',
        branch_id: '00000000-0000-0000-0000-000000000001',
        name: 'Ambroxan Pure Crystals',
        sku: 'RM-AMB-01',
        category: 'fixative',
        base_unit: 'g',
        secondary_unit: 'kg',
        conversion_rate: '1000.0000',
        cost_per_unit: '1.2000',
        min_stock_level: '200.0000',
        current_stock: '500.0000',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Buying 1.5 kg at $1200 per kg
      const { convertedQty, convertedCost, lineTotal } = InventoryService.convertToBaseUnit(
        1.5,
        1200,
        'kg',
        ambroxan,
      );

      expect(convertedQty.toNumber()).toBe(1500);
      expect(convertedCost.toNumber()).toBe(1.2);
      expect(lineTotal.toNumber()).toBe(1800);
    });
  });

  describe('Weighted Average Cost (WAC) Formula', () => {
    it('correctly calculates weighted average cost when incoming stock has different price', () => {
      // Existing: 1000 ml @ $40.00/ml (Total value: $40,000)
      // Incoming: 500 ml @ $55.00/ml (Total value: $27,500)
      // New Total Stock: 1500 ml
      // Expected WAC: ($40,000 + $27,500) / 1500 = $67,500 / 1500 = $45.0000
      const newWac = InventoryService.calculateWeightedAverageCost(
        '1000.0000',
        '40.0000',
        '500.0000',
        '55.0000',
      );

      expect(newWac.toFixed(4)).toBe('45.0000');
    });

    it('sets WAC directly to incoming cost if starting stock was zero or negative', () => {
      const newWac = InventoryService.calculateWeightedAverageCost(
        '0.0000',
        '0.0000',
        '250.0000',
        '32.5000',
      );

      expect(newWac.toFixed(4)).toBe('32.5000');
    });
  });

  describe('Purchase Order Workflow & Double-Confirm Rejection', () => {
    it('creates, submits, approves, and confirms a PO, updating stock and ledger idempotently', async () => {
      // 1. Create a draft PO
      const po = await InventoryService.createPurchaseOrder(
        {
          supplier_id: 'sup-00000001-0000-0000-0000-000000000001',
          notes: 'Test PO for ethanol supply',
          items: [
            {
              raw_material_id: 'rm-00000001-0000-0000-0000-000000000003', // Ethanol (current_stock = 45000 ml)
              quantity: 5, // 5 Litres
              unit: 'l',
              unit_cost: 20, // $20/L -> $0.020/ml
            },
          ],
        },
        'usr-inventory',
      );

      expect(po.status).toBe('draft');
      expect(po.items?.[0].converted_quantity).toBe('5000.0000');

      // 2. Submit for approval
      const submitted = await InventoryService.submitPurchaseOrder(po.id);
      expect(submitted.status).toBe('pending_approval');

      // 3. Approve by Admin
      const approved = await InventoryService.approvePurchaseOrder(po.id, 'usr-admin');
      expect(approved.status).toBe('approved');
      expect(approved.approved_by).toBe('usr-admin');

      // 4. Confirm purchase (Stock increases by 5000 ml)
      const prevMaterial = await InventoryService.getRawMaterialById('rm-00000001-0000-0000-0000-000000000003');
      const prevStock = new Decimal(prevMaterial!.current_stock);

      const confirmResult = await InventoryService.confirmPurchase(po.id, 'usr-inventory');
      expect(confirmResult.success).toBe(true);
      expect(confirmResult.po.status).toBe('received');

      const updatedMaterial = await InventoryService.getRawMaterialById('rm-00000001-0000-0000-0000-000000000003');
      const newStock = new Decimal(updatedMaterial!.current_stock);
      expect(newStock.minus(prevStock).toNumber()).toBe(5000);

      // Verify it appears in the stock movements ledger
      const movements = await InventoryService.getStockMovements({ materialId: updatedMaterial!.id });
      const latest = movements.data[0];
      expect(latest.reference_type).toBe('purchase_receive');
      expect(latest.reference_id).toBe(po.id);
      expect(new Decimal(latest.quantity).toNumber()).toBe(5000);

      // 5. Idempotency test: Double confirmation MUST throw error
      await expect(InventoryService.confirmPurchase(po.id, 'usr-inventory')).rejects.toThrow(
        /already been confirmed and received/,
      );
    });
  });

  describe('Stock Adjustment & Negative Stock Prevention', () => {
    it('successfully adjusts stock upwards with a mandatory reason', async () => {
      const material = await InventoryService.getRawMaterialById('rm-00000001-0000-0000-0000-000000000001');
      const prevStock = new Decimal(material!.current_stock);

      const result = await InventoryService.adjustStock(
        material!.id,
        150,
        'Found extra bottle during monthly lab audit',
        'usr-inventory',
      );

      expect(result.success).toBe(true);
      expect(new Decimal(result.material.current_stock).toNumber()).toBe(prevStock.plus(150).toNumber());
      expect(result.movement.reason).toBe('Found extra bottle during monthly lab audit');
    });

    it('rejects stock adjustment if reason is empty or missing', async () => {
      const material = await InventoryService.getRawMaterialById('rm-00000001-0000-0000-0000-000000000001');

      await expect(
        InventoryService.adjustStock(material!.id, 50, '', 'usr-inventory'),
      ).rejects.toThrow(/mandatory reason/);
    });

    it('prevents negative stock and provides exact feedback message', async () => {
      const material = await InventoryService.getRawMaterialById('rm-00000001-0000-0000-0000-000000000001');
      const currentStock = new Decimal(material!.current_stock);

      // Attempt to deduct more than current stock
      const excessiveDeduction = currentStock.plus(100).negated().toNumber();

      await expect(
        InventoryService.adjustStock(
          material!.id,
          excessiveDeduction,
          'Accidental massive spill in lab',
          'usr-inventory',
        ),
      ).rejects.toThrow(/Insufficient stock for/);
    });
  });
});
