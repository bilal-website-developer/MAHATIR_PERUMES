import { Decimal } from 'decimal.js';
import { supabaseAdmin } from '../config/supabase.js';

export interface RawMaterial {
  id: string;
  branch_id: string;
  name: string;
  sku: string;
  category: 'oil' | 'alcohol' | 'fixative' | 'packaging';
  base_unit: string;
  secondary_unit?: string;
  conversion_rate: string; // numeric string e.g. "1000.0000"
  cost_per_unit: string; // weighted average cost in base_unit
  min_stock_level: string;
  current_stock: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  branch_id: string;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  payment_terms: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  raw_material_id: string;
  raw_material_name?: string;
  quantity: string;
  unit: string;
  unit_cost: string;
  line_total: string;
  converted_quantity: string;
  converted_unit_cost: string;
}

export interface PurchaseOrder {
  id: string;
  branch_id: string;
  po_number: string;
  supplier_id: string;
  supplier_name?: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'received' | 'cancelled';
  total_amount: string;
  notes?: string;
  rejection_reason?: string;
  approved_by?: string;
  approved_at?: string;
  received_at?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  items?: PurchaseOrderItem[];
}

export interface StockMovement {
  id: string;
  branch_id: string;
  item_type: string;
  item_id: string;
  item_name?: string;
  quantity: string;
  unit: string;
  unit_cost: string;
  total_cost: string;
  reference_type: 'purchase_receive' | 'stock_adjustment' | 'batch_consumption' | 'bottling_consumption' | 'sale' | 'return';
  reference_id?: string;
  reason?: string;
  user_id?: string;
  created_at: string;
}

