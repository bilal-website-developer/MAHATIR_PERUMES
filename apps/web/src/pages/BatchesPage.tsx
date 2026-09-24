import React, { useState, useEffect } from 'react';
import {
  Factory,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  RefreshCw,
  X,
  AlertCircle,
  TrendingDown,
  RotateCcw,
  Sparkles,
  Layers,
} from 'lucide-react';
import { apiClient } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Decimal } from 'decimal.js';

interface Formula {
  id: string;
  perfume_name: string;
  code: string;
  version_label: string;
  status: string;
  is_locked: boolean;
}

interface BatchUsage {
  id: string;
  raw_material_id: string;
  raw_material_name?: string;
  raw_material_sku?: string;
  quantity_used: string;
  unit: string;
  unit_cost_snapshot: string;
  line_cost: string;
}

interface BatchLoss {
  id: string;
  reason_type: string;
  volume_ml: string;
  notes?: string;
  created_at: string;
}

interface Batch {
  id: string;
  batch_code: string;
  perfume_name: string;
  formula_id: string;
  formula_version_label: string;
  production_date: string;
  expected_volume: string;
  actual_volume: string;
  remaining_volume: string;
  total_cost: string;
  cost_per_ml: string;
  loss_percent: string;
  loss_volume: string;
  status: 'draft' | 'bulk' | 'partial_bottled' | 'completed' | 'reversed';
  notes?: string;
  reversal_reason?: string;
  usages?: BatchUsage[];
  losses?: BatchLoss[];
}

interface BulkInventoryLot {
  id: string;
  batch_id: string;
  batch_code: string;
  perfume_name: string;
  initial_volume: string;
  current_volume: string;
  cost_per_ml: string;
  status: string;
}

