import { Decimal } from 'decimal.js';
import { supabaseAdmin } from '../config/supabase.js';
import { BatchService } from './batch.service.js';
import { BottlingService } from './bottling.service.js';

export interface Customer {
  id: string;
  branch_id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  loyalty_points: string;
  created_at: string;
  updated_at: string;
}

export interface SaleItemInput {
  item_type: 'bottled' | 'decant';
  variant_id?: string;
  batch_id?: string;
  lot_id?: string;
  item_name?: string;
  quantity: number | string;
  unit_price: number | string;
  line_discount?: number | string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  item_type: 'bottled' | 'decant';
  variant_id?: string;
  batch_id?: string;
  lot_id?: string;
  item_name: string;
  quantity: string;
  unit_price: string;
  unit_cost_snapshot: string;
  line_subtotal: string;
  line_discount: string;
  line_total: string;
  profit: string;
  created_at: string;
}

export interface PaymentInput {
  payment_method: 'cash' | 'card' | 'bank_transfer' | 'split';
  amount: number | string;
  reference_code?: string;
}

export interface Payment {
  id: string;
  sale_id: string;
  payment_method: 'cash' | 'card' | 'bank_transfer' | 'split';
  amount: string;
  reference_code?: string;
  created_at: string;
}

export interface Sale {
  id: string;
  branch_id: string;
  invoice_number: string;
  customer_id?: string;
  customer_name?: string;
  cashier_id?: string;
  cashier_name?: string;
  status: 'completed' | 'voided' | 'refunded';
  subtotal: string;
  discount_amount: string;
  tax_amount: string;
  total_amount: string;
  payment_method: 'cash' | 'card' | 'bank_transfer' | 'split';
  payment_status: string;
  notes?: string;
  void_reason?: string;
  voided_at?: string;
  voided_by?: string;
  created_at: string;
  updated_at: string;
  items?: SaleItem[];
  payments?: Payment[];
  total_profit?: string;
}

