import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  PackageCheck,
  RefreshCw,
  X,
  AlertCircle,
  Building2,
  Trash2,
} from 'lucide-react';
import { apiClient } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Decimal } from 'decimal.js';

interface RawMaterial {
  id: string;
  name: string;
  sku: string;
  base_unit: string;
  secondary_unit?: string;
  conversion_rate: string;
  cost_per_unit: string;
  current_stock: string;
}

interface Supplier {
  id: string;
  name: string;
  payment_terms: string;
}

interface PurchaseOrderItem {
  id: string;
  raw_material_id: string;
  raw_material_name?: string;
  quantity: string;
  unit: string;
  unit_cost: string;
  line_total: string;
  converted_quantity: string;
  converted_unit_cost: string;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  supplier_name?: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'received' | 'cancelled';
  total_amount: string;
  notes?: string;
  rejection_reason?: string;
  approved_by?: string;
  created_at: string;
  received_at?: string;
  items?: PurchaseOrderItem[];
}

export const PurchaseOrdersPage: React.FC = () => {
  const { user } = useAuth();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Modals & Action States
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New PO State
  const [poSupplierId, setPoSupplierId] = useState('');
  const [poNotes, setPoNotes] = useState('');
  const [poLineItems, setPoLineItems] = useState<
    Array<{
      raw_material_id: string;
      quantity: string;
      unit: string;
      unit_cost: string;
    }>
  >([{ raw_material_id: '', quantity: '1', unit: 'ml', unit_cost: '0' }]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [poRes, supRes, matRes] = await Promise.all([
        apiClient<PurchaseOrder[]>('/api/v1/purchase-orders'),
        apiClient<Supplier[]>('/api/v1/suppliers'),
        apiClient<RawMaterial[]>('/api/v1/raw-materials'),
      ]);

      if (poRes.data) setPurchaseOrders(poRes.data);
      if (supRes.data) {
        setSuppliers(supRes.data);
        if (supRes.data.length > 0 && !poSupplierId) {
          setPoSupplierId(supRes.data[0].id);
        }
      }
      if (matRes.data) {
        setMaterials(matRes.data);
        if (matRes.data.length > 0 && !poLineItems[0].raw_material_id) {
          setPoLineItems([
            {
              raw_material_id: matRes.data[0].id,
              quantity: '1',
              unit: matRes.data[0].secondary_unit || matRes.data[0].base_unit,
              unit_cost: '20',
            },
          ]);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Calculate live PO total
  const calculateTotal = () => {
    return poLineItems.reduce((acc, line) => {
      const q = new Decimal(line.quantity || 0);
      const c = new Decimal(line.unit_cost || 0);
      return acc.plus(q.mul(c));
    }, new Decimal(0));
  };

  const addLineItem = () => {
    if (materials.length === 0) return;
    const defaultMat = materials[0];
    setPoLineItems([
      ...poLineItems,
      {
        raw_material_id: defaultMat.id,
        quantity: '1',
        unit: defaultMat.secondary_unit || defaultMat.base_unit,
        unit_cost: defaultMat.cost_per_unit || '10',
      },
    ]);
  };

  const removeLineItem = (index: number) => {
    if (poLineItems.length <= 1) return;
    setPoLineItems(poLineItems.filter((_, idx) => idx !== index));
  };

  const updateLineItem = (index: number, key: string, value: string) => {
    const updated = [...poLineItems];
    updated[index] = { ...updated[index], [key]: value };

    // Auto-update unit if raw material changed
    if (key === 'raw_material_id') {
      const mat = materials.find((m) => m.id === value);
      if (mat) {
        updated[index].unit = mat.secondary_unit || mat.base_unit;
      }
    }

    setPoLineItems(updated);
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const payload = {
      supplier_id: poSupplierId,
      notes: poNotes,
      items: poLineItems.map((item) => ({
        raw_material_id: item.raw_material_id,
        quantity: parseFloat(item.quantity) || 0,
        unit: item.unit,
        unit_cost: parseFloat(item.unit_cost) || 0,
      })),
    };

    try {
      const res = await apiClient<PurchaseOrder>('/api/v1/purchase-orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.data) {
        setFeedback({
          type: 'success',
          message: `Purchase Order ${res.data.po_number} created successfully as Draft.`,
        });
        setIsBuilderOpen(false);
        fetchData();
      } else {
        setFeedback({ type: 'error', message: res.error?.message || 'Failed to create PO' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleSubmitPO = async (poId: string) => {
    try {
      const res = await apiClient(`/api/v1/purchase-orders/${poId}/submit`, { method: 'POST' });
      if (res.data) {
        setFeedback({ type: 'success', message: 'PO submitted for Admin approval.' });
        fetchData();
      } else {
        setFeedback({ type: 'error', message: res.error?.message || 'Failed to submit PO' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleApprovePO = async (poId: string) => {
    try {
      const res = await apiClient(`/api/v1/purchase-orders/${poId}/approve`, { method: 'POST' });
      if (res.data) {
        setFeedback({ type: 'success', message: 'Purchase Order approved successfully.' });
        fetchData();
      } else {
        setFeedback({ type: 'error', message: res.error?.message || 'Approval failed' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleRejectPO = async () => {
    if (!selectedPO) return;
    try {
      const res = await apiClient(`/api/v1/purchase-orders/${selectedPO.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectionReason }),
      });
      if (res.data) {
        setFeedback({ type: 'success', message: 'PO rejected.' });
        setIsRejectModalOpen(false);
        setRejectionReason('');
        fetchData();
      } else {
        setFeedback({ type: 'error', message: res.error?.message || 'Rejection failed' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleConfirmReceive = async (poId: string) => {
    try {
      const res = await apiClient<any>(`/api/v1/purchase-orders/${poId}/confirm`, {
        method: 'POST',
      });
      if (res.data) {
        setFeedback({
          type: 'success',
          message: `PO confirmed! Inventory stock increased, weighted average costs recalculated, and ledger updated.`,
        });
        fetchData();
      } else {
        setFeedback({
          type: 'error',
          message: res.error?.message || 'Confirmation failed. Double-check PO status.',
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const filtered = purchaseOrders.filter((po) => {
    const matchesStatus = statusFilter === 'all' || po.status === statusFilter;
    const matchesSearch =
      po.po_number.toLowerCase().includes(search.toLowerCase()) ||
      (po.supplier_name && po.supplier_name.toLowerCase().includes(search.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: PurchaseOrder['status']) => {
    switch (status) {
      case 'draft':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-400 border border-slate-700">
            Draft
          </span>
        );
      case 'pending_approval':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center space-x-1">
            <Clock className="h-3 w-3" />
            <span>Pending Approval</span>
          </span>
        );
      case 'approved':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-sky-500/15 text-sky-300 border border-sky-500/30 flex items-center space-x-1">
            <CheckCircle2 className="h-3 w-3" />
            <span>Approved for Receiving</span>
          </span>
        );
      case 'received':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
            <PackageCheck className="h-3 w-3" />
            <span>Received & Added to Stock</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center space-x-1">
            <XCircle className="h-3 w-3" />
            <span>Rejected</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center space-x-2 text-gold-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <FileText className="h-4 w-4" />
            <span>Purchasing & Supply Chain • Phase 2</span>
          </div>
          <h1 className="text-2xl font-serif font-bold text-slate-100 flex items-center space-x-2">
            <span>Purchase Orders</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gold-500/10 text-gold-300 border border-gold-500/20 font-sans">
              Approval Queue & Receiving
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Multi-tier order workflow: Draft creation, Admin approval, and atomic inventory receiving with WAC calculation.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => fetchData()}
            className="p-2.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 text-slate-300 hover:text-white transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          {['admin', 'inventory_manager'].includes(user?.role || '') && (
            <button
              onClick={() => setIsBuilderOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-slate-950 font-semibold text-xs rounded-lg flex items-center space-x-2 shadow-[0_0_15px_rgba(212,175,55,0.2)] transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Create Purchase Order</span>
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between border ${
            feedback.type === 'success'
              ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center space-x-3">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            ) : (
              <AlertCircle className="h-5 w-5 text-rose-400" />
            )}
            <span className="text-sm font-medium">{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filter Tabs and Search */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-slate-900/40 p-3 rounded-xl border border-slate-800/60">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search PO number or supplier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-gold-500/50"
          />
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'All Orders' },
            { id: 'draft', label: 'Drafts' },
            { id: 'pending_approval', label: 'Pending Approval' },
            { id: 'approved', label: 'Approved' },
            { id: 'received', label: 'Received' },
            { id: 'rejected', label: 'Rejected' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === tab.id
                  ? 'bg-gold-500/20 text-gold-300 border border-gold-500/30'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-800/40 border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Purchase Orders List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="py-16 text-center text-slate-500 bg-[#0f121a] rounded-2xl border border-slate-800">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-gold-500" />
            <span>Loading orders...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-500 bg-[#0f121a] rounded-2xl border border-slate-800">
            <FileText className="h-8 w-8 mx-auto mb-2 text-slate-600" />
            <span>No purchase orders found.</span>
          </div>
        ) : (
          filtered.map((po) => (
            <div
              key={po.id}
              className="bg-[#0f121a] p-5 rounded-2xl border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg"
            >
              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <span className="font-mono font-bold text-sm text-gold-300">{po.po_number}</span>
                  {getStatusBadge(po.status)}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                  <span className="flex items-center space-x-1.5 text-slate-200">
                    <Building2 className="h-3.5 w-3.5 text-gold-400" />
                    <span className="font-medium">{po.supplier_name || 'Vendor'}</span>
                  </span>
                  <span>•</span>
                  <span>Created: {new Date(po.created_at).toLocaleDateString()}</span>
                  {po.received_at && (
                    <>
                      <span>•</span>
                      <span className="text-emerald-400">
                        Received: {new Date(po.received_at).toLocaleDateString()}
                      </span>
                    </>
                  )}
                </div>

                {/* Line Items Preview */}
                {po.items && po.items.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {po.items.map((item) => (
                      <span
                        key={item.id}
                        className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-300 font-mono"
                      >
                        {item.raw_material_name}: {item.quantity} {item.unit} (→ {item.converted_quantity} base)
                      </span>
                    ))}
                  </div>
                )}

                {po.rejection_reason && (
                  <div className="text-xs text-rose-400 bg-rose-950/20 p-2 rounded border border-rose-900/30">
                    <span className="font-semibold">Rejection reason:</span> {po.rejection_reason}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between md:justify-end space-x-4 pt-3 md:pt-0 border-t md:border-t-0 border-slate-800">
                <div className="text-right">
                  <div className="text-[11px] text-slate-500 uppercase font-medium">Order Total</div>
                  <div className="font-serif font-bold text-base text-slate-100">
                    ${parseFloat(po.total_amount).toFixed(2)}
                  </div>
                </div>

                {/* Workflow Actions */}
                <div className="flex items-center space-x-2">
                  {/* Draft -> Submit */}
                  {po.status === 'draft' && ['admin', 'inventory_manager'].includes(user?.role || '') && (
                    <button
                      onClick={() => handleSubmitPO(po.id)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-colors"
                    >
                      <span>Submit for Approval</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {/* Pending Approval -> Admin Approve / Reject */}
                  {po.status === 'pending_approval' && user?.role === 'admin' && (
                    <>
                      <button
                        onClick={() => handleApprovePO(po.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center space-x-1 shadow transition-colors"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedPO(po);
                          setIsRejectModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-semibold rounded-lg transition-colors"
                      >
                        Reject
                      </button>
                    </>
                  )}

                  {/* Approved -> Confirm & Receive (Atomic Stock Update) */}
                  {po.status === 'approved' && ['admin', 'inventory_manager'].includes(user?.role || '') && (
                    <button
                      onClick={() => handleConfirmReceive(po.id)}
                      className="px-3 py-1.5 bg-gold-500 hover:bg-gold-400 text-slate-950 text-xs font-bold rounded-lg flex items-center space-x-1.5 shadow-[0_0_12px_rgba(212,175,55,0.25)] transition-all"
                    >
                      <PackageCheck className="h-4 w-4" />
                      <span>Receive & Add Stock</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* PO Builder Modal */}
      {isBuilderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-[#121620] border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="font-serif font-bold text-base text-slate-100">
                  New Purchase Order Builder
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Live unit conversions & line calculations using Decimal.js
                </p>
              </div>
              <button onClick={() => setIsBuilderOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePO} className="flex-1 overflow-y-auto mt-4 space-y-4 text-xs pr-1">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Select Supplier *</label>
                <select
                  value={poSupplierId}
                  onChange={(e) => setPoSupplierId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-gold-500/50"
                  required
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.payment_terms})
                    </option>
                  ))}
                </select>
              </div>

              {/* Line Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Line Items</span>
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="text-gold-400 hover:text-gold-300 flex items-center space-x-1 text-xs font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                {poLineItems.map((line, idx) => {
                  const selectedMat = materials.find((m) => m.id === line.raw_material_id);
                  const isSecondary = selectedMat && line.unit === selectedMat.secondary_unit;
                  const convRate = selectedMat ? parseFloat(selectedMat.conversion_rate) || 1 : 1;
                  const convertedQty = isSecondary
                    ? (parseFloat(line.quantity) || 0) * convRate
                    : parseFloat(line.quantity) || 0;

                  return (
                    <div
                      key={idx}
                      className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2 relative"
                    >
                      {poLineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLineItem(idx)}
                          className="absolute right-2 top-2 text-slate-500 hover:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                        <div className="md:col-span-2">
                          <label className="block text-slate-400 mb-1">Raw Material</label>
                          <select
                            value={line.raw_material_id}
                            onChange={(e) => updateLineItem(idx, 'raw_material_id', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100"
                            required
                          >
                            {materials.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.base_unit})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-400 mb-1">Quantity</label>
                          <input
                            type="number"
                            step="0.0001"
                            value={line.quantity}
                            onChange={(e) => updateLineItem(idx, 'quantity', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 font-mono"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 mb-1">Unit</label>
                          <select
                            value={line.unit}
                            onChange={(e) => updateLineItem(idx, 'unit', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 uppercase font-mono"
                          >
                            {selectedMat?.base_unit && (
                              <option value={selectedMat.base_unit}>
                                {selectedMat.base_unit} (Base)
                              </option>
                            )}
                            {selectedMat?.secondary_unit && (
                              <option value={selectedMat.secondary_unit}>
                                {selectedMat.secondary_unit} (Bulk)
                              </option>
                            )}
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/40">
                        <div className="text-slate-400">
                          Unit Cost ($):
                          <input
                            type="number"
                            step="0.0001"
                            value={line.unit_cost}
                            onChange={(e) => updateLineItem(idx, 'unit_cost', e.target.value)}
                            className="ml-2 w-24 px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-slate-100 font-mono"
                            required
                          />
                        </div>

                        <div className="text-right">
                          <span className="text-slate-500 font-mono">
                            → Converts to: <span className="text-slate-200 font-semibold">{convertedQty} {selectedMat?.base_unit}</span>
                          </span>
                          <span className="ml-3 font-mono font-bold text-gold-300">
                            Line Total: ${( (parseFloat(line.quantity) || 0) * (parseFloat(line.unit_cost) || 0) ).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Order Notes</label>
                <textarea
                  rows={2}
                  placeholder="Delivery instructions, batch references..."
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-gold-500/50"
                />
              </div>

              {/* Total & Submit */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <div>
                  <div className="text-slate-400 text-[11px]">Estimated PO Value</div>
                  <div className="font-serif font-bold text-lg text-gold-300">
                    ${calculateTotal().toFixed(2)}
                  </div>
                </div>

                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsBuilderOpen(false)}
                    className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-gold-500 hover:bg-gold-400 text-slate-950 font-bold shadow-md"
                  >
                    Save as Draft PO
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {isRejectModalOpen && selectedPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-[#121620] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <h3 className="font-serif font-bold text-base text-slate-100">
              Reject Purchase Order {selectedPO.po_number}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Please specify the audit reason for rejecting this procurement request.
            </p>

            <div className="mt-4">
              <label className="block text-slate-300 font-medium mb-1 text-xs">
                Rejection Reason *
              </label>
              <textarea
                rows={3}
                required
                placeholder="e.g. Price too high compared to contract terms..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4 mt-2">
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectPO}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
