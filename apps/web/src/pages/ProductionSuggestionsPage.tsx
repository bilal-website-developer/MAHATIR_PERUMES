import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Sparkles,
  Clock,
  Factory,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { formatCurrency, formatNumber } from '../lib/utils';

interface SalesVelocity {
  units_30d: string;
  units_60d: string;
  units_90d: string;
  daily_velocity: string;
}

interface MaterialRequirementCheck {
  raw_material_id: string;
  raw_material_name: string;
  sku: string;
  category: string;
  base_unit: string;
  required_quantity: string;
  available_stock: string;
  shortage: string;
  is_sufficient: boolean;
}

interface ProductionSuggestion {
  id: string;
  variant_id: string;
  sku: string;
  variant_name: string;
  product_name: string;
  size_ml: string;
  current_stock: string;
  min_stock_level: string;
  sales_velocity: SalesVelocity;
  days_of_stock_remaining: string;
  urgency: 'critical' | 'high' | 'medium' | 'healthy';
  suggested_units: number;
  suggested_batch_volume_ml: string;
  formula_id?: string;
  formula_name?: string;
  formula_code?: string;
  materials_sufficient: boolean;
  sufficiency_rate_percent: string;
  shortages: MaterialRequirementCheck[];
  all_ingredients: MaterialRequirementCheck[];
  estimated_production_cost: string;
  create_batch_payload: {
    formula_id: string;
    target_volume_ml: number;
    perfume_name: string;
    variant_id: string;
    suggested_units: number;
  } | null;
}

