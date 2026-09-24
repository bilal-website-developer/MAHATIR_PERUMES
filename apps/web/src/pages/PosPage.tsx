import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  Building,
  CheckCircle2,
  Printer,
  Sparkles,
  Clock,
  AlertCircle,
  X,
  RefreshCw,
  Droplet,
  Split,
} from 'lucide-react';
import { apiClient } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Decimal } from 'decimal.js';

interface FinishedGoodsLot {
  id: string;
  variant_id: string;
  variant_name?: string;
  variant_sku?: string;
  product_name?: string;
  batch_id: string;
  batch_code?: string;
  lot_number: string;
  current_quantity: string;
  unit_cost: string;
  selling_price?: string;
}

interface BulkBatch {
  id: string;
  batch_code: string;
  perfume_name: string;
  remaining_volume: string;
  cost_per_ml: string;
  status: string;
}

interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  loyalty_points: string;
}

interface CartItem {
  cart_id: string;
  item_type: 'bottled' | 'decant';
  lot_id?: string;
  variant_id?: string;
  batch_id?: string;
  item_name: string;
  size_label: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  line_discount: number;
  max_available: number;
}

interface SaleRecord {
  id: string;
  invoice_number: string;
  customer_name?: string;
  status: 'completed' | 'voided';
  total_amount: string;
  total_profit?: string;
  payment_method: string;
  created_at: string;
  items?: {
    item_name: string;
    quantity: string;
    unit_price: string;
    line_total: string;
  }[];
}