// Initial realistic perfume raw materials
let memoryRawMaterials: RawMaterial[] = [
  {
    id: 'rm-00000001-0000-0000-0000-000000000001',
    branch_id: '00000000-0000-0000-0000-000000000001',
    name: 'Cambodian Agarwood (Oud) Oil Super Grade',
    sku: 'RM-OIL-OUD-01',
    category: 'oil',
    base_unit: 'ml',
    secondary_unit: 'l',
    conversion_rate: '1000.0000',
    cost_per_unit: '45.0000', // PKR 45/ml
    min_stock_level: '500.0000',
    current_stock: '2500.0000', // 2.5 L
    is_active: true,
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 10).toISOString(),
  },
  {
    id: 'rm-00000001-0000-0000-0000-000000000002',
    branch_id: '00000000-0000-0000-0000-000000000001',
    name: 'Rose Damascena Absolute Grade A',
    sku: 'RM-OIL-ROSE-02',
    category: 'oil',
    base_unit: 'ml',
    secondary_unit: 'l',
    conversion_rate: '1000.0000',
    cost_per_unit: '28.5000',
    min_stock_level: '300.0000',
    current_stock: '150.0000', // Low stock! (150 < 300)
    is_active: true,
    created_at: new Date(Date.now() - 86400000 * 9).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 9).toISOString(),
  },
  {
    id: 'rm-00000001-0000-0000-0000-000000000003',
    branch_id: '00000000-0000-0000-0000-000000000001',
    name: 'Perfume Grade Denatured Ethanol 96% Pure',
    sku: 'RM-ALC-ETH-01',
    category: 'alcohol',
    base_unit: 'ml',
    secondary_unit: 'l',
    conversion_rate: '1000.0000',
    cost_per_unit: '0.0180', // PKR 18 per Litre -> PKR 0.018 per ml
    min_stock_level: '10000.0000',
    current_stock: '45000.0000', // 45 Litres
    is_active: true,
    created_at: new Date(Date.now() - 86400000 * 8).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 8).toISOString(),
  },
  {
    id: 'rm-00000001-0000-0000-0000-000000000004',
    branch_id: '00000000-0000-0000-0000-000000000001',
    name: 'Ambroxan Pure Crystals Fixative',
    sku: 'RM-FIX-AMB-01',
    category: 'fixative',
    base_unit: 'g',
    secondary_unit: 'kg',
    conversion_rate: '1000.0000',
    cost_per_unit: '1.2000', // PKR 1.20 per gram
    min_stock_level: '250.0000',
    current_stock: '1200.0000', // 1.2 kg
    is_active: true,
    created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
  {
    id: 'rm-00000001-0000-0000-0000-000000000005',
    branch_id: '00000000-0000-0000-0000-000000000001',
    name: '50ml Heavy Flacon Glass Bottle',
    sku: 'RM-PKG-BTL-50',
    category: 'packaging',
    base_unit: 'pcs',
    conversion_rate: '1.0000',
    cost_per_unit: '3.5000', // PKR 3.50 each
    min_stock_level: '200.0000',
    current_stock: '850.0000',
    is_active: true,
    created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 6).toISOString(),
  },
  {
    id: 'rm-00000001-0000-0000-0000-000000000006',
    branch_id: '00000000-0000-0000-0000-000000000001',
    name: 'Gold Magnetic Flacon Cap 50ml',
    sku: 'RM-PKG-CAP-50',
    category: 'packaging',
    base_unit: 'pcs',
    conversion_rate: '1.0000',
    cost_per_unit: '1.2000', // PKR 1.20 each
    min_stock_level: '250.0000',
    current_stock: '1200.0000',
    is_active: true,
    created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 6).toISOString(),
  },
  {
    id: 'rm-00000001-0000-0000-0000-000000000007',
    branch_id: '00000000-0000-0000-0000-000000000001',
    name: 'Velvet Soft-Touch Foil Label 50ml',
    sku: 'RM-PKG-LBL-50',
    category: 'packaging',
    base_unit: 'pcs',
    conversion_rate: '1.0000',
    cost_per_unit: '0.4500', // PKR 0.45 each
    min_stock_level: '500.0000',
    current_stock: '2500.0000',
    is_active: true,
    created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 6).toISOString(),
  },
  {
    id: 'rm-00000001-0000-0000-0000-000000000008',
    branch_id: '00000000-0000-0000-0000-000000000001',
    name: 'Embossed Rigid Presentation Box 50ml',
    sku: 'RM-PKG-BOX-50',
    category: 'packaging',
    base_unit: 'pcs',
    conversion_rate: '1.0000',
    cost_per_unit: '2.8000', // PKR 2.80 each
    min_stock_level: '150.0000',
    current_stock: '900.0000',
    is_active: true,
    created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 6).toISOString(),
  },
  {
    id: 'rm-00000001-0000-0000-0000-000000000009',
    branch_id: '00000000-0000-0000-0000-000000000001',
    name: '100ml Grand Prestige Flacon Bottle & Box Set',
    sku: 'RM-PKG-BTL-100',
    category: 'packaging',
    base_unit: 'pcs',
    conversion_rate: '1.0000',
    cost_per_unit: '7.5000', // PKR 7.50 each
    min_stock_level: '100.0000',
    current_stock: '450.0000',
    is_active: true,
    created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 6).toISOString(),
  },
];

let memorySuppliers: Supplier[] = [
  {
    id: 'sup-00000001-0000-0000-0000-000000000001',
    branch_id: '00000000-0000-0000-0000-000000000001',
    name: 'Grasse Natural Oils & Absolutes SAS',
    contact_person: 'Jean-Luc Dupont',
    email: 'orders@grassenaturals.fr',
    phone: '+33 4 93 36 00 11',
    address: 'Route des Arômes, Grasse, France',
    payment_terms: 'Net 30',
    is_active: true,
    created_at: new Date(Date.now() - 86400000 * 15).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 15).toISOString(),
  },
  {
    id: 'sup-00000001-0000-0000-0000-000000000002',
    branch_id: '00000000-0000-0000-0000-000000000001',
    name: 'Royal Oud Distilleries Southeast Asia',
    contact_person: 'Somchai Prasert',
    email: 'tariq@royaloud.co.th',
    phone: '+66 2 555 0192',
    address: 'Trat Province Plantation Estate, Thailand',
    payment_terms: 'Advance 50% / Net 15',
    is_active: true,
    created_at: new Date(Date.now() - 86400000 * 14).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 14).toISOString(),
  },
  {
    id: 'sup-00000001-0000-0000-0000-000000000003',
    branch_id: '00000000-0000-0000-0000-000000000001',
    name: 'Verrerie Luxe Packaging Italia',
    contact_person: 'Matteo Rossi',
    email: 'sales@verrerieluxe.it',
    phone: '+39 02 8901 2345',
    address: 'Via Montenapoleone 14, Milan, Italy',
    payment_terms: 'Net 60',
    is_active: true,
    created_at: new Date(Date.now() - 86400000 * 12).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 12).toISOString(),
  },
];

