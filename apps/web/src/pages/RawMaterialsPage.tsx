import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  AlertTriangle,
  History,
  TrendingUp,
  Search,
  RefreshCw,
  Package,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../lib/utils';
import { Decimal } from 'decimal.js';

interface RawMaterial {
  id: string;
  name: string;
  sku: string;
  category: 'oil' | 'alcohol' | 'fixative' | 'packaging';
  base_unit: string;
  secondary_unit?: string;
  conversion_rate: string;
  cost_per_unit: string;
  min_stock_level: string;
  current_stock: string;
  is_active: boolean;
}

interface StockMovement {
  id: string;
  quantity: string;
  unit: string;
  unit_cost: string;
  total_cost: string;
  reference_type: string;
  reason?: string;
  created_at: string;
}

export const RawMaterialsPage: React.FC = () => {
  const { user } = useAuth();
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<RawMaterial | null>(null);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [ledgerMovements, setLedgerMovements] = useState<StockMovement[]>([]);
  const [isLedgerLoading, setIsLedgerLoading] = useState(false);

  // New Material form state
  const [newMaterial, setNewMaterial] = useState({
    name: '',
    sku: '',
    category: 'oil' as const,
    base_unit: 'ml' as const,
    secondary_unit: 'l' as const,
    conversion_rate: 1000,
    cost_per_unit: 0,
    min_stock_level: 100,
    current_stock: 0,
  });

  // Adjust Stock form state
  const [adjustData, setAdjustData] = useState({
    delta: '',
    type: 'add' as 'add' | 'subtract',
    reason: '',
  });

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchMaterials = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient<RawMaterial[]>('/api/v1/raw-materials');
      if (res.data) {
        setMaterials(res.data);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  const openLedger = async (material: RawMaterial) => {
    setSelectedMaterial(material);
    setIsLedgerOpen(true);
    setIsLedgerLoading(true);
    try {
      const res = await apiClient<StockMovement[]>(`/api/v1/raw-materials/${material.id}/ledger`);
      if (res.data) {
        setLedgerMovements(res.data);
      }
    } finally {
      setIsLedgerLoading(false);
    }
  };

  const handleCreateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const res = await apiClient<RawMaterial>('/api/v1/raw-materials', {
        method: 'POST',
        body: JSON.stringify(newMaterial),
      });

      if (res.data) {
        setFeedback({ type: 'success', message: `Material ${res.data.name} added successfully.` });
        setIsAddModalOpen(false);
        fetchMaterials();
      } else {
        setFeedback({ type: 'error', message: res.error?.message || 'Failed to create material' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterial) return;
    setFeedback(null);

    const numericDelta = parseFloat(adjustData.delta);
    if (isNaN(numericDelta) || numericDelta <= 0) {
      setFeedback({ type: 'error', message: 'Please enter a valid positive quantity.' });
      return;
    }

    const finalDelta = adjustData.type === 'add' ? numericDelta : -numericDelta;

    try {
      const res = await apiClient('/api/v1/stock/adjust', {
        method: 'POST',
        body: JSON.stringify({
          raw_material_id: selectedMaterial.id,
          delta: finalDelta,
          reason: adjustData.reason,
        }),
      });

      if (res.data) {
        setFeedback({
          type: 'success',
          message: `Stock for ${selectedMaterial.name} updated successfully.`,
        });
        setIsAdjustModalOpen(false);
        setAdjustData({ delta: '', type: 'add', reason: '' });
        fetchMaterials();
      } else {
        setFeedback({ type: 'error', message: res.error?.message || 'Stock adjustment failed.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  // Filtered materials
  const filtered = materials.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.sku.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || m.category === categoryFilter;
    const isLow = new Decimal(m.current_stock).lte(new Decimal(m.min_stock_level));
    const matchesLowStock = !onlyLowStock || isLow;
    return matchesSearch && matchesCategory && matchesLowStock;
  });

  // KPI Calculations using Decimal
  const totalValuation = materials.reduce((acc, m) => {
    const stock = new Decimal(m.current_stock || 0);
    const cost = new Decimal(m.cost_per_unit || 0);
    return acc.plus(stock.mul(cost));
  }, new Decimal(0));

  const lowStockCount = materials.filter((m) =>
    new Decimal(m.current_stock).lte(new Decimal(m.min_stock_level)),
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center space-x-2 text-gold-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Layers className="h-4 w-4" />
            <span>Inventory Management</span>
          </div>
          <h1 className="text-2xl font-serif font-bold text-slate-100 flex items-center space-x-2">
            <span>Raw Materials Catalog</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gold-500/10 text-gold-300 border border-gold-500/20 font-sans">
              Live Stock Ledger
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Precious fragrance oils, ethanol, aroma molecules, and luxury packaging tracked in base units with weighted average cost.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => fetchMaterials()}
            className="p-2.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 text-slate-300 hover:text-foreground transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          {['admin', 'inventory_manager'].includes(user?.role || '') && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-slate-950 font-semibold text-xs rounded-lg flex items-center space-x-2 shadow-[0_0_15px_rgba(212,175,55,0.2)] transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Add Raw Material</span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between border ${feedback.type === 'success'
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
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-medium tracking-wider">Total Inventory Value</span>
            <TrendingUp className="h-4 w-4 text-gold-400" />
          </div>
          <div className="text-2xl font-serif font-bold text-gold-300">
            {formatCurrency(totalValuation.toString())}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Weighted average valuation</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-medium tracking-wider">Total Materials</span>
            <Package className="h-4 w-4 text-sky-400" />
          </div>
          <div className="text-2xl font-serif font-bold text-slate-100">{materials.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Active registered formulas & supplies</div>
        </div>

        <div
          onClick={() => setOnlyLowStock(!onlyLowStock)}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${onlyLowStock
            ? 'bg-rose-950/40 border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
            : 'bg-slate-900/60 border-slate-800/80 hover:border-rose-900/50'
            }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-medium tracking-wider text-rose-400">
              Low Stock Alerts
            </span>
            <AlertTriangle className="h-4 w-4 text-rose-400" />
          </div>
          <div className="text-2xl font-serif font-bold text-rose-400">{lowStockCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            {onlyLowStock ? 'Filtering active (click to reset)' : 'Click to filter low stock items'}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-medium tracking-wider">Unit Engine</span>
            <Sparkles className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-sm font-semibold text-slate-200 mt-1">Auto-Conversion Active</div>
          <div className="text-[11px] text-slate-500 mt-1">1 L = 1,000 ml • 1 kg = 1,000 g</div>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-slate-900/40 p-3 rounded-xl border border-slate-800/60">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search material name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-gold-500/50"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'All Items' },
            { id: 'oil', label: 'Essential Oils' },
            { id: 'alcohol', label: 'Alcohol' },
            { id: 'fixative', label: 'Fixatives' },
            { id: 'packaging', label: 'Packaging' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${categoryFilter === cat.id
                ? 'bg-gold-500/20 text-gold-300 border border-gold-500/30'
                : 'text-slate-400 hover:text-slate-200 bg-slate-800/40 border border-transparent'
                }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Materials Table */}
      <div className="bg-sidebar rounded-xl border border-slate-800/80 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-card text-slate-400 uppercase tracking-wider border-b border-slate-800 text-[10px]">
              <tr>
                <th className="py-3.5 px-4 font-semibold">SKU & Material Name</th>
                <th className="py-3.5 px-4 font-semibold">Category</th>
                <th className="py-3.5 px-4 font-semibold">Current Stock</th>
                <th className="py-3.5 px-4 font-semibold">Min Threshold</th>
                <th className="py-3.5 px-4 font-semibold">Unit Cost (WAC)</th>
                <th className="py-3.5 px-4 font-semibold">Valuation</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-gold-500" />
                    <span>Loading perfume inventory...</span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <Package className="h-8 w-8 mx-auto mb-2 text-slate-600" />
                    <span>No raw materials found matching your filter criteria.</span>
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const isLow = new Decimal(item.current_stock).lte(
                    new Decimal(item.min_stock_level),
                  );
                  const valuation = new Decimal(item.current_stock).mul(
                    new Decimal(item.cost_per_unit),
                  );

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-800/30 transition-colors group"
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-100 flex items-center space-x-2">
                          <span>{item.name}</span>
                          {isLow && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-rose-500/20 text-rose-300 border border-rose-500/30 font-sans">
                              Low Stock
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">{item.sku}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="capitalize px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <div className={`font-semibold ${isLow ? 'text-rose-400' : 'text-slate-100'}`}>
                          {item.current_stock} {item.base_unit}
                        </div>
                        {item.secondary_unit && (
                          <div className="text-[10px] text-slate-500">
                            ≈{' '}
                            {new Decimal(item.current_stock)
                              .div(new Decimal(item.conversion_rate || 1))
                              .toFixed(3)}{' '}
                            {item.secondary_unit}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {item.min_stock_level} {item.base_unit}
                      </td>
                      <td className="py-3 px-4 font-mono text-gold-300 font-medium">
                        {formatCurrency(item.cost_per_unit)} / {item.base_unit}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-100">
                        {formatCurrency(valuation.toString())}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => openLedger(item)}
                            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-gold-300 transition-colors"
                            title="View Stock Movements Ledger"
                          >
                            <History className="h-4 w-4" />
                          </button>

                          {['admin', 'inventory_manager'].includes(user?.role || '') && (
                            <button
                              onClick={() => {
                                setSelectedMaterial(item);
                                setIsAdjustModalOpen(true);
                              }}
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition-colors"
                            >
                              Adjust
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Adjustment Modal */}
      {isAdjustModalOpen && selectedMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-surface border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="font-serif font-bold text-base text-slate-100">Adjust Physical Stock</h3>
                <p className="text-xs text-slate-400 mt-0.5">{selectedMaterial.name}</p>
              </div>
              <button
                onClick={() => setIsAdjustModalOpen(false)}
                className="text-slate-400 hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAdjustStock} className="mt-4 space-y-4 text-xs">
              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 flex justify-between">
                <span className="text-slate-400">Current Ledger Balance:</span>
                <span className="font-mono font-bold text-slate-100">
                  {selectedMaterial.current_stock} {selectedMaterial.base_unit}
                </span>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Adjustment Direction</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustData({ ...adjustData, type: 'add' })}
                    className={`py-2 px-3 rounded-lg flex items-center justify-center space-x-2 border font-medium ${adjustData.type === 'add'
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                  >
                    <ArrowDownLeft className="h-4 w-4" />
                    <span>Intake / Surplus (+)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustData({ ...adjustData, type: 'subtract' })}
                    className={`py-2 px-3 rounded-lg flex items-center justify-center space-x-2 border font-medium ${adjustData.type === 'subtract'
                      ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                  >
                    <ArrowUpRight className="h-4 w-4" />
                    <span>Spill / Loss (-)</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Quantity ({selectedMaterial.base_unit})
                </label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  placeholder="e.g. 50.0000"
                  value={adjustData.delta}
                  onChange={(e) => setAdjustData({ ...adjustData, delta: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-gold-500/50"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Mandatory Audit Reason <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="State reason: e.g. Lab spill during distillation, cycle count variance..."
                  value={adjustData.reason}
                  onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-gold-500/50"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-gold-500 hover:bg-gold-400 text-slate-950 font-semibold shadow-md"
                >
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Raw Material Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-surface border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="font-serif font-bold text-base text-slate-100">Add New Raw Material</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMaterial} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-slate-300 font-medium mb-1">Material Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pure Damask Rose Absolute"
                    value={newMaterial.name}
                    onChange={(e) => setNewMaterial({ ...newMaterial, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-gold-500/50"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">SKU Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. RM-OIL-ROSE-03"
                    value={newMaterial.sku}
                    onChange={(e) => setNewMaterial({ ...newMaterial, sku: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-gold-500/50"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Category *</label>
                  <select
                    value={newMaterial.category}
                    onChange={(e) => setNewMaterial({ ...newMaterial, category: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-gold-500/50"
                  >
                    <option value="oil">Essential Oil / Absolute</option>
                    <option value="alcohol">Perfumer Alcohol</option>
                    <option value="fixative">Fixative / Chemical</option>
                    <option value="packaging">Flacon / Packaging</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Base Unit (Storage) *</label>
                  <select
                    value={newMaterial.base_unit}
                    onChange={(e) => setNewMaterial({ ...newMaterial, base_unit: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-gold-500/50"
                  >
                    <option value="ml">Millilitre (ml)</option>
                    <option value="g">Gram (g)</option>
                    <option value="pcs">Pieces (pcs)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Secondary Unit (Bulk PO)</label>
                  <select
                    value={newMaterial.secondary_unit}
                    onChange={(e) => setNewMaterial({ ...newMaterial, secondary_unit: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-gold-500/50"
                  >
                    <option value="l">Litre (L)</option>
                    <option value="kg">Kilogram (kg)</option>
                    <option value="pcs">Pieces (pcs)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Conversion Multiplier</label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="1000"
                    value={newMaterial.conversion_rate}
                    onChange={(e) => setNewMaterial({ ...newMaterial, conversion_rate: parseFloat(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">1 Sec Unit = {newMaterial.conversion_rate} Base Units</span>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Min Threshold Alert</label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="100"
                    value={newMaterial.min_stock_level}
                    onChange={(e) => setNewMaterial({ ...newMaterial, min_stock_level: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Initial Stock ({newMaterial.base_unit})</label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="0"
                    value={newMaterial.current_stock}
                    onChange={(e) => setNewMaterial({ ...newMaterial, current_stock: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Cost Per Base Unit (PKR)</label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="0.00"
                    value={newMaterial.cost_per_unit}
                    onChange={(e) => setNewMaterial({ ...newMaterial, cost_per_unit: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-gold-500 hover:bg-gold-400 text-slate-950 font-semibold shadow-md"
                >
                  Create Material
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Ledger History Drawer / Modal */}
      {isLedgerOpen && selectedMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-surface border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="font-serif font-bold text-base text-slate-100 flex items-center space-x-2">
                  <History className="h-4 w-4 text-gold-400" />
                  <span>Stock Movements Ledger</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Append-only immutable record for: <span className="text-slate-200 font-semibold">{selectedMaterial.name}</span>
                </p>
              </div>
              <button onClick={() => setIsLedgerOpen(false)} className="text-slate-400 hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mt-4 pr-1">
              {isLedgerLoading ? (
                <div className="py-12 text-center text-slate-500">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-gold-500" />
                  <span>Retrieving ledger transactions...</span>
                </div>
              ) : ledgerMovements.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <Package className="h-8 w-8 mx-auto mb-2 text-slate-600" />
                  <span>No ledger entries found for this raw material.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {ledgerMovements.map((m) => {
                    const isPositive = new Decimal(m.quantity).gte(0);
                    return (
                      <div
                        key={m.id}
                        className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="flex items-start space-x-3">
                          <div
                            className={`p-2 rounded-lg mt-0.5 ${isPositive
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              }`}
                          >
                            {isPositive ? (
                              <ArrowDownLeft className="h-4 w-4" />
                            ) : (
                              <ArrowUpRight className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-200 capitalize">
                              {m.reference_type.replace('_', ' ')}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {m.reason || 'Standard transaction'}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1">
                              {new Date(m.created_at).toLocaleString()}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div
                            className={`font-mono font-bold text-sm ${isPositive ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                          >
                            {isPositive ? '+' : ''}
                            {m.quantity} {m.unit}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            @ {formatCurrency(m.unit_cost)} / {m.unit}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            Total: {formatCurrency(m.total_cost)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setIsLedgerOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg"
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
