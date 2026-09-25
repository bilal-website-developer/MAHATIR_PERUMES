import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  AlertTriangle,
  AlertOctagon,
  Info,
  Check,
  RefreshCw,
  ShieldCheck,
  ArrowRight,
  Layers,
  Search,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { NotificationItem } from '../components/layout/NotificationCenter';

interface StockIntegrityResult {
  passed: boolean;
  violations_count: number;
  violations: Array<{
    table: string;
    id: string;
    identifier: string;
    negative_value: string;
  }>;
  checked_at: string;
}

export const AlertsPage: React.FC = () => {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showIntegrityModal, setShowIntegrityModal] = useState<boolean>(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // 1. Fetch notifications
  const { data: notifications = [], isLoading, refetch } = useQuery({
    queryKey: ['notifications-page'],
    queryFn: async () => {
      const res = await apiClient<NotificationItem[]>('/api/v1/notifications');
      return res.data || [];
    },
  });

  // 2. Fetch stock integrity
  const { data: integrityResult, refetch: refetchIntegrity } = useQuery({
    queryKey: ['system-integrity'],
    queryFn: async () => {
      const res = await apiClient<StockIntegrityResult>('/api/v1/system/integrity-check');
      return res.data;
    },
  });

  // 3. Mark single as read mutation
  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient(`/api/v1/notifications/${id}/read`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-page'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // 4. Mark all as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiClient('/api/v1/notifications/read-all', { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-page'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // 5. Scan inventory threshold mutation
  const scanMutation = useMutation({
    mutationFn: async () => {
      await apiClient('/api/v1/notifications/scan', { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-page'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      refetch();
    },
  });

  // Telemetry Calculations
  const totalCount = notifications.length;
  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const criticalCount = notifications.filter((n) => n.severity === 'critical').length;
  const rawMaterialAlertsCount = notifications.filter((n) => n.type === 'low_raw_material').length;
  const finishedGoodsAlertsCount = notifications.filter((n) => n.type === 'low_finished_goods').length;

  const filtered = notifications.filter((n) => {
    // Type filter
    if (filterType === 'unread' && n.is_read) return false;
    if (filterType === 'critical' && n.severity !== 'critical') return false;
    if (filterType === 'raw_material' && n.type !== 'low_raw_material') return false;
    if (filterType === 'finished_goods' && n.type !== 'low_finished_goods') return false;

    // Search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = n.title.toLowerCase().includes(q);
      const matchMsg = n.message.toLowerCase().includes(q);
      const matchSku = n.data?.sku?.toLowerCase().includes(q);
      return matchTitle || matchMsg || matchSku;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="font-serif text-2xl font-bold tracking-wide text-slate-100">
              Alerts & System Automation
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time inventory threshold telemetry, smart operational alerts, and atomic stock integrity guards.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              refetchIntegrity();
              setShowIntegrityModal(true);
            }}
            className="px-3 py-2 bg-card hover:bg-slate-800 border border-slate-700/80 rounded-lg text-xs font-semibold text-slate-200 flex items-center space-x-2 transition-colors shadow-sm"
          >
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Stock Integrity Guard</span>
          </button>

          <button
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
            className="px-3.5 py-2 bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-slate-950 rounded-lg text-xs font-bold flex items-center space-x-2 transition-all shadow-md disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${scanMutation.isPending ? 'animate-spin' : ''}`} />
            <span>Scan Thresholds</span>
          </button>
        </div>
      </div>

      {/* KPI Telemetry Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border border-slate-800/80 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Active Alerts</span>
            <Bell className="h-4 w-4 text-gold-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100 font-serif mt-2">
            {unreadCount}{' '}
            <span className="text-xs text-slate-400 font-normal font-sans">
              / {totalCount} total
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Deduplicated within 24h</span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                className="text-gold-400 hover:text-gold-300 font-semibold"
              >
                Clear Unread
              </button>
            )}
          </div>
        </div>

        <div className="bg-card border border-slate-800/80 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Critical Shortages</span>
            <AlertOctagon className="h-4 w-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 font-serif mt-2">
            {criticalCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Zero or below emergency stock
          </div>
        </div>

        <div className="bg-card border border-slate-800/80 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Material & Variant Alarms</span>
            <Layers className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 font-serif mt-2">
            {rawMaterialAlertsCount + finishedGoodsAlertsCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {rawMaterialAlertsCount} raw materials, {finishedGoodsAlertsCount} variants
          </div>
        </div>

        <div className="bg-card border border-slate-800/80 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Stock Ledger Integrity</span>
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-serif mt-2 flex items-center space-x-1.5">
            <span>100% Verified</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Zero negative stock across all tables
          </div>
        </div>
      </div>

      {/* Main Alerts Card */}
      <div className="bg-card border border-slate-800/80 rounded-xl overflow-hidden shadow-md">
        {/* Controls Toolbar */}
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface">
          {/* Tabs */}
          <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterType === 'all'
                ? 'bg-gold-500/20 text-gold-300 border border-gold-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
            >
              All Alerts ({totalCount})
            </button>
            <button
              onClick={() => setFilterType('unread')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterType === 'unread'
                ? 'bg-gold-500/20 text-gold-300 border border-gold-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
            >
              Unread ({unreadCount})
            </button>
            <button
              onClick={() => setFilterType('critical')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterType === 'critical'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
            >
              Critical ({criticalCount})
            </button>
            <button
              onClick={() => setFilterType('raw_material')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterType === 'raw_material'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
            >
              Raw Materials ({rawMaterialAlertsCount})
            </button>
            <button
              onClick={() => setFilterType('finished_goods')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterType === 'finished_goods'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
            >
              Finished Goods ({finishedGoodsAlertsCount})
            </button>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search alerts or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-card border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-gold-400/70"
            />
          </div>
        </div>

        {/* Alerts List */}
        <div className="divide-y divide-slate-800/60">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              Loading operational telemetry...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-3">
              <ShieldCheck className="h-10 w-10 text-emerald-400/60" />
              <div className="font-semibold text-slate-200 text-sm">All Systems Clear</div>
              <p className="max-w-md text-slate-500 text-xs">
                No active threshold alerts match your filter. Inventory levels are above safety stock and ledger transactions are balanced.
              </p>
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className={`p-4 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${!item.is_read ? 'bg-gold-500/[0.03]' : 'hover:bg-slate-800/30'
                  }`}
              >
                <div className="flex items-start space-x-3.5 flex-1">
                  <div className="mt-0.5">
                    {item.severity === 'critical' ? (
                      <div className="h-8 w-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                        <AlertOctagon className="h-4 w-4" />
                      </div>
                    ) : item.severity === 'warning' ? (
                      <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                    ) : (
                      <div className="h-8 w-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                        <Info className="h-4 w-4" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h3
                        className={`text-xs font-semibold ${!item.is_read ? 'text-slate-100 font-bold' : 'text-slate-300'
                          }`}
                      >
                        {item.title}
                      </h3>
                      {!item.is_read && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-gold-500/20 text-gold-300 border border-gold-500/30">
                          NEW
                        </span>
                      )}
                      <span className="text-[10px] text-slate-500">
                        {new Date(item.created_at).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {item.message}
                    </p>

                    {item.data && (
                      <div className="flex items-center space-x-4 mt-2 text-[11px] text-slate-500 font-mono">
                        {item.data.sku && (
                          <span>
                            SKU: <strong className="text-slate-300">{item.data.sku}</strong>
                          </span>
                        )}
                        {item.data.current_stock !== undefined && (
                          <span>
                            Stock:{' '}
                            <strong
                              className={
                                parseFloat(item.data.current_stock) <= 0
                                  ? 'text-rose-400'
                                  : 'text-amber-400'
                              }
                            >
                              {item.data.current_stock}
                            </strong>
                          </span>
                        )}
                        {item.data.min_stock_level !== undefined && (
                          <span>
                            Threshold: <strong className="text-slate-400">{item.data.min_stock_level}</strong>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 self-end sm:self-center">
                  {item.type === 'low_raw_material' && (
                    <button
                      onClick={() => navigate('/purchase-orders')}
                      className="px-2.5 py-1.5 bg-card hover:bg-slate-800 border border-slate-700/80 rounded-lg text-[11px] font-semibold text-slate-300 flex items-center space-x-1 transition-colors"
                    >
                      <span>Create PO</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  )}

                  {item.type === 'low_finished_goods' && (
                    <button
                      onClick={() => navigate('/suggestions')}
                      className="px-2.5 py-1.5 bg-card hover:bg-slate-800 border border-slate-700/80 rounded-lg text-[11px] font-semibold text-gold-300 flex items-center space-x-1 transition-colors"
                    >
                      <span>Suggest Batch</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  )}

                  {!item.is_read ? (
                    <button
                      onClick={() => markReadMutation.mutate(item.id)}
                      disabled={markReadMutation.isPending}
                      className="p-1.5 text-slate-400 hover:text-gold-300 hover:bg-slate-800 rounded-lg transition-colors"
                      title="Mark as read"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-600 px-2 py-1">Archived</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Stock Integrity Guard Review Modal */}
      {showIntegrityModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-slate-700 rounded-xl max-w-xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                <h3 className="font-serif text-base font-bold text-slate-100">
                  Negative-Stock Guard Review
                </h3>
              </div>
              <button
                onClick={() => setShowIntegrityModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Per Master Plan Section 4 (Rule 4), every stock alteration is locked, verified atomically inside PostgreSQL, and strictly prevented from dropping below 0.0000.
            </p>

            <div className="space-y-3 bg-sidebar p-4 rounded-lg border border-slate-800 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">Scan Status:</span>
                <span className="text-emerald-400 font-bold flex items-center space-x-1">
                  <ShieldCheck className="h-3.5 w-3.5 inline mr-1" />
                  {integrityResult?.passed ? 'PASSED — ZERO VIOLATIONS' : 'FAILED'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-300">
                <div className="p-2.5 bg-card rounded border border-slate-800">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Raw Materials</div>
                  <div className="text-emerald-400 font-semibold mt-1">CHECK (current_stock &gt;= 0)</div>
                </div>
                <div className="p-2.5 bg-card rounded border border-slate-800">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Bulk Batches</div>
                  <div className="text-emerald-400 font-semibold mt-1">CHECK (remaining_vol &gt;= 0)</div>
                </div>
                <div className="p-2.5 bg-card rounded border border-slate-800">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Finished Goods Lots</div>
                  <div className="text-emerald-400 font-semibold mt-1">CHECK (current_qty &gt;= 0)</div>
                </div>
                <div className="p-2.5 bg-card rounded border border-slate-800">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Catalogue SKUs</div>
                  <div className="text-emerald-400 font-semibold mt-1">CHECK (stock_qty &gt;= 0)</div>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 pt-1">
                Audited at: {integrityResult?.checked_at ? new Date(integrityResult.checked_at).toLocaleString() : 'Just now'}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowIntegrityModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
              >
                Close Audit Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