let memoryPurchaseOrders: PurchaseOrder[] = [
  {
    id: 'po-00000001-0000-0000-0000-000000000001',
    branch_id: '00000000-0000-0000-0000-000000000001',
    po_number: 'PO-2026-0001',
    supplier_id: 'sup-00000001-0000-0000-0000-000000000001',
    supplier_name: 'Grasse Natural Oils & Absolutes SAS',
    status: 'approved',
    total_amount: '14250.0000',
    notes: 'Urgent restock of Rose Damascena Absolute before spring production run.',
    created_by: 'usr-inventory_manager',
    approved_by: 'usr-admin',
    approved_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    items: [
      {
        id: 'poi-0001',
        purchase_order_id: 'po-00000001-0000-0000-0000-000000000001',
        raw_material_id: 'rm-00000001-0000-0000-0000-000000000002',
        raw_material_name: 'Rose Damascena Absolute Grade A',
        quantity: '0.5000', // 0.5 Litres
        unit: 'l',
        unit_cost: '28500.0000', // PKR 28,500/L
        line_total: '14250.0000',
        converted_quantity: '500.0000', // 500 ml
        converted_unit_cost: '28.5000', // PKR 28.50/ml
      },
    ],
  },
];

let memoryStockMovements: StockMovement[] = [
  {
    id: 'sm-00000001-0000-0000-0000-000000000001',
    branch_id: '00000000-0000-0000-0000-000000000001',
    item_type: 'raw_material',
    item_id: 'rm-00000001-0000-0000-0000-000000000001',
    item_name: 'Cambodian Agarwood (Oud) Oil Super Grade',
    quantity: '2500.0000',
    unit: 'ml',
    unit_cost: '45.0000',
    total_cost: '112500.0000',
    reference_type: 'purchase_receive',
    reference_id: 'init-seed',
    reason: 'Initial opening stock intake',
    user_id: '11111111-1111-1111-1111-111111111111',
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
  },
  {
    id: 'sm-00000001-0000-0000-0000-000000000002',
    branch_id: '00000000-0000-0000-0000-000000000001',
    item_type: 'raw_material',
    item_id: 'rm-00000001-0000-0000-0000-000000000002',
    item_name: 'Rose Damascena Absolute Grade A',
    quantity: '150.0000',
    unit: 'ml',
    unit_cost: '28.5000',
    total_cost: '4275.0000',
    reference_type: 'purchase_receive',
    reference_id: 'init-seed',
    reason: 'Initial opening stock intake',
    user_id: '11111111-1111-1111-1111-111111111111',
    created_at: new Date(Date.now() - 86400000 * 9).toISOString(),
  },
];

let poCounter = 2;

export class InventoryService {
  static clearDemoData(): void {
    const isSeeded = (id: string) => id.includes('00000001');
    memoryRawMaterials = memoryRawMaterials.filter((item) => !isSeeded(item.id));
    memorySuppliers = memorySuppliers.filter((item) => !isSeeded(item.id));
    memoryPurchaseOrders = memoryPurchaseOrders.filter((item) => !isSeeded(item.id));
    memoryStockMovements = memoryStockMovements.filter((item) => !isSeeded(item.id));
  }

