import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Compass,
  Search,
  FlaskConical,
  PackageCheck,
  ShoppingCart,
  User,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { apiClient } from '../lib/api';
import { formatCurrency, formatNumber } from '../lib/utils';

export const TraceabilityPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState<string>('BAT-2026-0001');
  const [activeQuery, setActiveQuery] = useState<string>('BAT-2026-0001');

  // Unified Search suggestions
  const { data: searchResults = [] } = useQuery({
    queryKey: ['trace-search', searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];
      const res = await apiClient<any[]>(`/api/v1/trace/search?q=${encodeURIComponent(searchTerm)}`);
      return res.data || [];
    },
    enabled: searchTerm.length >= 2,
  });

  // Forward Trace Query (if batch code or ID)
  const isBatchQuery = activeQuery.toUpperCase().startsWith('BAT') || activeQuery.startsWith('bat-');
  const { data: forwardTrace, isLoading: loadingForward, error: errorForward } = useQuery({
    queryKey: ['trace-forward', activeQuery],
    queryFn: async () => {
      const res = await apiClient<any>(`/api/v1/trace/batch/${encodeURIComponent(activeQuery)}`);
      return res.data;
    },
    enabled: isBatchQuery && !!activeQuery,
  });

  // Backward Trace Query (if invoice number or sale ID)
  const isSaleQuery = !isBatchQuery;
  const { data: backwardTrace, isLoading: loadingBackward, error: errorBackward } = useQuery({
    queryKey: ['trace-backward', activeQuery],
    queryFn: async () => {
      const res = await apiClient<any>(`/api/v1/trace/sale/${encodeURIComponent(activeQuery)}`);
      return res.data;
    },
    enabled: isSaleQuery && !!activeQuery,
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      setActiveQuery(searchTerm.trim());
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-gold-400 to-amber-600 flex items-center justify-center shadow-lg shadow-gold-500/20">
            <Compass className="h-5 w-5 text-slate-950" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-slate-100 flex items-center gap-2">
              Bidirectional Traceability Navigator
            </h1>
            <p className="text-xs text-slate-400">
              Complete forward tracking from batch to customer invoice, and backward tracking from receipt to raw oils
            </p>
          </div>
        </div>

        {/* Quick Sample Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-slate-500">Quick Demo Presets:</span>
          <button
            onClick={() => {
              setSearchTerm('BAT-2026-0001');
              setActiveQuery('BAT-2026-0001');
            }}
            className="px-2.5 py-1 text-xs rounded border border-slate-800 bg-slate-900/60 text-gold-400 hover:border-gold-500/50 font-mono transition-colors"
          >
            BAT-2026-0001
          </button>
          <button
            onClick={() => {
              setSearchTerm('INV-2026-00001');
              setActiveQuery('INV-2026-00001');
            }}
            className="px-2.5 py-1 text-xs rounded border border-slate-800 bg-slate-900/60 text-cyan-400 hover:border-cyan-500/50 font-mono transition-colors"
          >
            INV-2026-00001
          </button>
        </div>
      </div>

      {/* Unified Search Bar */}
      <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Batch Code (BAT-2026-0001), Invoice Number (INV-2026-00001), or Lot..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-gold-500"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-gold-500 text-slate-950 font-semibold text-xs hover:bg-gold-400 transition-colors shadow-sm"
          >
            Trace Provenance
          </button>
        </form>

        {/* Search Autocomplete Suggestions */}
        {searchResults.length > 0 && searchTerm !== activeQuery && (
          <div className="p-2 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
            <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500 px-2 py-1">
              Matching Entities in Registry
            </div>
            {searchResults.map((item: any) => (
              <button
                key={item.id}
                onClick={() => {
                  setSearchTerm(item.code_or_number);
                  setActiveQuery(item.code_or_number);
                }}
                className="w-full text-left p-2 rounded-lg hover:bg-slate-900/80 flex items-center justify-between text-xs text-slate-300 transition-colors"
              >
                <div>
                  <span className="font-mono font-bold text-gold-400 mr-2">{item.code_or_number}</span>
                  <span className="font-medium text-slate-200">{item.title}</span>
                  <span className="text-[11px] text-slate-500 ml-2">({item.subtitle})</span>
                </div>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                  {item.entity_type}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading States */}
      {(loadingForward || loadingBackward) && (
        <div className="p-12 text-center text-slate-500 text-xs">
          Tracing provenance across manufacturing, bottling, and sales ledgers...
        </div>
      )}

      {/* 1. Forward Traceability View: Batch -> Bottling -> Lots -> Sales */}
      {isBatchQuery && forwardTrace && (
        <div className="space-y-6 animate-fadeIn">
          {/* Active Inspection Banner */}
          <div className="p-5 rounded-2xl border border-gold-500/40 bg-gradient-to-r from-slate-900 via-slate-900/90 to-card flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded text-[10px] uppercase font-mono font-bold bg-gold-500/20 border border-gold-500/40 text-gold-300">
                  Forward Trace Mode
                </span>
                <span className="text-xs font-mono text-slate-400">
                  Batch Code: <strong>{forwardTrace.batch.batch_code}</strong>
                </span>
              </div>
              <h2 className="text-xl font-serif font-bold text-slate-100 mt-1">
                {forwardTrace.batch.perfume_name}
              </h2>
              <p className="text-xs text-slate-400">
                Formula Version {forwardTrace.batch.formula_version_label} | Produced{' '}
                {new Date(forwardTrace.batch.production_date).toLocaleDateString()} | Cost/ml:{' '}
                {formatCurrency(forwardTrace.batch.cost_per_ml)}
              </p>
            </div>

            <div className="flex items-center space-x-4 text-xs font-mono">
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 text-right">
                <div className="text-[10px] uppercase text-slate-500">Actual Yield</div>
                <div className="text-sm font-bold text-slate-100">
                  {formatNumber(forwardTrace.batch.actual_volume)} ml
                </div>
              </div>
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 text-right">
                <div className="text-[10px] uppercase text-slate-500">Remaining Bulk</div>
                <div className="text-sm font-bold text-emerald-400">
                  {formatNumber(forwardTrace.batch.remaining_volume)} ml
                </div>
              </div>
            </div>
          </div>

          {/* Flow Stepper / Tree Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1: Formula & Composition */}
            <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 space-y-4">
              <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-gold-400">
                <FlaskConical className="h-4 w-4" />
                <span>1. Formula BOM Origin</span>
              </div>
              <div className="space-y-2 text-xs text-slate-300">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="font-semibold text-slate-100">{forwardTrace.formula?.perfume_name}</div>
                  <div className="text-[11px] font-mono text-slate-400 mt-1">
                    Code: {forwardTrace.formula?.code} | Status: {forwardTrace.formula?.status?.toUpperCase()}
                  </div>
                </div>
                <div className="text-[11px] text-slate-400">
                  Ingredients compounded into bulk liquid:
                </div>
                <div className="space-y-1.5 font-mono text-[11px]">
                  {forwardTrace.formula?.ingredients?.map((ing: any) => (
                    <div
                      key={ing.id}
                      className="flex justify-between p-2 rounded bg-slate-950/60 border border-slate-800/60"
                    >
                      <span className="text-slate-300 font-sans">{ing.raw_material_name}</span>
                      <span className="text-gold-400 font-bold">{formatNumber(ing.value)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 2: Bottling Runs & Lots */}
            <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 space-y-4">
              <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-cyan-400">
                <PackageCheck className="h-4 w-4" />
                <span>2. Bottling Runs & Flacons ({forwardTrace.bottling_runs.length})</span>
              </div>

              {forwardTrace.bottling_runs.length === 0 ? (
                <div className="text-xs text-slate-500 py-6 text-center">
                  No finished bottling runs executed from this batch yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {forwardTrace.bottling_runs.map((run: any) => (
                    <div
                      key={run.id}
                      className="p-3.5 rounded-xl border border-slate-800 bg-slate-950 space-y-2 text-xs"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-mono font-bold text-cyan-300">{run.run_code}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(run.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-slate-300 font-medium">{run.product_name}</div>
                      <div className="flex justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/60">
                        <span>Bottled: {formatNumber(run.quantity_bottled)} units</span>
                        <span className="text-gold-300">Cost: {formatCurrency(run.unit_cost)}</span>
                      </div>
                      {run.lot && (
                        <div className="text-[10px] font-mono text-emerald-400 bg-emerald-950/20 border border-emerald-500/20 p-1.5 rounded">
                          Lot: {run.lot.lot_number} (Stock: {formatNumber(run.lot.current_quantity)})
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Step 3: Consumer Sales Invoices */}
            <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 space-y-4">
              <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                <ShoppingCart className="h-4 w-4" />
                <span>3. Distributed Retail Sales ({forwardTrace.sales.length})</span>
              </div>

              {forwardTrace.sales.length === 0 ? (
                <div className="text-xs text-slate-500 py-6 text-center">
                  No units from this batch have been sold via retail POS yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {forwardTrace.sales.map((sale: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-slate-800 bg-slate-950 space-y-1.5 text-xs"
                    >
                      <div className="flex justify-between items-center">
                        <button
                          onClick={() => {
                            setSearchTerm(sale.invoice_number);
                            setActiveQuery(sale.invoice_number);
                          }}
                          className="font-mono font-bold text-gold-400 hover:underline flex items-center gap-1"
                        >
                          <span>{sale.invoice_number}</span>
                          <ExternalLink className="h-3 w-3" />
                        </button>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(sale.sale_date).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-slate-300 flex items-center gap-1.5">
                        <User className="h-3 w-3 text-slate-500" />
                        <span>{sale.customer_name}</span>
                      </div>
                      <div className="flex justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/60">
                        <span className="capitalize">{sale.item_type}: {formatNumber(sale.quantity)} units</span>
                        <span className="text-slate-200 font-bold">{formatCurrency(sale.line_total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. Backward Traceability View: Sale -> Lot -> Bottling -> Batch -> Raw Oils */}
      {isSaleQuery && backwardTrace && (
        <div className="space-y-6 animate-fadeIn">
          {/* Active Inspection Banner */}
          <div className="p-5 rounded-2xl border border-cyan-500/40 bg-gradient-to-r from-slate-900 via-slate-900/90 to-card flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded text-[10px] uppercase font-mono font-bold bg-cyan-500/20 border border-cyan-500/40 text-cyan-300">
                  Backward Provenance Mode
                </span>
                <span className="text-xs font-mono text-slate-400">
                  Invoice: <strong>{backwardTrace.sale.invoice_number}</strong>
                </span>
              </div>
              <h2 className="text-xl font-serif font-bold text-slate-100 mt-1">
                Client: {backwardTrace.sale.customer_name || 'Walk-in Boutique Client'}
              </h2>
              <p className="text-xs text-slate-400">
                Purchased on {new Date(backwardTrace.sale.created_at).toLocaleString()} | Status:{' '}
                <span className="uppercase text-emerald-400 font-bold">{backwardTrace.sale.status}</span>
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 text-right font-mono">
              <div className="text-[10px] uppercase text-slate-500">Invoice Total</div>
              <div className="text-xl font-bold text-gold-400">
                {formatCurrency(backwardTrace.sale.total_amount)}
              </div>
            </div>
          </div>

          {/* Reverse Chain for each Line Item */}
          <div className="space-y-6">
            {backwardTrace.trace_items.map((item: any, idx: number) => (
              <div
                key={idx}
                className="p-6 rounded-2xl border border-slate-800/80 bg-slate-900/60 space-y-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono font-bold bg-slate-800 text-slate-300">
                      Line #{idx + 1} ({item.item_type})
                    </span>
                    <span className="text-sm font-semibold text-slate-200">
                      {item.lot ? item.lot.product_name : item.batch?.perfume_name}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-slate-400">
                    Quantity: {formatNumber(item.quantity)} | Unit Price: {formatCurrency(item.unit_price)} |
                    Lot Unit Cost: {formatCurrency(item.unit_cost_snapshot)}
                  </div>
                </div>

                {/* 4-Step Reverse Chain Flow Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Step 1: Finished Lot */}
                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-2 text-xs">
                    <div className="text-[10px] uppercase font-mono text-emerald-400 font-bold">
                      1. Finished Lot
                    </div>
                    {item.lot ? (
                      <>
                        <div className="font-mono text-gold-300 font-semibold">{item.lot.lot_number}</div>
                        <div className="text-[11px] text-slate-400">{item.lot.variant_name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Unit Cost: {formatCurrency(item.lot.unit_cost)}
                        </div>
                      </>
                    ) : (
                      <div className="text-[11px] text-cyan-400 font-mono">
                        Direct Countertop Decant from Bulk Batch
                      </div>
                    )}
                  </div>

                  {/* Step 2: Bottling Run */}
                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-2 text-xs">
                    <div className="text-[10px] uppercase font-mono text-cyan-400 font-bold">
                      2. Bottling Run
                    </div>
                    {item.bottling_run ? (
                      <>
                        <div className="font-mono text-slate-200 font-bold">
                          {item.bottling_run.run_code}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Bottled: {formatNumber(item.bottling_run.quantity_bottled)} units
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Bulk Deducted: {formatNumber(item.bottling_run.bulk_volume_deducted)} ml
                        </div>
                      </>
                    ) : (
                      <div className="text-[11px] text-slate-500">N/A (Decanted at register)</div>
                    )}
                  </div>

                  {/* Step 3: Manufacturing Batch */}
                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-2 text-xs">
                    <div className="text-[10px] uppercase font-mono text-gold-400 font-bold">
                      3. Bulk Batch
                    </div>
                    {item.batch ? (
                      <>
                        <button
                          onClick={() => {
                            setSearchTerm(item.batch.batch_code);
                            setActiveQuery(item.batch.batch_code);
                          }}
                          className="font-mono font-bold text-gold-400 hover:underline flex items-center gap-1"
                        >
                          <span>{item.batch.batch_code}</span>
                          <ExternalLink className="h-3 w-3" />
                        </button>
                        <div className="text-[11px] text-slate-300 font-medium">
                          {item.batch.perfume_name}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          Yield: {formatNumber(item.batch.actual_volume)} ml @ {formatCurrency(item.batch.cost_per_ml)}/ml
                        </div>
                      </>
                    ) : (
                      <div className="text-slate-500 text-xs">Unknown batch</div>
                    )}
                  </div>

                  {/* Step 4: Compounding Raw Materials */}
                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-2 text-xs">
                    <div className="text-[10px] uppercase font-mono text-amber-400 font-bold">
                      4. Raw Materials & Oils
                    </div>
                    <div className="space-y-1 font-mono text-[10px]">
                      {item.raw_material_origins.slice(0, 3).map((rm: any, i: number) => (
                        <div key={i} className="flex justify-between text-slate-300">
                          <span className="truncate pr-2 font-sans">{rm.name}</span>
                          <span className="text-gold-400 font-bold">
                            {formatNumber(rm.quantity_used)} {rm.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty / Error state */}
      {(errorForward || errorBackward) && (
        <div className="p-8 rounded-xl border border-red-500/30 bg-red-500/10 text-center space-y-2">
          <AlertCircle className="h-6 w-6 text-red-400 mx-auto" />
          <div className="text-sm font-semibold text-red-200">Entity Not Found in Provenance Ledger</div>
          <p className="text-xs text-red-300">
            Could not locate batch, invoice, or lot matching "{activeQuery}". Please verify the code and try again.
          </p>
        </div>
      )}
    </div>
  );
};

export default TraceabilityPage;