export const BatchesPage: React.FC = () => {
  const { user } = useAuth();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [bulkLots, setBulkLots] = useState<BulkInventoryLot[]>([]);
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'batches' | 'bulk'>('batches');

  // Modals & Action States
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isReverseModalOpen, setIsReverseModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);

  // New Batch Wizard State
  const [selectedFormulaId, setSelectedFormulaId] = useState('');
  const [expectedVolume, setExpectedVolume] = useState('500');
  const [wizardNotes, setWizardNotes] = useState('');

  // Confirmation State
  const [actualVolume, setActualVolume] = useState('480');
  const [lossReason, setLossReason] = useState('Filtration and quality testing loss');

  // Reversal State
  const [reversalReason, setReversalReason] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [batRes, bulkRes, frmRes] = await Promise.all([
        apiClient<Batch[]>('/api/v1/batches'),
        apiClient<BulkInventoryLot[]>('/api/v1/bulk-inventory'),
        apiClient<Formula[]>('/api/v1/formulas'),
      ]);

      if (batRes.data) setBatches(batRes.data);
      if (bulkRes.data) setBulkLots(bulkRes.data);
      if (frmRes.data) {
        const activeFormulas = frmRes.data.filter((f) => f.status === 'active');
        setFormulas(activeFormulas);
        if (activeFormulas.length > 0 && !selectedFormulaId) {
          setSelectedFormulaId(activeFormulas[0].id);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const res = await apiClient<Batch>('/api/v1/batches', {
        method: 'POST',
        body: JSON.stringify({
          formula_id: selectedFormulaId,
          expected_volume: parseFloat(expectedVolume) || 500,
          notes: wizardNotes,
        }),
      });

      if (res.data) {
        setFeedback({
          type: 'success',
          message: `Draft Batch ${res.data.batch_code} created successfully for ${res.data.perfume_name}.`,
        });
        setIsWizardOpen(false);
        fetchData();
      } else {
        setFeedback({ type: 'error', message: res.error?.message || 'Failed to create draft batch' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleConfirmBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch) return;
    setFeedback(null);

    const actualVolNum = parseFloat(actualVolume);
    if (isNaN(actualVolNum) || actualVolNum <= 0) {
      setFeedback({ type: 'error', message: 'Actual volume must be positive.' });
      return;
    }

    try {
      const res = await apiClient<{ success: boolean; batch: Batch }>(
        `/api/v1/batches/${selectedBatch.id}/confirm`,
        {
          method: 'POST',
          body: JSON.stringify({
            actual_volume: actualVolNum,
            loss_reason: lossReason,
          }),
        },
      );

      if (res.data) {
        setFeedback({
          type: 'success',
          message: `Batch ${res.data.batch.batch_code} confirmed! Materials deducted, bulk stock created, and formula locked.`,
        });
        setIsConfirmModalOpen(false);
        fetchData();
      } else {
        setFeedback({ type: 'error', message: res.error?.message || 'Confirmation failed' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleReverseBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch) return;
    setFeedback(null);

    try {
      const res = await apiClient<{ success: boolean; batch: Batch }>(
        `/api/v1/batches/${selectedBatch.id}/reverse`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: reversalReason }),
        },
      );

      if (res.data) {
        setFeedback({
          type: 'success',
          message: `Batch ${selectedBatch.batch_code} reversed. Raw materials restored to stock.`,
        });
        setIsReverseModalOpen(false);
        setReversalReason('');
        fetchData();
      } else {
        setFeedback({ type: 'error', message: res.error?.message || 'Reversal failed' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  // KPIs
  const totalBulkVolumeMl = bulkLots.reduce(
    (acc, lot) => acc.plus(new Decimal(lot.current_volume || 0)),
    new Decimal(0),
  );

  const totalBulkValuation = bulkLots.reduce((acc, lot) => {
    const vol = new Decimal(lot.current_volume || 0);
    const cost = new Decimal(lot.cost_per_ml || 0);
    return acc.plus(vol.mul(cost));
  }, new Decimal(0));

  const filteredBatches = batches.filter((b) => {
    const matchesSearch =
      b.batch_code.toLowerCase().includes(search.toLowerCase()) ||
      b.perfume_name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: Batch['status']) => {
    switch (status) {
      case 'draft':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-400 border border-slate-700 flex items-center space-x-1">
            <Clock className="h-3 w-3" />
            <span>Draft</span>
          </span>
        );
      case 'bulk':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
            <CheckCircle2 className="h-3 w-3" />
            <span>Bulk Liquid (Matured)</span>
          </span>
        );
      case 'partial_bottled':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-sky-500/15 text-sky-300 border border-sky-500/30 flex items-center space-x-1">
            <Package className="h-3 w-3" />
            <span>Partial Bottled</span>
          </span>
        );
      case 'completed':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
            Bottled / Completed
          </span>
        );
      case 'reversed':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center space-x-1">
            <XCircle className="h-3 w-3" />
            <span>Reversed</span>
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
            <Factory className="h-4 w-4" />
            <span>Manufacturing Lab • Phase 4</span>
          </div>
          <h1 className="text-2xl font-serif font-bold text-slate-100 flex items-center space-x-2">
            <span>Batch Production & Bulk Inventory</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gold-500/10 text-gold-300 border border-gold-500/20 font-sans">
              Atomic BOM Deduction
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Turn raw materials into tracked bulk liquid with loss accounting, auto-locking formulas, and real-time cost-per-ml snapshots.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => fetchData()}
            className="p-2.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 text-slate-300 hover:text-white transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          {['admin', 'production_manager'].includes(user?.role || '') && (
            <button
              onClick={() => setIsWizardOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-slate-950 font-semibold text-xs rounded-lg flex items-center space-x-2 shadow-[0_0_15px_rgba(212,175,55,0.2)] transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Initiate New Batch</span>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-medium tracking-wider">Active Bulk Volume</span>
            <Layers className="h-4 w-4 text-gold-400" />
          </div>
          <div className="text-2xl font-serif font-bold text-gold-300">
            {totalBulkVolumeMl.toNumber() >= 1000
              ? `${(totalBulkVolumeMl.toNumber() / 1000).toFixed(2)} L`
              : `${totalBulkVolumeMl.toFixed(0)} ml`}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Available for bottling & decants</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-medium tracking-wider">Bulk Valuation</span>
            <Sparkles className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-serif font-bold text-slate-100">
            ${totalBulkValuation.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Matured liquid inventory value</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-medium tracking-wider">Total Batches</span>
            <Factory className="h-4 w-4 text-sky-400" />
          </div>
          <div className="text-2xl font-serif font-bold text-slate-100">{batches.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Recorded manufacturing runs</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-medium tracking-wider text-amber-400">
              Loss Precision
            </span>
            <TrendingDown className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-sm font-semibold text-slate-200 mt-1">Cost-Per-ml Recalculation</div>
          <div className="text-[11px] text-slate-500 mt-1">Cost/ml = Total Cost / Actual Volume</div>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="flex border-b border-slate-800/80 space-x-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('batches')}
          className={`pb-3 relative transition-colors ${
            activeTab === 'batches' ? 'text-gold-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Manufacturing Batches ({batches.length})</span>
          {activeTab === 'batches' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold-400 rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('bulk')}
          className={`pb-3 relative transition-colors ${
            activeTab === 'bulk' ? 'text-gold-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Bulk Liquid Tanks ({bulkLots.length})</span>
          {activeTab === 'bulk' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold-400 rounded-full" />
          )}
        </button>
      </div>

      {/* Main Content according to active tab */}
      {activeTab === 'batches' ? (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-slate-900/40 p-3 rounded-xl border border-slate-800/60">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search batch code or perfume..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-gold-500/50"
              />
            </div>

            <div className="flex items-center space-x-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
              {[
                { id: 'all', label: 'All Batches' },
                { id: 'draft', label: 'Draft' },
                { id: 'bulk', label: 'Bulk Liquid' },
                { id: 'completed', label: 'Completed' },
                { id: 'reversed', label: 'Reversed' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    statusFilter === tab.id
                      ? 'bg-gold-500/20 text-gold-300 border border-gold-500/30'
                      : 'text-slate-400 hover:text-slate-200 bg-slate-800/40'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Batches Cards List */}
          <div className="space-y-3">
            {isLoading ? (
              <div className="py-16 text-center text-slate-500 bg-[#0f121a] rounded-2xl border border-slate-800">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-gold-500" />
                <span>Loading production batches...</span>
              </div>
            ) : filteredBatches.length === 0 ? (
              <div className="py-16 text-center text-slate-500 bg-[#0f121a] rounded-2xl border border-slate-800">
                <Factory className="h-8 w-8 mx-auto mb-2 text-slate-600" />
                <span>No manufacturing batches found matching your filters.</span>
              </div>
            ) : (
              filteredBatches.map((b) => {
                const hasLoss = parseFloat(b.loss_volume) > 0;
                return (
                  <div
                    key={b.id}
                    className="bg-[#0f121a] p-5 rounded-2xl border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center space-x-3">
                        <span className="font-mono font-bold text-sm text-gold-300">{b.batch_code}</span>
                        {getStatusBadge(b.status)}
                        <span className="text-[10px] font-mono text-slate-500">
                          Recipe: {b.formula_version_label}
                        </span>
                      </div>

                      <div className="text-base font-serif font-bold text-slate-100">
                        {b.perfume_name}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                        <span>
                          Expected: <strong className="text-slate-200">{parseFloat(b.expected_volume).toFixed(1)} ml</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Actual:{' '}
                          <strong className="text-slate-200">
                            {b.status === 'draft' ? 'Pending' : `${parseFloat(b.actual_volume).toFixed(1)} ml`}
                          </strong>
                        </span>
                        {b.status !== 'draft' && (
                          <>
                            <span>•</span>
                            <span>
                              Remaining Bulk:{' '}
                              <strong className="text-emerald-400">{parseFloat(b.remaining_volume).toFixed(1)} ml</strong>
                            </span>
                          </>
                        )}
                        {hasLoss && (
                          <>
                            <span>•</span>
                            <span className="text-amber-400 font-semibold">
                              Loss: {parseFloat(b.loss_volume).toFixed(1)} ml ({parseFloat(b.loss_percent).toFixed(1)}%)
                            </span>
                          </>
                        )}
                      </div>

                      {b.reversal_reason && (
                        <div className="text-xs text-rose-400 bg-rose-950/20 p-2 rounded border border-rose-900/30">
                          <span className="font-semibold">Reversal Reason:</span> {b.reversal_reason}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between md:justify-end space-x-5 pt-3 md:pt-0 border-t md:border-t-0 border-slate-800">
                      <div className="text-right">
                        <div className="text-[10px] text-slate-500 uppercase font-medium">Batch Cost / Cost Per ml</div>
                        <div className="font-serif font-bold text-base text-gold-300">
                          ${parseFloat(b.total_cost).toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          ${parseFloat(b.cost_per_ml).toFixed(4)} / ml
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {/* Draft -> Confirm Action */}
                        {b.status === 'draft' && ['admin', 'production_manager'].includes(user?.role || '') && (
                          <button
                            onClick={() => {
                              setSelectedBatch(b);
                              setActualVolume(b.expected_volume);
                              setIsConfirmModalOpen(true);
                            }}
                            className="px-3.5 py-1.5 bg-gold-500 hover:bg-gold-400 text-slate-950 text-xs font-bold rounded-lg flex items-center space-x-1.5 shadow-[0_0_12px_rgba(212,175,55,0.25)] transition-all"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Confirm Production</span>
                          </button>
                        )}

                        {/* Bulk -> Reversal Action */}
                        {b.status === 'bulk' && ['admin', 'production_manager'].includes(user?.role || '') && (
                          <button
                            onClick={() => {
                              setSelectedBatch(b);
                              setIsReverseModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                            title="Reverse batch (returns raw materials to warehouse)"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}

                        {/* Detail Modal */}
                        <button
                          onClick={() => {
                            setSelectedBatch(b);
                            setIsDetailModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors"
                        >
                          Audit Details
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* Bulk Liquid Inventory View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bulkLots.map((lot) => (
            <div
              key={lot.id}
              className="bg-[#0f121a] p-5 rounded-2xl border border-slate-800/80 hover:border-gold-500/30 transition-all shadow-xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-gold-400 font-bold">{lot.batch_code}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-medium">
                    Matured Liquid
                  </span>
                </div>
                <h3 className="font-serif font-bold text-base text-slate-100 mt-2">{lot.perfume_name}</h3>

                <div className="mt-4 p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Available Liquid:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {parseFloat(lot.current_volume).toFixed(1)} ml
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Initial Produced:</span>
                    <span className="font-mono text-slate-300">
                      {parseFloat(lot.initial_volume).toFixed(1)} ml
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Cost / ml:</span>
                    <span className="font-mono text-gold-300">
                      ${parseFloat(lot.cost_per_ml).toFixed(4)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                <span>Vessel: Tank A-01</span>
                <span>Ready for Bottling (Phase 5)</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Batch Wizard Modal */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-[#121620] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="font-serif font-bold text-base text-slate-100">
                  Initiate Production Batch
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select active perfume formula and enter target volume.
                </p>
              </div>
              <button onClick={() => setIsWizardOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDraft} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Active Perfume Formula *</label>
                <select
                  value={selectedFormulaId}
                  onChange={(e) => setSelectedFormulaId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-gold-500/50"
                  required
                >
                  {formulas.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.perfume_name} ({f.version_label}) - {f.code}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Target Expected Batch Volume (ml) *
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  placeholder="500"
                  value={expectedVolume}
                  onChange={(e) => setExpectedVolume(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-gold-500/50"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Batch Manufacturing Notes</label>
                <textarea
                  rows={2}
                  placeholder="Laboratory notes, equipment operator, ambient temperature..."
                  value={wizardNotes}
                  onChange={(e) => setWizardNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-gold-500/50"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsWizardOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-gold-500 hover:bg-gold-400 text-slate-950 font-bold shadow-md"
                >
                  Create Batch Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Production Modal */}
      {isConfirmModalOpen && selectedBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-[#121620] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="font-serif font-bold text-base text-slate-100">
                  Confirm Batch Manufacturing
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Batch: {selectedBatch.batch_code} ({selectedBatch.perfume_name})
                </p>
              </div>
              <button onClick={() => setIsConfirmModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmBatch} className="mt-4 space-y-4 text-xs">
              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Expected Volume:</span>
                  <span className="font-mono font-bold text-slate-100">
                    {selectedBatch.expected_volume} ml
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Actual Volume Produced (ml) *
                </label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  value={actualVolume}
                  onChange={(e) => setActualVolume(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-gold-500/50"
                />
              </div>

              {parseFloat(actualVolume) < parseFloat(selectedBatch.expected_volume) && (
                <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-xl space-y-2">
                  <div className="flex items-center space-x-1.5 text-amber-400 font-semibold">
                    <TrendingDown className="h-4 w-4" />
                    <span>
                      Loss Detected:{' '}
                      {(parseFloat(selectedBatch.expected_volume) - parseFloat(actualVolume)).toFixed(1)} ml (
                      {(
                        ((parseFloat(selectedBatch.expected_volume) - parseFloat(actualVolume)) /
                          parseFloat(selectedBatch.expected_volume)) *
                        100
                      ).toFixed(1)}
                      %)
                    </span>
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1 text-[11px]">
                      Mandatory Loss Reason *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Evaporation during maturation, filtration residual..."
                      value={lossReason}
                      onChange={(e) => setLossReason(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 text-xs"
                    />
                  </div>
                </div>
              )}

              <div className="text-[11px] text-slate-400 bg-slate-900/40 p-2.5 rounded border border-slate-800/80">
                <span className="font-semibold text-slate-300">Atomic Process:</span> Verifies and deducts raw materials from warehouse stock, updates the ledger, creates bulk inventory, and permanently locks the formula.
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsConfirmModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-gold-500 hover:bg-gold-400 text-slate-950 font-bold shadow-md"
                >
                  Confirm & Deduct Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reversal Modal */}
      {isReverseModalOpen && selectedBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-[#121620] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center space-x-2 text-rose-400 mb-2">
              <RotateCcw className="h-5 w-5" />
              <h3 className="font-serif font-bold text-base text-slate-100">
                Reverse Batch {selectedBatch.batch_code}?
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              This will compensate and restore all consumed raw materials back to warehouse inventory. A mandatory audit reason is required.
            </p>

            <form onSubmit={handleReverseBatch} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Mandatory Reversal Reason *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Formulation calibration error, lab assistant error..."
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsReverseModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold"
                >
                  Confirm Reversal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Detail Modal */}
      {isDetailModalOpen && selectedBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-[#121620] border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl relative max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="font-serif font-bold text-base text-slate-100">
                  Batch Audit: {selectedBatch.batch_code}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedBatch.perfume_name} ({selectedBatch.formula_version_label})
                </p>
              </div>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mt-4 space-y-4 text-xs pr-1">
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                  <div className="text-[10px] text-slate-500 uppercase">Actual Volume</div>
                  <div className="font-mono font-bold text-slate-100 mt-0.5">
                    {selectedBatch.actual_volume} ml
                  </div>
                </div>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                  <div className="text-[10px] text-slate-500 uppercase">Remaining Bulk</div>
                  <div className="font-mono font-bold text-emerald-400 mt-0.5">
                    {selectedBatch.remaining_volume} ml
                  </div>
                </div>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                  <div className="text-[10px] text-slate-500 uppercase">Cost Per ml</div>
                  <div className="font-mono font-bold text-gold-300 mt-0.5">
                    ${parseFloat(selectedBatch.cost_per_ml).toFixed(4)}
                  </div>
                </div>
              </div>

              {/* Usages Snapshot */}
              <div>
                <div className="font-semibold text-slate-200 mb-2">Raw Material Consumptions Snapshot</div>
                {selectedBatch.usages && selectedBatch.usages.length > 0 ? (
                  <div className="rounded-xl border border-slate-800 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#141824] text-slate-400 font-semibold text-[10px] uppercase">
                        <tr>
                          <th className="py-2 px-3">Material</th>
                          <th className="py-2 px-3">Quantity Used</th>
                          <th className="py-2 px-3">Unit Cost Snapshot</th>
                          <th className="py-2 px-3 text-right">Line Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300">
                        {selectedBatch.usages.map((u) => (
                          <tr key={u.id}>
                            <td className="py-2 px-3">
                              <div className="font-semibold text-slate-100">{u.raw_material_name}</div>
                              <div className="text-[9px] font-mono text-slate-500">{u.raw_material_sku}</div>
                            </td>
                            <td className="py-2 px-3 font-mono">
                              {u.quantity_used} {u.unit}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-400">
                              ${parseFloat(u.unit_cost_snapshot).toFixed(4)}
                            </td>
                            <td className="py-2 px-3 font-mono text-right text-gold-300">
                              ${parseFloat(u.line_cost).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-slate-500 text-center py-4 bg-slate-900/40 rounded-xl">
                    No consumption snapshot records found for draft batch.
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