  /**
   * Helper: calculate unit conversion using decimal.js
   */
  static convertToBaseUnit(
    qty: string | number,
    cost: string | number,
    unit: string,
    material: RawMaterial,
  ): { convertedQty: Decimal; convertedCost: Decimal; lineTotal: Decimal } {
    const quantity = new Decimal(qty);
    const unitCost = new Decimal(cost);
    const lineTotal = quantity.mul(unitCost);

    if (unit === material.base_unit) {
      return {
        convertedQty: quantity,
        convertedCost: unitCost,
        lineTotal,
      };
    }

    if (material.secondary_unit && unit === material.secondary_unit) {
      const convRate = new Decimal(material.conversion_rate || 1);
      const convertedQty = quantity.mul(convRate);
      const convertedCost = convRate.isZero() ? unitCost : unitCost.div(convRate);
      return {
        convertedQty,
        convertedCost,
        lineTotal,
      };
    }

    // Default fallback
    return {
      convertedQty: quantity,
      convertedCost: unitCost,
      lineTotal,
    };
  }

  /**
   * Helper: calculate weighted average cost using decimal.js
   * ((oldStock * oldCost) + (newQty * newCost)) / (oldStock + newQty)
   */
  static calculateWeightedAverageCost(
    oldStockStr: string,
    oldCostStr: string,
    incomingQtyStr: string,
    incomingCostStr: string,
  ): Decimal {
    const oldStock = new Decimal(oldStockStr || 0);
    const oldCost = new Decimal(oldCostStr || 0);
    const incomingQty = new Decimal(incomingQtyStr || 0);
    const incomingCost = new Decimal(incomingCostStr || 0);

    if (oldStock.lte(0)) {
      return incomingCost;
    }

    const totalStock = oldStock.plus(incomingQty);
    if (totalStock.isZero()) {
      return incomingCost;
    }

    const oldTotal = oldStock.mul(oldCost);
    const incomingTotal = incomingQty.mul(incomingCost);
    return oldTotal.plus(incomingTotal).div(totalStock);
  }

  // --- RAW MATERIALS ---
  static async getRawMaterials(filters?: {
    category?: string;
    lowStock?: boolean;
    search?: string;
  }): Promise<{ data: RawMaterial[]; total: number }> {
    if (process.env.NODE_ENV !== 'test') {
      try {
        let query = supabaseAdmin.from('raw_materials').select('*').is('deleted_at', null);

        if (filters?.category && filters.category !== 'all') {
          query = query.eq('category', filters.category);
        }
        if (filters?.search) {
          query = query.or(`name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%`);
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          let results = data as RawMaterial[];
          if (filters?.lowStock) {
            results = results.filter((rm) =>
              new Decimal(rm.current_stock).lte(new Decimal(rm.min_stock_level)),
            );
          }
          return { data: results, total: results.length };
        }
      } catch (_e) {
        // fallback to memory
      }
    }

    let results = [...memoryRawMaterials].filter((m) => m.is_active);
    if (filters?.category && filters.category !== 'all') {
      results = results.filter((m) => m.category === filters.category);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      results = results.filter(
        (m) => m.name.toLowerCase().includes(q) || m.sku.toLowerCase().includes(q),
      );
    }
    if (filters?.lowStock) {
      results = results.filter((m) =>
        new Decimal(m.current_stock).lte(new Decimal(m.min_stock_level)),
      );
    }

    return { data: results, total: results.length };
  }

  static async getRawMaterialById(id: string): Promise<RawMaterial | null> {
    const item = memoryRawMaterials.find((rm) => rm.id === id);
    return item || null;
  }

  static getMaterialByIdSync(id: string): RawMaterial | undefined {
    return memoryRawMaterials.find((rm) => rm.id === id);
  }