export const PosPage: React.FC = () => {
  const { user } = useAuth();
  const [lots, setLots] = useState<FinishedGoodsLot[]>([]);
  const [batches, setBatches] = useState<BulkBatch[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salesHistory, setSalesHistory] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter / Category
  const [activeCategory, setActiveCategory] = useState<'all' | 'bottled' | 'decant'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [cartDiscount, setCartDiscount] = useState<string>('0');
  const [saleNotes, setSaleNotes] = useState('');

  // Decant Custom Tool State
  const [isDecantModalOpen, setIsDecantModalOpen] = useState(false);
  const [selectedDecantBatchId, setSelectedDecantBatchId] = useState('');
  const [decantVolumeMl, setDecantVolumeMl] = useState('10');
  const [decantPricePerMl, setDecantPricePerMl] = useState('18.50');

  // Checkout Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'bank_transfer' | 'split'>('cash');
  const [amountTendered, setAmountTendered] = useState<string>('');
  const [splitCashAmount, setSplitCashAmount] = useState<string>('');
  const [splitCardAmount, setSplitCardAmount] = useState<string>('');
  const [submittingSale, setSubmittingSale] = useState(false);

  // Success Receipt State
  const [completedSale, setCompletedSale] = useState<SaleRecord | null>(null);

  // Invoices History Drawer
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [voidingSaleId, setVoidingSaleId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidSubmitting, setVoidSubmitting] = useState(false);

  // Alerts
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [lotsRes, batchesRes, custRes, salesRes] = await Promise.all([
        apiClient<FinishedGoodsLot[]>('/api/v1/finished-goods'),
        apiClient<BulkBatch[]>('/api/v1/batches?status=bulk'),
        apiClient<Customer[]>('/api/v1/customers'),
        apiClient<SaleRecord[]>('/api/v1/sales'),
      ]);

      if (lotsRes.data) setLots(lotsRes.data);
      if (batchesRes.data) setBatches(batchesRes.data);
      if (custRes.data) setCustomers(custRes.data);
      if (salesRes.data) setSalesHistory(salesRes.data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load POS catalog data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Cart Calculations
  const subtotal = cart.reduce((acc, item) => {
    const lineTotal = new Decimal(item.quantity)
      .mul(new Decimal(item.unit_price))
      .minus(new Decimal(item.line_discount || 0));
    return acc.add(lineTotal);
  }, new Decimal(0));

  const discountDec = new Decimal(parseFloat(cartDiscount) || 0);
  const grandTotal = Decimal.max(0, subtotal.minus(discountDec));

  const totalCost = cart.reduce((acc, item) => {
    return acc.add(new Decimal(item.quantity).mul(new Decimal(item.unit_cost || 0)));
  }, new Decimal(0));
  const estimatedProfit = grandTotal.minus(totalCost);

  // Add Bottled SKU to Cart
  const handleAddBottledToCart = (lot: FinishedGoodsLot) => {
    setErrorMsg(null);
    const existing = cart.find((i) => i.lot_id === lot.id);
    const maxQty = parseFloat(lot.current_quantity) || 0;

    if (maxQty <= 0) {
      setErrorMsg(`Lot ${lot.lot_number} is out of stock.`);
      return;
    }

    if (existing) {
      if (existing.quantity + 1 > maxQty) {
        setErrorMsg(`Cannot add more: only ${maxQty} bottles available in this lot.`);
        return;
      }
      setCart(
        cart.map((i) =>
          i.cart_id === existing.cart_id ? { ...i, quantity: i.quantity + 1 } : i,
        ),
      );
    } else {
      const price = parseFloat(lot.selling_price || '295.00') || 295;
      const cost = parseFloat(lot.unit_cost) || 0;
      setCart([
        ...cart,
        {
          cart_id: `item-${Date.now()}-${Math.random()}`,
          item_type: 'bottled',
          lot_id: lot.id,
          variant_id: lot.variant_id,
          item_name: lot.product_name || 'Imperial Cambodi Oud',
          size_label: lot.variant_sku || '50ml Flacon',
          quantity: 1,
          unit_price: price,
          unit_cost: cost,
          line_discount: 0,
          max_available: maxQty,
        },
      ]);
    }
  };

  // Add Decant to Cart
  const handleAddDecantToCart = () => {
    setErrorMsg(null);
    const batch = batches.find((b) => b.id === selectedDecantBatchId);
    if (!batch) {
      setErrorMsg('Please select a valid bulk batch.');
      return;
    }

    const vol = parseFloat(decantVolumeMl) || 0;
    const pricePerMl = parseFloat(decantPricePerMl) || 0;
    const availableMl = parseFloat(batch.remaining_volume) || 0;

    if (vol <= 0) {
      setErrorMsg('Decant volume must be greater than zero.');
      return;
    }

    if (vol > availableMl) {
      setErrorMsg(`Insufficient bulk liquid: only ${availableMl.toFixed(1)} ml available in batch ${batch.batch_code}.`);
      return;
    }

    const costPerMl = parseFloat(batch.cost_per_ml) || 0;
    const lineCost = vol * costPerMl;

    setCart([
      ...cart,
      {
        cart_id: `decant-${Date.now()}`,
        item_type: 'decant',
        batch_id: batch.id,
        item_name: `${batch.perfume_name} (Decant)`,
        size_label: `${vol} ml Dispensed`,
        quantity: vol,
        unit_price: pricePerMl,
        unit_cost: lineCost / vol,
        line_discount: 0,
        max_available: availableMl,
      },
    ]);

    setIsDecantModalOpen(false);
    setSelectedDecantBatchId('');
    setDecantVolumeMl('10');
  };

  const handleUpdateQty = (cartId: string, delta: number) => {
    setCart(
      cart
        .map((item) => {
          if (item.cart_id === cartId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (newQty > item.max_available) {
              setErrorMsg(`Maximum available stock reached (${item.max_available}).`);
              return item;
            }
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[],
    );
  };

  const handleRemoveFromCart = (cartId: string) => {
    setCart(cart.filter((item) => item.cart_id !== cartId));
  };

  // Open Payment Dialog
  const handleOpenPayment = () => {
    if (cart.length === 0) return;
    setAmountTendered(grandTotal.toFixed(2));
    setSplitCashAmount((grandTotal.div(2)).toFixed(2));
    setSplitCardAmount((grandTotal.div(2)).toFixed(2));
    setIsPaymentModalOpen(true);
  };

  // Execute Sale Submission
  const handleCompleteSale = async () => {
    setSubmittingSale(true);
    setErrorMsg(null);

    try {
      // Build payments payload
      let paymentsPayload: any[] = [];
      if (paymentMethod === 'split') {
        const cAmt = parseFloat(splitCashAmount) || 0;
        const kAmt = parseFloat(splitCardAmount) || 0;
        paymentsPayload = [
          { payment_method: 'cash', amount: cAmt },
          { payment_method: 'card', amount: kAmt, reference_code: 'SPLIT-POS-CARD' },
        ];
      } else {
        paymentsPayload = [
          {
            payment_method: paymentMethod,
            amount: grandTotal.toNumber(),
            reference_code: paymentMethod === 'card' ? 'POS-TERM-AUTH' : undefined,
          },
        ];
      }

      // Build items payload
      const itemsPayload = cart.map((i) => ({
        item_type: i.item_type,
        variant_id: i.variant_id,
        lot_id: i.lot_id,
        batch_id: i.batch_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        line_discount: i.line_discount,
      }));

      const res = await apiClient<SaleRecord>('/api/v1/sales', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: selectedCustomerId || undefined,
          discount_amount: parseFloat(cartDiscount) || 0,
          notes: saleNotes || undefined,
          items: itemsPayload,
          payments: paymentsPayload,
        }),
      });

      if (res.data) {
        setCompletedSale(res.data);
        setIsPaymentModalOpen(false);
        setCart([]);
        setCartDiscount('0');
        setSaleNotes('');
        setSelectedCustomerId('');
        fetchData();
      } else if (res.error) {
        setErrorMsg(res.error.message || 'Failed to process sale.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Transaction failed.');
    } finally {
      setSubmittingSale(false);
    }
  };

  // Void Sale Handler
  const handleVoidSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidingSaleId || !voidReason.trim()) return;

    setVoidSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await apiClient<SaleRecord>(`/api/v1/sales/${voidingSaleId}/void`, {
        method: 'POST',
        body: JSON.stringify({ reason: voidReason.trim() }),
      });

      if (res.data) {
        setSuccessMsg(`Invoice ${res.data.invoice_number} voided and stocks restored to inventory.`);
        setVoidingSaleId(null);
        setVoidReason('');
        fetchData();
      } else if (res.error) {
        setErrorMsg(res.error.message);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to void invoice.');
    } finally {
      setVoidSubmitting(false);
    }
  };

  // Change Calculation
  const tenderedDec = new Decimal(parseFloat(amountTendered) || 0);
  const changeDue = tenderedDec.gt(grandTotal) ? tenderedDec.minus(grandTotal) : new Decimal(0);

  // Filtered Products / Lots
  const filteredLots = lots.filter((lot) => {
    const q = searchQuery.toLowerCase();
    const match =
      lot.lot_number.toLowerCase().includes(q) ||
      (lot.variant_sku && lot.variant_sku.toLowerCase().includes(q)) ||
      (lot.product_name && lot.product_name.toLowerCase().includes(q));
    if (activeCategory === 'decant') return false;
    return match;
  });

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-gold-400 uppercase tracking-widest mb-1">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Phase 6 • Luxury Boutique POS Counter</span>
          </div>
          <h1 className="text-2xl font-serif font-bold text-slate-100 flex items-center space-x-3">
            <span>Retail Point of Sale</span>
          </h1>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-3 py-2 bg-slate-800/80 hover:bg-slate-700/80 disabled:opacity-50 text-slate-300 rounded-lg text-xs font-medium border border-slate-700/60 flex items-center space-x-1.5 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-gold-400' : ''}`} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            onClick={() => setIsHistoryOpen(true)}
            className="px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 rounded-lg text-xs font-medium border border-slate-700/60 flex items-center space-x-1.5 transition-colors"
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Invoices History ({salesHistory.length})</span>
          </button>

          <button
            onClick={() => setIsDecantModalOpen(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-amber-600/30 to-gold-500/30 hover:from-amber-600/40 hover:to-gold-500/40 text-gold-300 rounded-lg text-xs font-semibold border border-gold-500/40 flex items-center space-x-1.5 transition-colors shadow-sm"
          >
            <Droplet className="h-3.5 w-3.5 text-gold-400" />
            <span>Quick Decant Dispenser</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main Grid: Products (2/3) + Cart (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Side: Product Browser (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-[#121622] p-3 rounded-xl border border-slate-800">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Scan barcode, enter SKU or perfume..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-gold-500/50"
              />
            </div>

            <div className="flex items-center space-x-1.5 w-full sm:w-auto">
              <button
                onClick={() => setActiveCategory('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeCategory === 'all'
                    ? 'bg-gold-500 text-slate-950 font-bold'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                All Products
              </button>
              <button
                onClick={() => setActiveCategory('bottled')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeCategory === 'bottled'
                    ? 'bg-gold-500 text-slate-950 font-bold'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                Bottled Flacons
              </button>
              <button
                onClick={() => setActiveCategory('decant')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeCategory === 'decant'
                    ? 'bg-gold-500 text-slate-950 font-bold'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                Decant Liquid
              </button>
            </div>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {activeCategory !== 'decant' &&
              filteredLots.map((lot) => {
                const stock = parseFloat(lot.current_quantity) || 0;
                return (
                  <div
                    key={lot.id}
                    onClick={() => stock > 0 && handleAddBottledToCart(lot)}
                    className={`bg-[#121622] border rounded-xl p-3.5 flex flex-col justify-between cursor-pointer select-none transition-all shadow-sm ${
                      stock > 0
                        ? 'border-slate-800/80 hover:border-gold-500/40 hover:bg-slate-800/20 active:scale-[0.98]'
                        : 'border-slate-800/40 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                        <span className="text-gold-400 font-semibold">{lot.variant_sku}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] ${
                            stock > 5
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-950/60 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {stock.toFixed(0)} left
                        </span>
                      </div>
                      <h4 className="font-serif font-bold text-slate-100 text-xs line-clamp-1">
                        {lot.product_name}
                      </h4>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">{lot.lot_number}</div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                      <span className="font-mono font-bold text-gold-300 text-sm">
                        ${parseFloat(lot.selling_price || '295').toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                        Add +
                      </span>
                    </div>
                  </div>
                );
              })}

            {/* Quick Decant Cards */}
            {(activeCategory === 'all' || activeCategory === 'decant') &&
              batches.map((batch) => {
                const availMl = parseFloat(batch.remaining_volume) || 0;
                return (
                  <div
                    key={batch.id}
                    onClick={() => {
                      setSelectedDecantBatchId(batch.id);
                      setIsDecantModalOpen(true);
                    }}
                    className="bg-[#121622] border border-amber-500/30 hover:border-gold-400/60 rounded-xl p-3.5 flex flex-col justify-between cursor-pointer select-none transition-all shadow-sm hover:bg-amber-950/10 active:scale-[0.98]"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-amber-400 mb-1">
                        <span className="flex items-center space-x-1">
                          <Droplet className="h-3 w-3" />
                          <span>Bulk Decant</span>
                        </span>
                        <span className="bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-500/30">
                          {availMl.toFixed(0)} ml
                        </span>
                      </div>
                      <h4 className="font-serif font-bold text-slate-100 text-xs line-clamp-1">
                        {batch.perfume_name}
                      </h4>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">{batch.batch_code}</div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                      <span className="font-mono text-xs text-gold-300 font-bold">
                        ${parseFloat(batch.cost_per_ml).toFixed(2)} / ml
                      </span>
                      <span className="text-[10px] text-gold-400 bg-gold-500/10 border border-gold-500/30 px-2 py-0.5 rounded">
                        Dispense ⚗️
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Right Side: Cart & Checkout (4 cols) */}
        <div className="lg:col-span-4 bg-[#121622] border border-slate-800 rounded-2xl p-4 shadow-xl space-y-4 sticky top-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <ShoppingCart className="h-4 w-4 text-gold-400" />
              <h3 className="font-serif font-bold text-slate-100 text-sm">Customer Order Cart</h3>
            </div>
            <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
              {cart.length} items
            </span>
          </div>

          {/* Customer Selection */}
          <div>
            <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">
              Select Customer
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-gold-500/50"
            >
              <option value="">-- Walk-in Boutique Guest --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ''} - {parseFloat(c.loyalty_points).toFixed(0)} pts
                </option>
              ))}
            </select>
          </div>

          {/* Cart Item List */}
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {cart.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Cart is empty. Click on a perfume bottle or decant to add.
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.cart_id}
                  className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-2.5 space-y-1.5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-200">{item.item_name}</div>
                      <div className="text-[10px] font-mono text-gold-400">{item.size_label}</div>
                    </div>
                    <button
                      onClick={() => handleRemoveFromCart(item.cart_id)}
                      className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => handleUpdateQty(item.cart_id, -1)}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="font-mono text-xs font-bold text-slate-100 px-1.5">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleUpdateQty(item.cart_id, 1)}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="text-right font-mono">
                      <div className="text-xs font-bold text-slate-100">
                        ${(item.quantity * item.unit_price).toFixed(2)}
                      </div>
                      <div className="text-[9px] text-slate-500">
                        ${item.unit_price.toFixed(2)} each
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Cart Summary & Discounts */}
          <div className="border-t border-slate-800 pt-3 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal</span>
              <span className="font-mono text-slate-200">${subtotal.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between text-slate-400">
              <span>Discount ($)</span>
              <input
                type="number"
                min="0"
                step="5"
                value={cartDiscount}
                onChange={(e) => setCartDiscount(e.target.value)}
                className="w-24 bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-right font-mono text-xs text-slate-200 focus:outline-none focus:border-gold-500/50"
              />
            </div>

            <div className="flex justify-between text-slate-400">
              <span>VAT / Tax (0%)</span>
              <span className="font-mono text-slate-200">$0.00</span>
            </div>

            <div className="border-t border-slate-800/80 pt-2 flex justify-between items-baseline">
              <span className="font-serif font-bold text-slate-100 text-sm">Total Due</span>
              <span className="font-serif font-bold text-gold-300 text-xl font-mono">
                ${grandTotal.toFixed(2)}
              </span>
            </div>

            {/* Staff Margin / Profit Preview */}
            {(user?.role === 'admin' || user?.role === 'production_manager') && (
              <div className="p-2 rounded bg-emerald-950/20 border border-emerald-500/20 flex justify-between text-[11px] text-emerald-400 font-mono">
                <span>Estimated Margin:</span>
                <span>+${estimatedProfit.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Checkout Button */}
          <button
            disabled={cart.length === 0}
            onClick={handleOpenPayment}
            className="w-full py-3 bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold rounded-xl text-xs tracking-wider uppercase flex items-center justify-center space-x-2 shadow-[0_0_20px_rgba(212,175,55,0.25)] transition-all"
          >
            <Banknote className="h-4 w-4" />
            <span>Pay & Complete Sale</span>
          </button>
        </div>
      </div>

      {/* Quick Decant Dispenser Modal */}
      {isDecantModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#121622] border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Droplet className="h-4 w-4 text-gold-400" />
                <h3 className="font-serif font-bold text-slate-100 text-base">Quick Decant Dispenser</h3>
              </div>
              <button
                onClick={() => setIsDecantModalOpen(false)}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Select Aged Bulk Batch *</label>
                <select
                  value={selectedDecantBatchId}
                  onChange={(e) => setSelectedDecantBatchId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-gold-500/50"
                >
                  <option value="">-- Choose Batch --</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.batch_code} - {b.perfume_name} ({parseFloat(b.remaining_volume).toFixed(1)} ml)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Volume to Dispense (ml) *</label>
                <div className="flex items-center space-x-2">
                  {['5', '10', '20', '30'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDecantVolumeMl(preset)}
                      className={`px-3 py-1 rounded border text-xs font-mono font-bold ${
                        decantVolumeMl === preset
                          ? 'bg-gold-500 text-slate-950 border-gold-400'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {preset} ml
                    </button>
                  ))}
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={decantVolumeMl}
                    onChange={(e) => setDecantVolumeMl(e.target.value)}
                    className="w-20 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-right font-mono text-xs text-slate-200 focus:outline-none focus:border-gold-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Selling Price per ml ($) *</label>
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  value={decantPricePerMl}
                  onChange={(e) => setDecantPricePerMl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 font-mono text-slate-200 focus:outline-none focus:border-gold-500/50"
                />
              </div>

              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-400">Total Decant Price:</span>
                <span className="font-mono font-bold text-gold-300 text-base">
                  ${((parseFloat(decantVolumeMl) || 0) * (parseFloat(decantPricePerMl) || 0)).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsDecantModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddDecantToCart}
                className="px-4 py-2 bg-gold-500 hover:bg-gold-400 text-slate-950 font-bold rounded-lg text-xs"
              >
                Add Decant to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Tender Dialog */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#121622] border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-serif font-bold text-slate-100 text-base flex items-center space-x-2">
                  <CreditCard className="h-4 w-4 text-gold-400" />
                  <span>Select Payment Tender</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Amount Due: ${grandTotal.toFixed(2)}</p>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`p-3 rounded-xl border flex flex-col items-center space-y-1.5 transition-all text-xs font-semibold ${
                  paymentMethod === 'cash'
                    ? 'bg-gold-500/15 border-gold-400 text-gold-300 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Banknote className="h-4 w-4" />
                <span>Cash</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`p-3 rounded-xl border flex flex-col items-center space-y-1.5 transition-all text-xs font-semibold ${
                  paymentMethod === 'card'
                    ? 'bg-gold-500/15 border-gold-400 text-gold-300 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <CreditCard className="h-4 w-4" />
                <span>Card</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('bank_transfer')}
                className={`p-3 rounded-xl border flex flex-col items-center space-y-1.5 transition-all text-xs font-semibold ${
                  paymentMethod === 'bank_transfer'
                    ? 'bg-gold-500/15 border-gold-400 text-gold-300 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Building className="h-4 w-4" />
                <span>Transfer</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('split')}
                className={`p-3 rounded-xl border flex flex-col items-center space-y-1.5 transition-all text-xs font-semibold ${
                  paymentMethod === 'split'
                    ? 'bg-gold-500/15 border-gold-400 text-gold-300 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Split className="h-4 w-4" />
                <span>Split</span>
              </button>
            </div>

            {/* Cash Tender Inputs */}
            {paymentMethod === 'cash' && (
              <div className="space-y-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Cash Tendered by Customer ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={amountTendered}
                    onChange={(e) => setAmountTendered(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 font-mono text-base font-bold text-slate-100 focus:outline-none focus:border-gold-500/50"
                  />
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-800/80 font-mono">
                  <span className="text-slate-400">Change Due to Customer:</span>
                  <span className="text-emerald-400 font-bold text-base">
                    ${changeDue.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Split Tender Inputs */}
            {paymentMethod === 'split' && (
              <div className="space-y-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Cash Part ($)</label>
                    <input
                      type="number"
                      min="0"
                      step="5"
                      value={splitCashAmount}
                      onChange={(e) => setSplitCashAmount(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Card Part ($)</label>
                    <input
                      type="number"
                      min="0"
                      step="5"
                      value={splitCardAmount}
                      onChange={(e) => setSplitCardAmount(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-slate-100"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
              >
                Back
              </button>
              <button
                type="button"
                disabled={submittingSale}
                onClick={handleCompleteSale}
                className="px-5 py-2 bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-slate-950 font-bold rounded-lg text-xs flex items-center space-x-1.5 shadow-[0_0_15px_rgba(212,175,55,0.2)]"
              >
                {submittingSale ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Deducting Stock & Printing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Confirm Sale & Print Receipt</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completed Sale / Thermal Receipt Modal */}
      {completedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#121622] border border-slate-800 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            {/* Printable Thermal Receipt Container */}
            <div className="bg-white text-slate-950 p-5 rounded-lg font-mono text-[11px] space-y-3 shadow-inner">
              <div className="text-center space-y-0.5 border-b border-dashed border-slate-300 pb-3">
                <div className="font-serif font-bold text-base tracking-widest">MAHATIR PERFUMES</div>
                <div className="text-[9px] uppercase tracking-wider text-slate-600">Haute Parfumerie & Extraits</div>
                <div className="text-[9px] text-slate-500">Dubai • Riyadh • London</div>
                <div className="text-[10px] font-bold mt-1 text-slate-800">
                  INVOICE: {completedSale.invoice_number}
                </div>
                <div className="text-[9px] text-slate-500">
                  {new Date(completedSale.created_at).toLocaleString()}
                </div>
              </div>

              <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3">
                {(completedSale.items || []).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start">
                    <div>
                      <div className="font-bold">{item.item_name}</div>
                      <div className="text-[9px] text-slate-600">
                        {item.quantity} x ${parseFloat(item.unit_price).toFixed(2)}
                      </div>
                    </div>
                    <div className="font-bold">${parseFloat(item.line_total).toFixed(2)}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-1 border-b border-dashed border-slate-300 pb-3 text-[11px]">
                <div className="flex justify-between font-bold text-xs">
                  <span>TOTAL PAID:</span>
                  <span>${parseFloat(completedSale.total_amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[9px] text-slate-600">
                  <span>Payment Tender:</span>
                  <span className="uppercase">{completedSale.payment_method}</span>
                </div>
              </div>

              <div className="text-center text-[9px] text-slate-500 pt-1">
                Thank you for choosing Mahatir Perfumes.
                <br />
                All bespoke perfumes are handcrafted.
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => window.print()}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs flex items-center space-x-1.5"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print Thermal Receipt</span>
              </button>
              <button
                onClick={() => setCompletedSale(null)}
                className="px-4 py-1.5 bg-gold-500 hover:bg-gold-400 text-slate-950 font-bold rounded-lg text-xs"
              >
                Done / Next Sale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoices History Drawer */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#121622] border-l border-slate-800 w-full max-w-xl h-full p-6 space-y-4 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-gold-400" />
                <h3 className="font-serif font-bold text-slate-100 text-base">Invoices History</h3>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              {salesHistory.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">No sales recorded yet.</div>
              ) : (
                salesHistory.map((s) => (
                  <div
                    key={s.id}
                    className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2 text-xs"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-mono font-bold text-gold-300">{s.invoice_number}</span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {s.customer_name || 'Walk-in Guest'} • {new Date(s.created_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-slate-100 text-sm">
                          ${parseFloat(s.total_amount).toFixed(2)}
                        </span>
                        <div>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                              s.status === 'completed'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-950 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {s.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    {user?.role === 'admin' && s.status === 'completed' && (
                      <div className="pt-2 border-t border-slate-800/60 flex justify-end">
                        <button
                          onClick={() => setVoidingSaleId(s.id)}
                          className="px-2.5 py-1 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-500/30 rounded text-[10px] font-semibold transition-colors"
                        >
                          Void & Restore Stock
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Void Invoice Confirmation Dialog */}
            {voidingSaleId && (
              <div className="p-4 bg-rose-950/30 border border-rose-500/40 rounded-xl space-y-3 mt-4 text-xs animate-in fade-in">
                <div className="font-bold text-rose-300">Void Invoice & Re-credit Stock</div>
                <p className="text-slate-400 text-[11px]">
                  All finished goods lots and bulk liquid deducted during this sale will be safely returned to inventory.
                </p>
                <input
                  type="text"
                  placeholder="Mandatory reason for voiding..."
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-rose-400"
                />
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => {
                      setVoidingSaleId(null);
                      setVoidReason('');
                    }}
                    className="px-3 py-1 bg-slate-800 text-slate-300 rounded text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!voidReason.trim() || voidSubmitting}
                    onClick={handleVoidSale}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded text-xs disabled:opacity-50"
                  >
                    {voidSubmitting ? 'Voiding...' : 'Confirm Void'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