export const ProductionSuggestionsPage: React.FC = () => {
  const [runwayDays, setRunwayDays] = useState<number>(30);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const navigate = useNavigate();

  // Fetch production suggestions
  const { data: suggestionsData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['production-suggestions', runwayDays],
    queryFn: async () => {
      const res = await apiClient<ProductionSuggestion[]>(
        `/api/v1/suggestions/production?runway_days=${runwayDays}`
      );
      return {
        items: res.data || [],
        meta: res.meta as any,
      };
    },
  });

  const suggestions = suggestionsData?.items || [];
  const urgentCount = suggestions.filter((s) => s.urgency === 'critical' || s.urgency === 'high').length;
  const shortageCount = suggestions.filter((s) => !s.materials_sufficient && s.suggested_units > 0).length;
  const totalVolumeMl = suggestions.reduce(
    (acc, curr) => acc + parseFloat(curr.suggested_batch_volume_ml || '0'),
    0
  );

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleCreateBatch = (suggestion: ProductionSuggestion) => {
    if (!suggestion.create_batch_payload) return;
    // Store in sessionStorage or state so Batch wizard can pre-fill
    sessionStorage.setItem('mahatir_prefill_batch', JSON.stringify(suggestion.create_batch_payload));
    navigate('/batches?wizard=open');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="font-serif text-2xl font-bold tracking-wide text-slate-100">
              Smart Production Suggestions
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Predictive manufacturing replenishment powered by 30 / 60 / 90 day sales velocity and real-time BOM warehouse stock checks.
          </p>
        </div>

        {/* Target Runway Selector */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 bg-[#161a24] p-1 rounded-lg border border-slate-700/80 text-xs">
            <span className="text-slate-400 px-2 flex items-center space-x-1">
              <Clock className="h-3.5 w-3.5 text-gold-400" />
              <span>Target Runway:</span>
            </span>
            {[15, 30, 45, 60].map((days) => (
              <button
                key={days}
                onClick={() => setRunwayDays(days)}
                className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-colors ${runwayDays === days
                  ? 'bg-gold-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
              >
                {days}d
              </button>
            ))}
          </div>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 bg-[#161a24] hover:bg-slate-800 border border-slate-700/80 text-slate-300 rounded-lg transition-colors"
            title="Recalculate Predictions"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin text-gold-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Telemetry Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#141824] border border-slate-800/80 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Critical Replenishment Needed</span>
            <AlertTriangle className="h-4 w-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 font-serif mt-2">
            {urgentCount}{' '}
            <span className="text-xs text-slate-400 font-normal font-sans">
              / {suggestions.length} SKUs
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Runway &lt; 14 days or stock depleted
          </div>
        </div>

        <div className="bg-[#141824] border border-slate-800/80 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Target Production Runway</span>
            <Clock className="h-4 w-4 text-gold-400" />
          </div>
          <div className="text-2xl font-bold text-gold-300 font-serif mt-2">
            {runwayDays} Days
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Safety stock buffer window
          </div>
        </div>

        <div className="bg-[#141824] border border-slate-800/80 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Material Readiness</span>
            <Layers className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-serif mt-2">
            {suggestions.length - shortageCount}{' '}
            <span className="text-xs text-slate-400 font-normal font-sans">
              / {suggestions.length} 100% In Stock
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {shortageCount} SKUs have ingredient shortages
          </div>
        </div>

        <div className="bg-[#141824] border border-slate-800/80 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Suggested Compounding Vol</span>
            <Factory className="h-4 w-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-sky-400 font-serif mt-2">
            {formatNumber(totalVolumeMl)} ml
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Includes 5% bottling buffer
          </div>
        </div>
      </div>

      {/* Main Suggestions Table */}
      <div className="bg-[#141824] border border-slate-800/80 rounded-xl overflow-hidden shadow-md">
        <div className="p-4 border-b border-slate-800 bg-[#11141e] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-4 w-4 text-gold-400" />
            <h3 className="font-serif text-sm font-semibold text-slate-100">
              Demand Forecast & Compounding Recommendations
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Weighted Daily Run-Rate ($V = 0.60 \times V_{'{30d}'} + 0.25 \times V_{'{60d}'} + 0.15 \times V_{'{90d}'}$)
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            Analyzing historical sales velocity and warehouse raw materials...
          </div>
        ) : suggestions.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No active product variants found in catalogue.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {suggestions.map((item) => {
              const isExpanded = expandedId === item.id;
              const daysLeft = parseFloat(item.days_of_stock_remaining);

              return (
                <div key={item.id} className="transition-colors hover:bg-slate-800/20">
                  {/* Row Summary */}
                  <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Column 1: SKU & Name */}
                    <div className="flex items-start space-x-3 flex-1 min-w-[220px]">
                      <div className="mt-1">
                        {item.urgency === 'critical' ? (
                          <span className="flex h-3 w-3 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                          </span>
                        ) : item.urgency === 'high' ? (
                          <span className="flex h-2.5 w-2.5 rounded-full bg-amber-400"></span>
                        ) : (
                          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-serif text-sm font-bold text-slate-100">
                            {item.product_name}
                          </h4>
                          <span className="text-[11px] text-gold-400 font-semibold">
                            {item.size_ml}ml
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          SKU: {item.sku}
                        </div>
                      </div>
                    </div>

                    {/* Column 2: Sales Velocity Telemetry */}
                    <div className="flex items-center space-x-6 text-xs text-slate-300">
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">
                          Sales Velocity
                        </div>
                        <div className="font-semibold text-slate-200 mt-0.5">
                          {item.sales_velocity.daily_velocity}{' '}
                          <span className="text-[10px] text-slate-400 font-normal">units/day</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {item.sales_velocity.units_30d} sold (30d)
                        </div>
                      </div>

                      {/* Column 3: Days Remaining & Stock */}
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">
                          Stock Runway
                        </div>
                        <div className="mt-0.5 flex items-center space-x-1.5">
                          <span
                            className={`font-bold font-serif ${daysLeft <= 7
                              ? 'text-rose-400'
                              : daysLeft <= 14
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                              }`}
                          >
                            {daysLeft > 900 ? '>90 days' : `${daysLeft} days`}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            ({item.current_stock} in stock)
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Min safety: {item.min_stock_level} units
                        </div>
                      </div>

                      {/* Column 4: Recommended Production */}
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">
                          Suggested Batch
                        </div>
                        <div className="font-bold text-gold-300 font-serif mt-0.5">
                          {item.suggested_units > 0 ? (
                            <>
                              +{item.suggested_units} bottles{' '}
                              <span className="text-xs font-normal text-slate-400">
                                ({item.suggested_batch_volume_ml} ml)
                              </span>
                            </>
                          ) : (
                            <span className="text-emerald-400 text-xs">Healthy Buffer</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Est. Cost: {formatCurrency(item.estimated_production_cost)}
                        </div>
                      </div>
                    </div>

                    {/* Column 5: BOM Sufficiency & Actions */}
                    <div className="flex items-center space-x-3 self-end lg:self-center">
                      {item.suggested_units > 0 ? (
                        item.materials_sufficient ? (
                          <span className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            <span>100% Materials Ready</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center space-x-1">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                            <span>{item.shortages.length} Shortage(s)</span>
                          </span>
                        )
                      ) : (
                        <span className="px-2 py-1 text-[11px] text-slate-500">No batch needed</span>
                      )}

                      <button
                        onClick={() => toggleExpand(item.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
                        title="View BOM Material Sufficiency"
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>

                      {item.create_batch_payload && (
                        <button
                          onClick={() => handleCreateBatch(item)}
                          className="px-3 py-1.5 bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-slate-950 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all shadow-sm"
                        >
                          <Factory className="h-3.5 w-3.5" />
                          <span>Create Batch</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded BOM Ingredients Breakdown */}
                  {isExpanded && (
                    <div className="px-6 py-4 bg-[#0d1017] border-t border-slate-800/80 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2 text-xs">
                          <FlaskConical className="h-4 w-4 text-gold-400" />
                          <span className="font-semibold text-slate-200">
                            Required Recipe BOM: {item.formula_name || 'Standard Formula'}
                          </span>
                          <span className="text-slate-500">
                            for {item.suggested_batch_volume_ml} ml compounding
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          Sufficiency Rate: <strong>{item.sufficiency_rate_percent}%</strong>
                        </span>
                      </div>

                      {item.all_ingredients.length === 0 ? (
                        <div className="text-xs text-slate-500 py-2">
                          No formula ingredients configured for this perfume.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-left">
                            <thead className="text-[10px] text-slate-400 uppercase bg-[#141824] border-y border-slate-800">
                              <tr>
                                <th className="px-3 py-2">Raw Material</th>
                                <th className="px-3 py-2">SKU</th>
                                <th className="px-3 py-2">Category</th>
                                <th className="px-3 py-2 text-right">Required</th>
                                <th className="px-3 py-2 text-right">Warehouse Stock</th>
                                <th className="px-3 py-2 text-right">Shortage</th>
                                <th className="px-3 py-2 text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/40">
                              {item.all_ingredients.map((ing) => (
                                <tr key={ing.raw_material_id} className="hover:bg-slate-800/30">
                                  <td className="px-3 py-2 font-medium text-slate-200">
                                    {ing.raw_material_name}
                                  </td>
                                  <td className="px-3 py-2 text-slate-400 font-mono text-[11px]">
                                    {ing.sku}
                                  </td>
                                  <td className="px-3 py-2 text-slate-400 uppercase text-[10px]">
                                    {ing.category}
                                  </td>
                                  <td className="px-3 py-2 text-right text-slate-100 font-semibold font-mono">
                                    {ing.required_quantity} {ing.base_unit}
                                  </td>
                                  <td className="px-3 py-2 text-right text-slate-300 font-mono">
                                    {ing.available_stock} {ing.base_unit}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono">
                                    {parseFloat(ing.shortage) > 0 ? (
                                      <span className="text-rose-400 font-bold">
                                        -{ing.shortage} {ing.base_unit}
                                      </span>
                                    ) : (
                                      <span className="text-slate-500">0.00</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    {ing.is_sufficient ? (
                                      <span className="inline-flex items-center text-emerald-400 font-semibold text-[11px]">
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        In Stock
                                      </span>
                                    ) : (
                                      <button
                                        onClick={() => navigate('/purchase-orders')}
                                        className="inline-flex items-center text-amber-400 hover:text-amber-300 font-semibold text-[11px] underline"
                                      >
                                        <AlertTriangle className="h-3 w-3 mr-1" />
                                        Order PO
                                      </button>
                                    )}
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
            })}
          </div>
        )}
      </div>
    </div>
  );
};