  static async createRawMaterial(data: Partial<RawMaterial>): Promise<RawMaterial> {
    const newMaterial: RawMaterial = {
      id: `rm-${Date.now()}`,
      branch_id: data.branch_id || '00000000-0000-0000-0000-000000000001',
      name: data.name!,
      sku: data.sku!,
      category: data.category || 'oil',
      base_unit: data.base_unit || 'ml',
      secondary_unit: data.secondary_unit,
      conversion_rate: new Decimal(data.conversion_rate || 1).toFixed(4),
      cost_per_unit: new Decimal(data.cost_per_unit || 0).toFixed(4),
      min_stock_level: new Decimal(data.min_stock_level || 0).toFixed(4),
      current_stock: new Decimal(data.current_stock || 0).toFixed(4),
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    memoryRawMaterials.unshift(newMaterial);

    // Initial stock movement if opening stock > 0
    if (new Decimal(newMaterial.current_stock).gt(0)) {
      memoryStockMovements.unshift({
        id: `sm-${Date.now()}`,
        branch_id: newMaterial.branch_id,
        item_type: 'raw_material',
        item_id: newMaterial.id,
        item_name: newMaterial.name,
        quantity: newMaterial.current_stock,
        unit: newMaterial.base_unit,
        unit_cost: newMaterial.cost_per_unit,
        total_cost: new Decimal(newMaterial.current_stock)
          .mul(new Decimal(newMaterial.cost_per_unit))
          .toFixed(4),
        reference_type: 'stock_adjustment',
        reason: 'Opening stock balance',
        created_at: new Date().toISOString(),
      });
    }

    return newMaterial;
  }

  static async updateRawMaterial(id: string, updates: Partial<RawMaterial>): Promise<RawMaterial> {
    const index = memoryRawMaterials.findIndex((m) => m.id === id);
    if (index === -1) {
      throw new Error(`Raw material not found: ${id}`);
    }

    const current = memoryRawMaterials[index];
    if (!current) {
      throw new Error(`Raw material not found: ${id}`);
    }

    const updated: RawMaterial = {
      id: current.id,
      branch_id: current.branch_id,
      name: updates.name ?? current.name,
      sku: updates.sku ?? current.sku,
      category: updates.category ?? current.category,
      base_unit: updates.base_unit ?? current.base_unit,
      secondary_unit: updates.secondary_unit ?? current.secondary_unit,
      conversion_rate: updates.conversion_rate
        ? new Decimal(updates.conversion_rate).toFixed(4)
        : current.conversion_rate,
      cost_per_unit: current.cost_per_unit,
      min_stock_level: updates.min_stock_level
        ? new Decimal(updates.min_stock_level).toFixed(4)
        : current.min_stock_level,
      current_stock: current.current_stock,
      is_active: updates.is_active ?? current.is_active,
      created_at: current.created_at,
      updated_at: new Date().toISOString(),
    };

    memoryRawMaterials[index] = updated;
    return updated;
  }

  static async deleteRawMaterial(id: string): Promise<boolean> {
    const index = memoryRawMaterials.findIndex((m) => m.id === id);
    if (index === -1) return false;
    const item = memoryRawMaterials[index];
    if (item) {
      item.is_active = false;
    }
    return true;
  }

  // --- SUPPLIERS ---
  static async getSuppliers(search?: string): Promise<{ data: Supplier[]; total: number }> {
    let results = memorySuppliers.filter((s) => s.is_active);
    if (search) {
      const q = search.toLowerCase();
      results = results.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.contact_person && s.contact_person.toLowerCase().includes(q)) ||
          (s.email && s.email.toLowerCase().includes(q)),
      );
    }
    return { data: results, total: results.length };
  }

  static async createSupplier(data: Partial<Supplier>): Promise<Supplier> {
    const newSupplier: Supplier = {
      id: `sup-${Date.now()}`,
      branch_id: data.branch_id || '00000000-0000-0000-0000-000000000001',
      name: data.name!,
      contact_person: data.contact_person || '',
      email: data.email || '',
      phone: data.phone || '',
      address: data.address || '',
      payment_terms: data.payment_terms || 'Net 30',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    memorySuppliers.unshift(newSupplier);
    return newSupplier;
  }

  static async updateSupplier(id: string, updates: Partial<Supplier>): Promise<Supplier> {
    const index = memorySuppliers.findIndex((s) => s.id === id);
    if (index === -1) throw new Error('Supplier not found');
    const current = memorySuppliers[index];
    if (!current) throw new Error('Supplier not found');

    const updated: Supplier = {
      id: current.id,
      branch_id: current.branch_id,
      name: updates.name ?? current.name,
      contact_person: updates.contact_person ?? current.contact_person,
      email: updates.email ?? current.email,
      phone: updates.phone ?? current.phone,
      address: updates.address ?? current.address,
      payment_terms: updates.payment_terms ?? current.payment_terms,
      is_active: updates.is_active ?? current.is_active,
      created_at: current.created_at,
      updated_at: new Date().toISOString(),
    };

    memorySuppliers[index] = updated;
    return updated;
  }

  // --- PURCHASE ORDERS ---
  static async getPurchaseOrders(filters: {
    status?: string;
    supplierId?: string;
    search?: string;
  }): Promise<{ data: PurchaseOrder[]; total: number }> {
    let results = [...memoryPurchaseOrders];
    if (filters.status && filters.status !== 'all') {
      results = results.filter((po) => po.status === filters.status);
    }
    if (filters.supplierId) {
      results = results.filter((po) => po.supplier_id === filters.supplierId);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      results = results.filter(
        (po) =>
          po.po_number.toLowerCase().includes(q) ||
          (po.supplier_name && po.supplier_name.toLowerCase().includes(q)),
      );
    }
    return { data: results, total: results.length };
  }

  static async getPurchaseOrderById(id: string): Promise<PurchaseOrder | null> {
    const po = memoryPurchaseOrders.find((p) => p.id === id);
    return po || null;
  }

  static async createPurchaseOrder(
    data: {
      supplier_id: string;
      notes?: string;
      items: Array<{
        raw_material_id: string;
        quantity: number | string;
        unit: string;
        unit_cost: number | string;
      }>;
    },
    userId: string,
  ): Promise<PurchaseOrder> {
    const supplier = memorySuppliers.find((s) => s.id === data.supplier_id);
    if (!supplier) throw new Error('Supplier not found');

    const poNumber = `PO-2026-${String(poCounter++).padStart(4, '0')}`;
    let totalAmount = new Decimal(0);

    const items: PurchaseOrderItem[] = data.items.map((item, idx) => {
      const material = memoryRawMaterials.find((rm) => rm.id === item.raw_material_id);
      if (!material) {
        throw new Error(`Raw material not found: ${item.raw_material_id}`);
      }

      const { convertedQty, convertedCost, lineTotal } = this.convertToBaseUnit(
        item.quantity,
        item.unit_cost,
        item.unit,
        material,
      );

      totalAmount = totalAmount.plus(lineTotal);

      return {
        id: `poi-${Date.now()}-${idx}`,
        purchase_order_id: '',
        raw_material_id: material.id,
        raw_material_name: material.name,
        quantity: new Decimal(item.quantity).toFixed(4),
        unit: item.unit,
        unit_cost: new Decimal(item.unit_cost).toFixed(4),
        line_total: lineTotal.toFixed(4),
        converted_quantity: convertedQty.toFixed(4),
        converted_unit_cost: convertedCost.toFixed(4),
      };
    });

    const newPO: PurchaseOrder = {
      id: `po-${Date.now()}`,
      branch_id: '00000000-0000-0000-0000-000000000001',
      po_number: poNumber,
      supplier_id: supplier.id,
      supplier_name: supplier.name,
      status: 'draft',
      total_amount: totalAmount.toFixed(4),
      notes: data.notes || '',
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items,
    };

    items.forEach((it) => (it.purchase_order_id = newPO.id));
    memoryPurchaseOrders.unshift(newPO);
    return newPO;
  }

  static async submitPurchaseOrder(id: string): Promise<PurchaseOrder> {
    const po = memoryPurchaseOrders.find((p) => p.id === id);
    if (!po) throw new Error('Purchase order not found');
    if (po.status !== 'draft') {
      throw new Error(`Cannot submit PO in status '${po.status}'. Must be in 'draft'.`);
    }
    po.status = 'pending_approval';
    po.updated_at = new Date().toISOString();
    return po;
  }

  static async approvePurchaseOrder(id: string, adminUserId: string): Promise<PurchaseOrder> {
    const po = memoryPurchaseOrders.find((p) => p.id === id);
    if (!po) throw new Error('Purchase order not found');
    if (po.status !== 'pending_approval') {
      throw new Error(`Cannot approve PO in status '${po.status}'. Must be 'pending_approval'.`);
    }
    po.status = 'approved';
    po.approved_by = adminUserId;
    po.approved_at = new Date().toISOString();
    po.updated_at = new Date().toISOString();
    return po;
  }

  static async rejectPurchaseOrder(id: string, reason: string): Promise<PurchaseOrder> {
    const po = memoryPurchaseOrders.find((p) => p.id === id);
    if (!po) throw new Error('Purchase order not found');
    if (po.status !== 'pending_approval') {
      throw new Error(`Cannot reject PO in status '${po.status}'. Must be 'pending_approval'.`);
    }
    if (!reason || reason.trim().length === 0) {
      throw new Error('Rejection reason is required.');
    }
    po.status = 'rejected';
    po.rejection_reason = reason.trim();
    po.updated_at = new Date().toISOString();
    return po;
  }

  /**
   * confirmPurchase:
   * Atomic RPC equivalent:
   * - Checks PO is approved
   * - Idempotency: rejects if already 'received'
   * - For each item:
   *     - records stock_movement
   *     - recalculates weighted average cost
   *     - increases raw material current_stock
   * - Stamps PO as 'received'
   */
  static async confirmPurchase(poId: string, userId: string): Promise<{ success: boolean; po: PurchaseOrder }> {
    const poIndex = memoryPurchaseOrders.findIndex((p) => p.id === poId);
    if (poIndex === -1) {
      throw new Error(`Purchase order with ID ${poId} not found.`);
    }

    const po = memoryPurchaseOrders[poIndex];
    if (!po) {
      throw new Error(`Purchase order with ID ${poId} not found.`);
    }

    // Idempotency check: Cannot confirm twice!
    if (po.status === 'received') {
      throw new Error(`Purchase order ${po.po_number} has already been confirmed and received.`);
    }

    if (po.status !== 'approved') {
      throw new Error(
        `Purchase order ${po.po_number} cannot be received because its status is '${po.status}', not 'approved'.`,
      );
    }

    // Process all items atomically
    const movements: StockMovement[] = [];

    for (const item of po.items || []) {
      const rmIndex = memoryRawMaterials.findIndex((rm) => rm.id === item.raw_material_id);
      if (rmIndex === -1) {
        throw new Error(`Raw material with ID ${item.raw_material_id} not found.`);
      }

      const rm = memoryRawMaterials[rmIndex];
      if (!rm) {
        throw new Error(`Raw material with ID ${item.raw_material_id} not found.`);
      }

      // Calculate new weighted average cost
      const newWac = this.calculateWeightedAverageCost(
        rm.current_stock,
        rm.cost_per_unit,
        item.converted_quantity,
        item.converted_unit_cost,
      );

      const newStock = new Decimal(rm.current_stock).plus(new Decimal(item.converted_quantity));

      // Create ledger movement
      const movement: StockMovement = {
        id: `sm-${Date.now()}-${item.id}`,
        branch_id: po.branch_id,
        item_type: 'raw_material',
        item_id: rm.id,
        item_name: rm.name,
        quantity: item.converted_quantity,
        unit: rm.base_unit,
        unit_cost: item.converted_unit_cost,
        total_cost: item.line_total,
        reference_type: 'purchase_receive',
        reference_id: po.id,
        reason: `PO confirmation: ${po.po_number}`,
        user_id: userId,
        created_at: new Date().toISOString(),
      };

      movements.push(movement);

      // Update raw material in memory
      memoryRawMaterials[rmIndex] = {
        id: rm.id,
        branch_id: rm.branch_id,
        name: rm.name,
        sku: rm.sku,
        category: rm.category,
        base_unit: rm.base_unit,
        secondary_unit: rm.secondary_unit,
        conversion_rate: rm.conversion_rate,
        min_stock_level: rm.min_stock_level,
        is_active: rm.is_active,
        created_at: rm.created_at,
        current_stock: newStock.toFixed(4),
        cost_per_unit: newWac.toFixed(4),
        updated_at: new Date().toISOString(),
      };
    }

    // Prepend stock movements
    memoryStockMovements.unshift(...movements);

    // Update PO status
    po.status = 'received';
    po.received_at = new Date().toISOString();
    po.updated_at = new Date().toISOString();

    return { success: true, po };
  }

  // --- STOCK ADJUSTMENT ---
  static async adjustStock(
    materialId: string,
    delta: number | string,
    reason: string,
    userId: string,
  ): Promise<{ success: boolean; material: RawMaterial; movement: StockMovement }> {
    if (!reason || reason.trim().length === 0) {
      throw new Error('Stock adjustment requires a mandatory reason.');
    }

    const deltaDec = new Decimal(delta);
    if (deltaDec.isZero()) {
      throw new Error('Stock adjustment delta cannot be zero.');
    }

    const rmIndex = memoryRawMaterials.findIndex((rm) => rm.id === materialId);
    if (rmIndex === -1) {
      throw new Error(`Raw material with ID ${materialId} not found.`);
    }

    const rm = memoryRawMaterials[rmIndex];
    if (!rm) {
      throw new Error(`Raw material with ID ${materialId} not found.`);
    }

    const currentStock = new Decimal(rm.current_stock);
    const newStock = currentStock.plus(deltaDec);

    // Negative stock constraint enforcement
    if (newStock.isNegative()) {
      throw new Error(
        `Insufficient stock for ${rm.name}: need ${deltaDec.abs().toString()} ${rm.base_unit}, available ${currentStock.toString()} ${rm.base_unit}.`,
      );
    }

    // Record ledger entry
    const movement: StockMovement = {
      id: `sm-${Date.now()}`,
      branch_id: rm.branch_id,
      item_type: 'raw_material',
      item_id: rm.id,
      item_name: rm.name,
      quantity: deltaDec.toFixed(4),
      unit: rm.base_unit,
      unit_cost: rm.cost_per_unit,
      total_cost: deltaDec.mul(new Decimal(rm.cost_per_unit)).abs().toFixed(4),
      reference_type: 'stock_adjustment',
      reason: reason.trim(),
      user_id: userId,
      created_at: new Date().toISOString(),
    };

    memoryStockMovements.unshift(movement);

    const updatedRm: RawMaterial = {
      id: rm.id,
      branch_id: rm.branch_id,
      name: rm.name,
      sku: rm.sku,
      category: rm.category,
      base_unit: rm.base_unit,
      secondary_unit: rm.secondary_unit,
      conversion_rate: rm.conversion_rate,
      cost_per_unit: rm.cost_per_unit,
      min_stock_level: rm.min_stock_level,
      is_active: rm.is_active,
      created_at: rm.created_at,
      current_stock: newStock.toFixed(4),
      updated_at: new Date().toISOString(),
    };

    memoryRawMaterials[rmIndex] = updatedRm;

    return { success: true, material: updatedRm, movement };
  }

  // --- STOCK MOVEMENTS LEDGER ---
  static async getStockMovements(filters: {
    materialId?: string;
    referenceType?: string;
  }): Promise<{ data: StockMovement[]; total: number }> {
    let results = [...memoryStockMovements];
    if (filters.materialId) {
      results = results.filter((sm) => sm.item_id === filters.materialId);
    }
    if (filters.referenceType && filters.referenceType !== 'all') {
      results = results.filter((sm) => sm.reference_type === filters.referenceType);
    }
    return { data: results, total: results.length };
  }
}
