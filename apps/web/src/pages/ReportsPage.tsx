import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Layers,
  TrendingUp,
  Percent,
  Factory,
  Package,
} from 'lucide-react';
import { apiClient } from '../lib/api';
import { formatCurrency, formatNumber } from '../lib/utils';

type ReportTab = 'valuation' | 'sales' | 'profitability' | 'batches' | 'consumption';

export const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportTab>('valuation');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // 1. Valuation Report Query
  const { data: valuation, isLoading: loadingValuation } = useQuery({
    queryKey: ['report-valuation'],
    queryFn: async () => {
      const res = await apiClient<any>('/api/v1/reports/inventory-valuation');
      return res.data;
    },
    enabled: activeTab === 'valuation',
  });

  // 2. Sales Report Query
  const { data: salesReport } = useQuery({
    queryKey: ['report-sales', startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const url = `/api/v1/reports/sales-performance${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await apiClient<any>(url);
      return res.data;
    },
    enabled: activeTab === 'sales',
  });

  // 3. Profitability Query
  const { data: profitability = [], isLoading: loadingProfit } = useQuery({
    queryKey: ['report-profitability'],
    queryFn: async () => {
      const res = await apiClient<any[]>('/api/v1/reports/product-profitability');
      return res.data || [];
    },
    enabled: activeTab === 'profitability',
  });

  // 4. Batch Cost Query
  const { data: batchAnalysis = [], isLoading: loadingBatches } = useQuery({
    queryKey: ['report-batch-cost'],
    queryFn: async () => {
      const res = await apiClient<any[]>('/api/v1/reports/batch-cost-analysis');
      return res.data || [];
    },
    enabled: activeTab === 'batches',
  });

  // 5. Consumption Query
  const { data: consumption = [], isLoading: loadingConsumption } = useQuery({
    queryKey: ['report-consumption'],
    queryFn: async () => {
      const res = await apiClient<any[]>('/api/v1/reports/raw-material-consumption');
      return res.data || [];
    },
    enabled: activeTab === 'consumption',
  });

  // Handle direct CSV download
  const handleExportCsv = () => {
    let endpoint = '';
    switch (activeTab) {
      case 'valuation':
        endpoint = '/api/v1/reports/inventory-valuation?format=csv';
        break;
      case 'sales':
        endpoint = `/api/v1/reports/sales-performance?format=csv${startDate ? `&startDate=${startDate}` : ''}${endDate ? `&endDate=${endDate}` : ''
          }`;
        break;
      case 'profitability':
        endpoint = '/api/v1/reports/product-profitability?format=csv';
        break;
      case 'batches':
        endpoint = '/api/v1/reports/batch-cost-analysis?format=csv';
        break;
      case 'consumption':
        endpoint = '/api/v1/reports/raw-material-consumption?format=csv';
        break;
    }
    const token = localStorage.getItem('mahatir_token') || 'demo-admin';
    const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL;
    const baseUrl =
      import.meta.env.PROD && configuredApiBaseUrl?.includes('localhost')
        ? ''
        : configuredApiBaseUrl ?? (import.meta.env.PROD ? '' : 'http://localhost:4000');
    window.open(`${baseUrl}${endpoint}&token=${token}`, '_blank');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-gold-400 to-amber-600 flex items-center justify-center shadow-lg shadow-gold-500/20">
            <FileSpreadsheet className="h-5 w-5 text-slate-950" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-slate-100">
              Business Intelligence & Financial Reports
            </h1>
            <p className="text-xs text-slate-400">
              Audited inventory valuations, sales profit metrics, and manufacturing yield analytics
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleExportCsv}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-lg border border-gold-500/40 bg-gold-500/10 text-gold-300 hover:bg-gold-500/20 font-medium text-xs transition-all shadow-sm"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 overflow-x-auto">
        {[
          { id: 'valuation', label: 'Inventory Valuation', icon: Layers },
          { id: 'sales', label: 'Sales & Margins', icon: TrendingUp },
          { id: 'profitability', label: 'SKU Profitability', icon: Percent },
          { id: 'batches', label: 'Batch Costs & Yield', icon: Factory },
          { id: 'consumption', label: 'Material Consumption', icon: Package },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ReportTab)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${isActive
                ? 'bg-gold-500 text-slate-950 font-bold shadow-md shadow-gold-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. Inventory Valuation Tab */}
      {activeTab === 'valuation' && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-4 rounded-xl border border-gold-500/30 bg-slate-900/60">
              <div className="text-[10px] uppercase font-mono tracking-wider text-gold-400">Total Valuation</div>
              <div className="text-xl font-serif font-bold text-slate-100 mt-1">
                {formatCurrency(valuation?.summary?.total_valuation || 0)}
              </div>
              <div className="text-[10px] text-slate-400 mt-1 font-mono">
                {valuation?.summary?.total_items_count || 0} Assets Counted
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Raw Perfume Oils</div>
              <div className="text-xl font-serif font-bold text-slate-200 mt-1">
                {formatCurrency(valuation?.summary?.raw_materials_valuation || 0)}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Bulk Maceration Liquid</div>
              <div className="text-xl font-serif font-bold text-slate-200 mt-1">
                {formatCurrency(valuation?.summary?.bulk_liquid_valuation || 0)}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Packaging Materials</div>
              <div className="text-xl font-serif font-bold text-slate-200 mt-1">
                {formatCurrency(valuation?.summary?.packaging_valuation || 0)}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Finished Goods Flacons</div>
              <div className="text-xl font-serif font-bold text-slate-200 mt-1">
                {formatCurrency(valuation?.summary?.finished_goods_valuation || 0)}
              </div>
            </div>
          </div>

          {/* Breakdown Table */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
              Asset Valuation Breakdown by Warehouse Section
            </h2>

            {loadingValuation ? (
              <div className="text-center py-12 text-slate-500 text-xs">Loading inventory valuations...</div>
            ) : (
              <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/40">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase font-mono">
                    <tr>
                      <th className="py-3 px-4">Item Name</th>
                      <th className="py-3 px-4">SKU / Code</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4 text-right">Available Stock</th>
                      <th className="py-3 px-4 text-right">Unit Cost (WAC)</th>
                      <th className="py-3 px-4 text-right">Total Valuation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                    {/* Finished Goods */}
                    {valuation?.finished_goods?.map((fg: any) => (
                      <tr key={fg.sku} className="hover:bg-slate-900/40">
                        <td className="py-2.5 px-4 font-sans font-medium text-slate-200">{fg.name}</td>
                        <td className="py-2.5 px-4 text-gold-400 font-bold">{fg.sku}</td>
                        <td className="py-2.5 px-4 text-emerald-400 uppercase text-[10px]">Finished Goods</td>
                        <td className="py-2.5 px-4 text-right">{formatNumber(fg.quantity)} units</td>
                        <td className="py-2.5 px-4 text-right">{formatCurrency(fg.unit_cost)}</td>
                        <td className="py-2.5 px-4 text-right font-bold text-slate-100">{formatCurrency(fg.total_valuation)}</td>
                      </tr>
                    ))}
                    {/* Bulk Liquid */}
                    {valuation?.bulk_liquids?.map((blk: any) => (
                      <tr key={blk.sku} className="hover:bg-slate-900/40">
                        <td className="py-2.5 px-4 font-sans font-medium text-slate-200">{blk.name}</td>
                        <td className="py-2.5 px-4 text-cyan-400">{blk.sku}</td>
                        <td className="py-2.5 px-4 text-cyan-400 uppercase text-[10px]">Bulk Liquid</td>
                        <td className="py-2.5 px-4 text-right">{formatNumber(blk.quantity)} ml</td>
                        <td className="py-2.5 px-4 text-right">{formatCurrency(blk.unit_cost)}/ml</td>
                        <td className="py-2.5 px-4 text-right font-bold text-slate-100">{formatCurrency(blk.total_valuation)}</td>
                      </tr>
                    ))}
                    {/* Raw Materials */}
                    {valuation?.raw_materials?.map((rm: any) => (
                      <tr key={rm.sku} className="hover:bg-slate-900/40">
                        <td className="py-2.5 px-4 font-sans font-medium text-slate-200">{rm.name}</td>
                        <td className="py-2.5 px-4 text-slate-400">{rm.sku}</td>
                        <td className="py-2.5 px-4 text-amber-400 uppercase text-[10px]">{rm.category}</td>
                        <td className="py-2.5 px-4 text-right">{formatNumber(rm.quantity)} {rm.unit}</td>
                        <td className="py-2.5 px-4 text-right">{formatCurrency(rm.unit_cost)}</td>
                        <td className="py-2.5 px-4 text-right font-bold text-slate-100">{formatCurrency(rm.total_valuation)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Sales & Cashier Performance Tab */}
      {activeTab === 'sales' && (
        <div className="space-y-6">
          {/* Date Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl border border-slate-800 bg-slate-900/60">
            <div className="flex items-center space-x-2 text-xs text-slate-400">
              <Calendar className="h-4 w-4 text-gold-400" />
              <span>Date Filter:</span>
            </div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
            />
            <span className="text-xs text-slate-500">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-xs text-gold-400 hover:underline"
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Sales Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Total Revenue</div>
              <div className="text-2xl font-serif font-bold text-slate-100 mt-1">
                {formatCurrency(salesReport?.summary?.total_revenue || 0)}
              </div>
              <div className="text-[10px] text-slate-400 mt-1 font-mono">
                {salesReport?.summary?.invoice_count || 0} Invoices Completed
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Total COGS (Lot Cost)</div>
              <div className="text-2xl font-serif font-bold text-slate-300 mt-1">
                {formatCurrency(salesReport?.summary?.total_cogs || 0)}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-gold-500/40 bg-gold-500/10">
              <div className="text-[10px] uppercase font-mono tracking-wider text-gold-400">Net Gross Profit</div>
              <div className="text-2xl font-serif font-bold text-gold-300 mt-1">
                {formatCurrency(salesReport?.summary?.total_profit || 0)}
              </div>
              <div className="text-[10px] text-gold-400 mt-1 font-mono font-bold">
                {salesReport?.summary?.gross_margin_percent}% Gross Margin
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Average Order Value</div>
              <div className="text-2xl font-serif font-bold text-slate-100 mt-1">
                {formatCurrency(salesReport?.summary?.average_order_value || 0)}
              </div>
            </div>
          </div>

          {/* Cashier Performance Table */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
              Cashier & Staff Sales Performance
            </h2>
            <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/40">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase font-mono">
                  <tr>
                    <th className="py-2.5 px-4">Cashier Name</th>
                    <th className="py-2.5 px-4 text-right">Transactions</th>
                    <th className="py-2.5 px-4 text-right">Total Revenue</th>
                    <th className="py-2.5 px-4 text-right">Gross Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                  {Object.entries(salesReport?.by_cashier || {}).map(([cashier, data]: [string, any]) => (
                    <tr key={cashier} className="hover:bg-slate-900/40">
                      <td className="py-2.5 px-4 font-sans font-medium text-slate-200">{cashier}</td>
                      <td className="py-2.5 px-4 text-right">{data.count}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-100">
                        {formatCurrency(data.total_revenue)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-gold-400">
                        {formatCurrency(data.total_profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. SKU Profitability Tab */}
      {activeTab === 'profitability' && (
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
            Product & SKU Profitability Ranking
          </h2>

          {loadingProfit ? (
            <div className="text-center py-12 text-slate-500 text-xs">Loading profitability metrics...</div>
          ) : (
            <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/40">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase font-mono">
                  <tr>
                    <th className="py-3 px-4">SKU Code</th>
                    <th className="py-3 px-4">Product & Variant</th>
                    <th className="py-3 px-4 text-right">Units Sold</th>
                    <th className="py-3 px-4 text-right">Gross Revenue</th>
                    <th className="py-3 px-4 text-right">Total COGS</th>
                    <th className="py-3 px-4 text-right">Gross Profit</th>
                    <th className="py-3 px-4 text-right">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                  {profitability.map((item: any) => (
                    <tr key={item.sku} className="hover:bg-slate-900/40">
                      <td className="py-2.5 px-4 font-bold text-gold-400">{item.sku}</td>
                      <td className="py-2.5 px-4 font-sans font-medium text-slate-200">
                        {item.product_name} - {item.variant_name}
                      </td>
                      <td className="py-2.5 px-4 text-right">{formatNumber(item.units_sold)}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-100">
                        {formatCurrency(item.gross_revenue)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-400">{formatCurrency(item.total_cogs)}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-emerald-400">
                        {formatCurrency(item.gross_profit)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-gold-300">
                        {item.margin_percent}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 4. Batch Cost and Loss Analysis Tab */}
      {activeTab === 'batches' && (
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
            Manufacturing Batch Cost & Yield Analysis
          </h2>

          {loadingBatches ? (
            <div className="text-center py-12 text-slate-500 text-xs">Loading batch analysis...</div>
          ) : (
            <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/40">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase font-mono">
                  <tr>
                    <th className="py-3 px-4">Batch Code</th>
                    <th className="py-3 px-4">Perfume Formula</th>
                    <th className="py-3 px-4 text-right">Target Volume</th>
                    <th className="py-3 px-4 text-right">Actual Yield</th>
                    <th className="py-3 px-4 text-right">Loss (Evaporation/Filter)</th>
                    <th className="py-3 px-4 text-right">Total Batch Cost</th>
                    <th className="py-3 px-4 text-right">True Cost / ml</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                  {batchAnalysis.map((b: any) => (
                    <tr key={b.batch_code} className="hover:bg-slate-900/40">
                      <td className="py-2.5 px-4 font-bold text-gold-400">{b.batch_code}</td>
                      <td className="py-2.5 px-4 font-sans font-medium text-slate-200">{b.perfume_name}</td>
                      <td className="py-2.5 px-4 text-right">{formatNumber(b.expected_volume_ml)} ml</td>
                      <td className="py-2.5 px-4 text-right text-emerald-400">
                        {formatNumber(b.actual_volume_ml)} ml
                      </td>
                      <td className="py-2.5 px-4 text-right text-amber-400">
                        {formatNumber(b.loss_volume_ml)} ml ({b.loss_percent}%)
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-100">
                        {formatCurrency(b.total_manufacturing_cost)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-gold-300">
                        {formatCurrency(b.cost_per_ml)}/ml
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-800 text-slate-300">
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 5. Raw Material Consumption Tab */}
      {activeTab === 'consumption' && (
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
            Raw Material Warehouse Consumption Log
          </h2>

          {loadingConsumption ? (
            <div className="text-center py-12 text-slate-500 text-xs">Loading material consumption...</div>
          ) : (
            <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/40">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase font-mono">
                  <tr>
                    <th className="py-3 px-4">Material Name</th>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Total Quantity Consumed</th>
                    <th className="py-3 px-4 text-right">Weighted Cost (WAC)</th>
                    <th className="py-3 px-4 text-right">Total Consumed Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                  {consumption.map((c: any) => (
                    <tr key={c.raw_material_id} className="hover:bg-slate-900/40">
                      <td className="py-2.5 px-4 font-sans font-medium text-slate-200">{c.name}</td>
                      <td className="py-2.5 px-4 text-slate-400">{c.sku}</td>
                      <td className="py-2.5 px-4 text-amber-400 uppercase text-[10px]">{c.category}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-100">
                        {formatNumber(c.total_consumed)} {c.base_unit}
                      </td>
                      <td className="py-2.5 px-4 text-right">{formatCurrency(c.unit_cost)}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-gold-400">
                        {formatCurrency(c.total_cost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