// In-Memory Storage for fallback and testing
let memoryCustomers: Customer[] = [
  {
    id: 'cust-00000001-0000-0000-0000-000000000001',
    branch_id: '00000000-0000-0000-0000-000000000001',
    name: 'Sheikh Mansoor Al-Thani',
    phone: '+971 50 123 4567',
    email: 'm.althani@vip.ae',
    address: 'Palace Avenue, Dubai, UAE',
    notes: 'VIP Fragrance Collector. Prefers aged Cambodian Oud.',
    loyalty_points: '1250.0000',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cust-00000001-0000-0000-0000-000000000002',
    branch_id: '00000000-0000-0000-0000-000000000001',
    name: 'Princess Reem Al-Faisal',
    phone: '+966 55 987 6543',
    email: 'reem.alfaisal@vip.sa',
    address: 'Kingdom Tower, Riyadh, KSA',
    notes: 'Rose Damascena enthusiast.',
    loyalty_points: '850.0000',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

let memorySales: Sale[] = [];
let memorySaleItems: SaleItem[] = [];
let memoryPayments: Payment[] = [];

export class SalesService {
  /**
   * Get Customers
   */
  static async getCustomers(): Promise<{ data: Customer[]; total: number }> {
    if (process.env.NODE_ENV !== 'test') {
      try {
        const { data, error } = await supabaseAdmin
          .from('customers')
          .select('*')
          .is('deleted_at', null)
          .order('name');
        if (!error && data) return { data, total: data.length };
      } catch (_e) {
        // fallback
      }
    }
    return { data: [...memoryCustomers], total: memoryCustomers.length };
  }

  /**
   * Create Customer
   */
  static async createCustomer(
    data: { name: string; phone?: string; email?: string; address?: string; notes?: string },
    branchId = '00000000-0000-0000-0000-000000000001',
  ): Promise<Customer> {
    const newCust: Customer = {
      id: `cust-${Date.now()}`,
      branch_id: branchId,
      name: data.name,
      phone: data.phone,
      email: data.email,
      address: data.address,
      notes: data.notes,
      loyalty_points: '0.0000',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    memoryCustomers.unshift(newCust);
    return newCust;
  }

  /**
   * Create Sale (Atomic counter sale)
   */
  static async createSale(
    data: {
      customer_id?: string;
      items: SaleItemInput[];
      payments: PaymentInput[];
      discount_amount?: number | string;
      notes?: string;
    },
    cashierId = '11111111-1111-1111-1111-111111111111',
    branchId = '00000000-0000-0000-0000-000000000001',
  ): Promise<{ success: boolean; sale: Sale }> {
    if (!data.items || data.items.length === 0) {
      throw new Error('A sale must contain at least one line item.');
    }
    if (!data.payments || data.payments.length === 0) {
      throw new Error('A sale must contain at least one payment record.');
    }

    const discountAmountDec = new Decimal(data.discount_amount || 0);
    if (discountAmountDec.lt(0)) {
      throw new Error('Discount amount cannot be negative.');
    }

    // 1. Stock Validation Step (All-or-nothing check before deducting)
    for (const item of data.items) {
      const qtyDec = new Decimal(item.quantity);
      if (qtyDec.lte(0)) {
        throw new Error('Line item quantity must be greater than zero.');
      }

      if (item.item_type === 'bottled') {
        if (!item.lot_id) {
          throw new Error('Finished goods lot ID is required for bottled fragrance items.');
        }
        // Check lot stock
        const lots = await BottlingService.getFinishedGoodsLots();
        const lot = lots.data.find((l) => l.id === item.lot_id);
        if (!lot) {
          throw new Error(`Finished goods lot '${item.lot_id}' not found.`);
        }
        const availDec = new Decimal(lot.current_quantity);
        if (availDec.lt(qtyDec)) {
          throw new Error(
            `Insufficient stock in lot ${lot.lot_number}. Required: ${qtyDec.toFixed(0)}, Available: ${availDec.toFixed(0)}.`,
          );
        }
      } else if (item.item_type === 'decant') {
        if (!item.batch_id) {
          throw new Error('Batch ID is required for decant liquid sales.');
        }
        const batch = BatchService.getBatchByIdSync(item.batch_id);
        if (!batch) {
          throw new Error(`Bulk batch '${item.batch_id}' not found.`);
        }
        const availDec = new Decimal(batch.remaining_volume);
        if (availDec.lt(qtyDec)) {
          throw new Error(
            `Insufficient bulk liquid in batch ${batch.batch_code}. Required: ${qtyDec.toFixed(2)} ml, Available: ${availDec.toFixed(2)} ml.`,
          );
        }
      }
    }

    // 2. Process Line Items and Calculate Subtotal, Totals & Profits
    let subtotalDec = new Decimal(0);
    let totalProfitDec = new Decimal(0);
    const saleId = `sale-${Date.now()}`;
    const invoiceNum = `INV-2026-${String(memorySales.length + 1).padStart(5, '0')}`;
    const processedItems: SaleItem[] = [];

    for (const item of data.items) {
      const qtyDec = new Decimal(item.quantity);
      const unitPriceDec = new Decimal(item.unit_price);
      const lineDiscDec = new Decimal(item.line_discount || 0);
      const lineSubtotalDec = qtyDec.mul(unitPriceDec);
      const lineTotalDec = lineSubtotalDec.minus(lineDiscDec);
      subtotalDec = subtotalDec.add(lineSubtotalDec);

      let unitCostSnapshot = '0.0000';
      let itemName = item.item_name || 'Perfume Product';

      if (item.item_type === 'bottled') {
        const lots = await BottlingService.getFinishedGoodsLots();
        const lot = lots.data.find((l) => l.id === item.lot_id)!;
        unitCostSnapshot = lot.unit_cost;
        itemName = `${lot.product_name || 'Perfume'} (${lot.variant_sku || 'Flacon'})`;

        // Deduct lot stock
        BottlingService.deductFinishedGoodsLotSync(lot.id, qtyDec);
      } else if (item.item_type === 'decant') {
        const batch = BatchService.getBatchByIdSync(item.batch_id!)!;
        unitCostSnapshot = batch.cost_per_ml;
        itemName = `${batch.perfume_name} (Decant ${qtyDec.toFixed(1)} ml)`;

        // Deduct bulk liquid
        BatchService.deductBulkLiquidSync(batch.id, qtyDec);
      }

      // Profit = line_total - (quantity * unit_cost)
      const costOfGoodsDec = qtyDec.mul(new Decimal(unitCostSnapshot));
      const lineProfitDec = lineTotalDec.minus(costOfGoodsDec);
      totalProfitDec = totalProfitDec.add(lineProfitDec);

      const saleItem: SaleItem = {
        id: `si-${Date.now()}-${processedItems.length}`,
        sale_id: saleId,
        item_type: item.item_type,
        variant_id: item.variant_id,
        batch_id: item.batch_id,
        lot_id: item.lot_id,
        item_name: itemName,
        quantity: qtyDec.toFixed(4),
        unit_price: unitPriceDec.toFixed(4),
        unit_cost_snapshot: new Decimal(unitCostSnapshot).toFixed(4),
        line_subtotal: lineSubtotalDec.toFixed(4),
        line_discount: lineDiscDec.toFixed(4),
        line_total: lineTotalDec.toFixed(4),
        profit: lineProfitDec.toFixed(4),
        created_at: new Date().toISOString(),
      };

      processedItems.push(saleItem);
      memorySaleItems.push(saleItem);
    }

    // 3. Final Total
    const finalTotalDec = subtotalDec.minus(discountAmountDec);

    // 4. Process Payments
    const processedPayments: Payment[] = [];
    let paidAmountDec = new Decimal(0);

    for (const p of data.payments) {
      const amtDec = new Decimal(p.amount);
      paidAmountDec = paidAmountDec.add(amtDec);
      const payment: Payment = {
        id: `pay-${Date.now()}-${processedPayments.length}`,
        sale_id: saleId,
        payment_method: p.payment_method,
        amount: amtDec.toFixed(4),
        reference_code: p.reference_code,
        created_at: new Date().toISOString(),
      };
      processedPayments.push(payment);
      memoryPayments.push(payment);
    }

    const customer = memoryCustomers.find((c) => c.id === data.customer_id);

    // 5. Create Sale Record
    const primaryPaymentMethod = data.payments.length > 1 ? 'split' : data.payments[0]!.payment_method;
    const newSale: Sale = {
      id: saleId,
      branch_id: branchId,
      invoice_number: invoiceNum,
      customer_id: customer?.id,
      customer_name: customer?.name || 'Walk-in Guest',
      cashier_id: cashierId,
      cashier_name: 'Bilal Ahmad (Master Perfumer)',
      status: 'completed',
      subtotal: subtotalDec.toFixed(4),
      discount_amount: discountAmountDec.toFixed(4),
      tax_amount: '0.0000',
      total_amount: finalTotalDec.toFixed(4),
      payment_method: primaryPaymentMethod,
      payment_status: paidAmountDec.gte(finalTotalDec) ? 'paid' : 'partial',
      notes: data.notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: processedItems,
      payments: processedPayments,
      total_profit: totalProfitDec.toFixed(4),
    };

    memorySales.unshift(newSale);
    return { success: true, sale: newSale };
  }

  /**
   * Get Sales List
   */
  static async getSales(filters?: {
    status?: string;
    search?: string;
  }): Promise<{ data: Sale[]; total: number }> {
    let results = [...memorySales];

    if (filters?.status && filters.status !== 'all') {
      results = results.filter((s) => s.status === filters.status);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      results = results.filter(
        (s) =>
          s.invoice_number.toLowerCase().includes(q) ||
          (s.customer_name && s.customer_name.toLowerCase().includes(q)),
      );
    }

    return { data: results, total: results.length };
  }

  /**
   * Get Sale by ID
   */
  static async getSaleById(id: string): Promise<Sale | null> {
    const sale = memorySales.find((s) => s.id === id);
    if (!sale) return null;
    const items = memorySaleItems.filter((i) => i.sale_id === id);
    const payments = memoryPayments.filter((p) => p.sale_id === id);
    return { ...sale, items, payments };
  }

  /**
   * Void Sale (Restores inventory stocks with mandatory reason)
   */
  static async voidSale(
    saleId: string,
    reason: string,
    userId: string,
  ): Promise<{ success: boolean; sale: Sale }> {
    if (!reason || reason.trim().length === 0) {
      throw new Error('A mandatory audit reason is required to void an invoice.');
    }

    const sale = memorySales.find((s) => s.id === saleId);
    if (!sale) {
      throw new Error(`Sale with ID '${saleId}' not found.`);
    }

    if (sale.status === 'voided') {
      throw new Error(`Invoice ${sale.invoice_number} is already voided.`);
    }

    // Restore stock for each item
    const items = memorySaleItems.filter((i) => i.sale_id === saleId);
    for (const item of items) {
      const qtyDec = new Decimal(item.quantity);
      if (item.item_type === 'bottled' && item.lot_id) {
        // Re-credit lot stock
        const lots = await BottlingService.getFinishedGoodsLots();
        const lot = lots.data.find((l) => l.id === item.lot_id);
        if (lot) {
          lot.current_quantity = new Decimal(lot.current_quantity).add(qtyDec).toFixed(4);
        }
      } else if (item.item_type === 'decant' && item.batch_id) {
        // Re-credit bulk liquid
        const batch = BatchService.getBatchByIdSync(item.batch_id);
        if (batch) {
          batch.remaining_volume = new Decimal(batch.remaining_volume).add(qtyDec).toFixed(4);
        }
      }
    }

    sale.status = 'voided';
    sale.void_reason = reason.trim();
    sale.voided_at = new Date().toISOString();
    sale.voided_by = userId;
    sale.updated_at = new Date().toISOString();

    return { success: true, sale };
  }
}
