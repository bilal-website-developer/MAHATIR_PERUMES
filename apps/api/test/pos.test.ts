import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import { SalesService } from '../src/services/sales.service.js';
import { BottlingService } from '../src/services/bottling.service.js';
import { BatchService } from '../src/services/batch.service.js';

describe('Phase 6: POS Sales System', () => {
  it('1. getCustomers and createCustomer operates correctly', async () => {
    const listBefore = await SalesService.getCustomers();
    expect(listBefore.data.length).toBeGreaterThanOrEqual(2);

    const newCust = await SalesService.createCustomer({
      name: 'Hassan Al-Zahrani',
      phone: '+971 52 999 8888',
      email: 'hassan@dubai.ae',
      notes: 'Collector of rare extraits',
    });

    expect(newCust.name).toBe('Hassan Al-Zahrani');
    expect(newCust.loyalty_points).toBe('0.0000');

    const listAfter = await SalesService.getCustomers();
    expect(listAfter.data.length).toBe(listBefore.data.length + 1);
  });

  it('2. Acceptance Criteria: Bottled item sale deducts lot stock and computes exact profit', async () => {
    // 1. Get available finished goods lot
    const lotsRes = await BottlingService.getFinishedGoodsLots();
    const lot = lotsRes.data[0];
    expect(lot).toBeDefined();

    const lotQtyBefore = new Decimal(lot!.current_quantity);
    const unitCost = new Decimal(lot!.unit_cost);
    const sellingPrice = new Decimal('295.0000');
    const saleQty = new Decimal(2); // Selling 2 bottles

    // Expected profit: (2 * 295) - (2 * unitCost)
    const expectedRevenue = saleQty.mul(sellingPrice);
    const expectedCost = saleQty.mul(unitCost);
    const expectedProfit = expectedRevenue.minus(expectedCost);

    // 2. Create Sale
    const result = await SalesService.createSale({
      customer_id: 'cust-00000001-0000-0000-0000-000000000001',
      items: [
        {
          item_type: 'bottled',
          lot_id: lot!.id,
          variant_id: lot!.variant_id,
          quantity: saleQty.toNumber(),
          unit_price: sellingPrice.toNumber(),
        },
      ],
      payments: [
        {
          payment_method: 'card',
          amount: expectedRevenue.toNumber(),
          reference_code: 'AUTH-TXN-98765',
        },
      ],
      notes: 'Counter sale with POS card terminal',
    });

    expect(result.success).toBe(true);
    const { sale } = result;

    expect(sale.invoice_number).toMatch(/^INV-2026-\d{5}$/);
    expect(sale.total_amount).toBe(expectedRevenue.toFixed(4));
    expect(sale.status).toBe('completed');
    expect(sale.payment_status).toBe('paid');

    // Verify profit calculation
    expect(sale.total_profit).toBe(expectedProfit.toFixed(4));

    // Verify lot stock was deducted by exactly 2
    const lotsAfter = await BottlingService.getFinishedGoodsLots();
    const lotAfter = lotsAfter.data.find((l) => l.id === lot!.id);
    expect(new Decimal(lotAfter!.current_quantity).toNumber()).toBe(lotQtyBefore.minus(2).toNumber());
  });

  it('3. Acceptance Criteria: Decant sale deducts exact bulk millilitres from batch inventory', async () => {
    const batch = BatchService.getBatchByIdSync('bat-00000001-0000-0000-0000-000000000001');
    expect(batch).toBeDefined();

    const bulkRemainingBefore = new Decimal(batch!.remaining_volume);
    const decantMl = new Decimal(25); // Dispense 25 ml
    const pricePerMl = new Decimal('18.5000');
    const costPerMl = new Decimal(batch!.cost_per_ml);

    const expectedRevenue = decantMl.mul(pricePerMl);
    const expectedCost = decantMl.mul(costPerMl);
    const expectedProfit = expectedRevenue.minus(expectedCost);

    // Create Decant Sale
    const result = await SalesService.createSale({
      items: [
        {
          item_type: 'decant',
          batch_id: batch!.id,
          quantity: decantMl.toNumber(),
          unit_price: pricePerMl.toNumber(),
        },
      ],
      payments: [
        {
          payment_method: 'cash',
          amount: expectedRevenue.toNumber(),
        },
      ],
      notes: 'Custom decant in luxury glass vial',
    });

    expect(result.success).toBe(true);
    const { sale } = result;

    expect(sale.total_amount).toBe(expectedRevenue.toFixed(4));
    expect(sale.total_profit).toBe(expectedProfit.toFixed(4));

    // Verify bulk volume deducted by 25 ml
    const batchAfter = BatchService.getBatchByIdSync('bat-00000001-0000-0000-0000-000000000001');
    expect(new Decimal(batchAfter!.remaining_volume).toNumber()).toBe(
      bulkRemainingBefore.minus(decantMl).toNumber(),
    );
  });

  it('4. Concurrency & Oversell Protection: Sale cannot oversell lot stock or bulk liquid', async () => {
    const lotsRes = await BottlingService.getFinishedGoodsLots();
    const lot = lotsRes.data[0];

    // Attempt to sell 999,999 bottles
    await expect(
      SalesService.createSale({
        items: [
          {
            item_type: 'bottled',
            lot_id: lot!.id,
            variant_id: lot!.variant_id,
            quantity: 999999,
            unit_price: 295,
          },
        ],
        payments: [{ payment_method: 'cash', amount: 999999 * 295 }],
      }),
    ).rejects.toThrow(/Insufficient stock in lot/i);

    // Attempt to decant 999,999 ml
    await expect(
      SalesService.createSale({
        items: [
          {
            item_type: 'decant',
            batch_id: 'bat-00000001-0000-0000-0000-000000000001',
            quantity: 999999,
            unit_price: 20,
          },
        ],
        payments: [{ payment_method: 'cash', amount: 999999 * 20 }],
      }),
    ).rejects.toThrow(/Insufficient bulk liquid in batch/i);
  });

  it('5. Voiding an invoice restores inventory stocks and requires mandatory reason', async () => {
    const lotsRes = await BottlingService.getFinishedGoodsLots();
    const lot = lotsRes.data[0];
    const lotQtyBefore = new Decimal(lot!.current_quantity);

    // Create a sale of 1 bottle
    const { sale } = await SalesService.createSale({
      items: [
        {
          item_type: 'bottled',
          lot_id: lot!.id,
          variant_id: lot!.variant_id,
          quantity: 1,
          unit_price: 295,
        },
      ],
      payments: [{ payment_method: 'cash', amount: 295 }],
    });

    const lotQtyAfterSale = new Decimal(
      (await BottlingService.getFinishedGoodsLots()).data.find((l) => l.id === lot!.id)!.current_quantity,
    );
    expect(lotQtyAfterSale.toNumber()).toBe(lotQtyBefore.minus(1).toNumber());

    // Voiding without reason MUST fail
    await expect(SalesService.voidSale(sale.id, '', 'usr-admin')).rejects.toThrow(
      /A mandatory audit reason is required/,
    );

    // Void with valid reason
    const voidResult = await SalesService.voidSale(
      sale.id,
      'Customer changed mind before leaving the counter',
      'usr-admin',
    );
    expect(voidResult.sale.status).toBe('voided');
    expect(voidResult.sale.void_reason).toBe('Customer changed mind before leaving the counter');

    // Lot stock MUST be restored back to lotQtyBefore
    const lotQtyAfterVoid = new Decimal(
      (await BottlingService.getFinishedGoodsLots()).data.find((l) => l.id === lot!.id)!.current_quantity,
    );
    expect(lotQtyAfterVoid.toNumber()).toBe(lotQtyBefore.toNumber());
  });
});
