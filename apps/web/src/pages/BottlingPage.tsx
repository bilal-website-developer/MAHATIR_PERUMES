import React, { useState, useEffect } from 'react';
import {
  PackageCheck,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Sparkles,
  AlertCircle,
  Boxes,
  TrendingUp,
  Tag,
  Eye,
  X,
  RefreshCw,
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
  initial_quantity: string;
  current_quantity: string;
  unit_cost: string;
  selling_price?: string;
  created_at: string;
}

interface ProductVariant {
  id: string;
  product_id: string;
  product_name?: string;
  packaging_recipe_id?: string;
  packaging_recipe_name?: string;
  sku: string;
  name: string;
  size_ml: string;
  selling_price: string;
  barcode?: string;
  current_stock: string;
  min_stock_level: string;
  is_active: boolean;
}

interface PackagingRecipe {
  id: string;
  name: string;
  size_ml: string;
  description?: string;
  total_packaging_cost?: string;
  items?: {
    id: string;
    raw_material_name?: string;
    raw_material_sku?: string;
    quantity_per_unit: string;
    unit_cost?: string;
    line_cost?: string;
  }[];
}

interface BulkBatch {
  id: string;
  batch_code: string;
  perfume_name: string;
  remaining_volume: string;
  cost_per_ml: string;
  status: string;
}

interface BottlingRun {
  id: string;
  run_code: string;
  batch_code?: string;
  product_name?: string;
  variant_sku?: string;
  quantity_bottled: string;
  bulk_volume_deducted: string;
  packaging_cost_total: string;
  bulk_cost_total: string;
  unit_cost: string;
  created_at: string;
}

interface BottlingPreview {
  batch_id: string;
  batch_code: string;
  perfume_name: string;
  cost_per_ml: string;
  variant_id: string;
  variant_sku: string;
  variant_name: string;
  size_ml: string;
  quantity_bottled: string;
  bulk_needed_ml: string;
  bulk_available_ml: string;
  bulk_is_sufficient: boolean;
  bulk_cost_total: string;
  packaging_cost_total: string;
  packaging_cost_per_unit: string;
  estimated_unit_cost: string;
  can_bottle: boolean;
  packaging_items: {
    raw_material_id: string;
    name: string;
    sku: string;
    quantity_required: string;
    quantity_available: string;
    unit_cost: string;
    is_sufficient: boolean;
  }[];
}

export const BottlingPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'lots' | 'skus' | 'recipes' | 'runs'>('lots');
  const [lots, setLots] = useState<FinishedGoodsLot[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [recipes, setRecipes] = useState<PackagingRecipe[]>([]);
  const [runs, setRuns] = useState<BottlingRun[]>([]);
  const [batches, setBatches] = useState<BulkBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Bottling Wizard Modal state
  const [isBottleModalOpen, setIsBottleModalOpen] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [bottleQuantity, setBottleQuantity] = useState('20');
  const [preview, setPreview] = useState<BottlingPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Lot Details Modal
  const [selectedLot, setSelectedLot] = useState<FinishedGoodsLot | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [lotsRes, varRes, recRes, runsRes, batRes] = await Promise.all([
        apiClient<FinishedGoodsLot[]>('/api/v1/finished-goods'),
        apiClient<ProductVariant[]>('/api/v1/product-variants'),
        apiClient<PackagingRecipe[]>('/api/v1/packaging-recipes'),
        apiClient<BottlingRun[]>('/api/v1/bottling/runs'),
        apiClient<BulkBatch[]>('/api/v1/batches?status=bulk'),
      ]);

      if (lotsRes.data) setLots(lotsRes.data);
      if (varRes.data) setVariants(varRes.data);
      if (recRes.data) setRecipes(recRes.data);
      if (runsRes.data) setRuns(runsRes.data);
      if (batRes.data) setBatches(batRes.data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load finished goods data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Update preview whenever batch, variant, or quantity changes in wizard
  useEffect(() => {
    if (!selectedBatchId || !selectedVariantId || !bottleQuantity || Number(bottleQuantity) <= 0) {
      setPreview(null);
      return;
    }

    const fetchPreview = async () => {
      setPreviewLoading(true);
      try {
        const res = await apiClient<BottlingPreview>('/api/v1/bottling/preview', {
          method: 'POST',
          body: JSON.stringify({
            batch_id: selectedBatchId,
            variant_id: selectedVariantId,
            quantity: Number(bottleQuantity),
          }),
        });
        if (res.data) {
          setPreview(res.data);
        }
      } catch (err: any) {
        setPreview(null);
      } finally {
        setPreviewLoading(false);
      }
    };

    fetchPreview();
  }, [selectedBatchId, selectedVariantId, bottleQuantity]);

  // Execute Bottling Run
  const handleExecuteBottling = async () => {
    if (!preview || !preview.can_bottle) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await apiClient<{ success: boolean; run: BottlingRun; lot: FinishedGoodsLot }>('/api/v1/bottling', {
        method: 'POST',
        body: JSON.stringify({
          batch_id: selectedBatchId,
          variant_id: selectedVariantId,
          quantity: Number(bottleQuantity),
        }),
      });

      if (res.data && res.data.success) {
        setSuccessMsg(`Successfully executed bottling run ${res.data.run.run_code}! Produced ${bottleQuantity} bottles.`);
        setIsBottleModalOpen(false);
        setPreview(null);
        setSelectedBatchId('');
        setSelectedVariantId('');
        fetchData();
      } else if (res.error) {
        setErrorMsg(res.error.message || 'Failed to execute bottling run.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to execute bottling run.');
    } finally {
      setSubmitting(false);
    }
  };

  // KPIs
  const totalBottledUnits = lots.reduce(
    (acc, lot) => acc.add(new Decimal(lot.current_quantity || 0)),
    new Decimal(0),
  );

  const totalAssetValuation = lots.reduce(
    (acc, lot) => acc.add(new Decimal(lot.current_quantity || 0).mul(new Decimal(lot.unit_cost || 0))),
    new Decimal(0),
  );

  const filteredLots = lots.filter(
    (l) =>
      l.lot_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.variant_sku && l.variant_sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (l.product_name && l.product_name.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-gold-400 uppercase tracking-widest mb-1">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Phase 5 • Assembly & Finished Goods</span>
          </div>
          <h1 className="text-2xl font-serif font-bold text-slate-100 flex items-center space-x-3">
            <span>Bottling & Finished Goods</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Atomic conversion of mature bulk perfume liquid and packaging components into sellable SKUs.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-3 py-2 bg-slate-800/80 hover:bg-slate-700/80 disabled:opacity-50 text-slate-300 rounded-lg text-xs font-medium border border-slate-700/60 flex items-center space-x-1.5 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-gold-400' : ''}`} />
            <span>{loading ? 'Loading...' : 'Refresh'}</span>
          </button>

          {(user?.role === 'admin' || user?.role === 'production_manager') && (
            <button
              onClick={() => {
                setIsBottleModalOpen(true);
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="px-4 py-2 bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-slate-950 rounded-lg text-xs font-bold tracking-wide flex items-center space-x-2 shadow-[0_0_15px_rgba(212,175,55,0.25)] transition-all"
            >
              <PackageCheck className="h-4 w-4" />
              <span>New Bottling Run</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)}>
            <X className="h-4 w-4 text-emerald-400 hover:text-emerald-200" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)}>
            <X className="h-4 w-4 text-rose-400 hover:text-rose-200" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#121622] border border-slate-800/80 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Total Bottled Units</span>
            <Boxes className="h-4 w-4 text-gold-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">
            {totalBottledUnits.toNumber().toLocaleString()} <span className="text-xs font-normal text-slate-400 font-sans">bottles</span>
          </div>
          <p className="text-[11px] text-emerald-400 mt-1">Available in retail inventory</p>
        </div>

        <div className="bg-[#121622] border border-slate-800/80 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Finished Goods Valuation</span>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-gold-300">
            ${totalAssetValuation.toFixed(2)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Total manufacturing unit cost</p>
        </div>

        <div className="bg-[#121622] border border-slate-800/80 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Active Finished SKUs</span>
            <Tag className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">{variants.length}</div>
          <p className="text-[11px] text-slate-400 mt-1">Configured bottle size variants</p>
        </div>

        <div className="bg-[#121622] border border-slate-800/80 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Bottling Runs Executed</span>
            <CheckCircle2 className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">{runs.length}</div>
          <p className="text-[11px] text-slate-400 mt-1">Full traceability logged</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setActiveTab('lots')}
          className={`px-5 py-3 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-2 ${
            activeTab === 'lots'
              ? 'border-gold-400 text-gold-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Boxes className="h-4 w-4" />
          <span>Finished Goods Lots ({lots.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('skus')}
          className={`px-5 py-3 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-2 ${
            activeTab === 'skus'
              ? 'border-gold-400 text-gold-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Tag className="h-4 w-4" />
          <span>Product Variants & SKUs ({variants.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('recipes')}
          className={`px-5 py-3 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-2 ${
            activeTab === 'recipes'
              ? 'border-gold-400 text-gold-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Packaging Recipes ({recipes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('runs')}
          className={`px-5 py-3 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-2 ${
            activeTab === 'runs'
              ? 'border-gold-400 text-gold-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Bottling Runs ({runs.length})</span>
        </button>
      </div>

      {/* Tab 1: Finished Goods Lots */}
      {activeTab === 'lots' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative w-72">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search lot number, SKU, perfume..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#121622] border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-gold-500/50"
              />
            </div>
            <span className="text-xs text-slate-500">Showing {filteredLots.length} lots</span>
          </div>

          <div className="bg-[#121622] border border-slate-800/80 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-900/60 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Lot Number</th>
                    <th className="py-3 px-4">Product / SKU</th>
                    <th className="py-3 px-4">Origin Batch</th>
                    <th className="py-3 px-4 text-right">Available Qty</th>
                    <th className="py-3 px-4 text-right">Unit Cost</th>
                    <th className="py-3 px-4 text-right">Retail Price</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredLots.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        No finished goods lots found. Execute a bottling run to bottle bulk liquid.
                      </td>
                    </tr>
                  ) : (
                    filteredLots.map((lot) => (
                      <tr key={lot.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-medium text-gold-300">
                          {lot.lot_number}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-200">{lot.product_name || 'Perfume'}</div>
                          <div className="text-[11px] font-mono text-slate-400">{lot.variant_sku}</div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-300">
                          <span className="px-2 py-0.5 rounded bg-slate-800/80 text-[11px] border border-slate-700/60">
                            {lot.batch_code || 'BATCH'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-100">
                          {Number(lot.current_quantity).toFixed(0)} <span className="text-[10px] font-sans text-slate-400 font-normal">units</span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-gold-400">
                          ${Number(lot.unit_cost).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-emerald-400">
                          ${Number(lot.selling_price || 0).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => setSelectedLot(lot)}
                            className="p-1.5 hover:bg-slate-700/60 rounded text-slate-400 hover:text-slate-200 transition-colors"
                            title="View Lot Traceability"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Product Variants & SKUs */}
      {activeTab === 'skus' && (
        <div className="bg-[#121622] border border-slate-800/80 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-900/60 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">SKU Code</th>
                  <th className="py-3 px-4">Variant Name</th>
                  <th className="py-3 px-4">Bottle Size</th>
                  <th className="py-3 px-4">Packaging Recipe</th>
                  <th className="py-3 px-4 text-right">Selling Price</th>
                  <th className="py-3 px-4 text-right">Warehouse Stock</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {variants.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-gold-300">{v.sku}</td>
                    <td className="py-3 px-4 font-medium text-slate-200">{v.name}</td>
                    <td className="py-3 px-4 font-mono text-slate-300">{Number(v.size_ml).toFixed(0)} ml</td>
                    <td className="py-3 px-4 text-slate-400">{v.packaging_recipe_name || 'Standard Packaging'}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                      ${Number(v.selling_price).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-100">
                      {Number(v.current_stock).toFixed(0)} units
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Packaging Recipes */}
      {activeTab === 'recipes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recipes.map((recipe) => (
            <div key={recipe.id} className="bg-[#121622] border border-slate-800/80 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="font-serif font-bold text-slate-100 text-sm">{recipe.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{recipe.description}</p>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded bg-gold-500/10 text-gold-400 text-xs font-mono font-bold border border-gold-500/20">
                    {Number(recipe.size_ml).toFixed(0)} ml Flacon
                  </span>
                  <div className="text-xs font-mono text-emerald-400 mt-1 font-bold">
                    ${Number(recipe.total_packaging_cost || 0).toFixed(2)} / unit
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Components Bill of Materials (BOM)
                </div>
                <div className="space-y-1.5">
                  {(recipe.items || []).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between text-xs p-2 rounded bg-slate-900/60 border border-slate-800/60"
                    >
                      <div>
                        <div className="text-slate-200 font-medium">{item.raw_material_name}</div>
                        <div className="text-[10px] font-mono text-slate-500">{item.raw_material_sku}</div>
                      </div>
                      <div className="text-right font-mono text-slate-300">
                        <div>{Number(item.quantity_per_unit).toFixed(0)} pcs</div>
                        <div className="text-[10px] text-slate-500">${Number(item.unit_cost || 0).toFixed(2)} each</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 4: Bottling Execution History */}
      {activeTab === 'runs' && (
        <div className="bg-[#121622] border border-slate-800/80 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-900/60 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Run Code</th>
                  <th className="py-3 px-4">Batch / Product</th>
                  <th className="py-3 px-4">Variant SKU</th>
                  <th className="py-3 px-4 text-right">Bottled Qty</th>
                  <th className="py-3 px-4 text-right">Bulk Liquid Used</th>
                  <th className="py-3 px-4 text-right">Unit Cost</th>
                  <th className="py-3 px-4 text-right">Execution Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {runs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No bottling execution runs recorded yet.
                    </td>
                  </tr>
                ) : (
                  runs.map((run) => (
                    <tr key={run.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-gold-400">{run.run_code}</td>
                      <td className="py-3 px-4">
                        <div className="text-slate-200 font-medium">{run.product_name || 'Perfume'}</div>
                        <div className="text-[10px] font-mono text-slate-500">{run.batch_code}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">{run.variant_sku}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-100">
                        {Number(run.quantity_bottled).toFixed(0)} units
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-400">
                        {Number(run.bulk_volume_deducted).toFixed(2)} ml
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-gold-300">
                        ${Number(run.unit_cost).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500">
                        {new Date(run.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Bottling Run Modal / Wizard */}
      {isBottleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#121622] border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-5 p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="font-serif font-bold text-slate-100 text-lg flex items-center space-x-2">
                  <PackageCheck className="h-5 w-5 text-gold-400" />
                  <span>Execute Bottling Run</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Convert bulk liquid into finished bottled goods with automatic packaging deduction and unit costing.
                </p>
              </div>
              <button
                onClick={() => setIsBottleModalOpen(false)}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Select Batch */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Bulk Liquid Batch *
                </label>
                <select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-gold-500/50"
                >
                  <option value="">-- Choose Bulk Batch --</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.batch_code} - {b.perfume_name} ({Number(b.remaining_volume).toFixed(0)} ml available)
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Variant */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Target Product Variant *
                </label>
                <select
                  value={selectedVariantId}
                  onChange={(e) => setSelectedVariantId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-gold-500/50"
                >
                  <option value="">-- Choose Product Variant --</option>
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.sku} ({Number(v.size_ml).toFixed(0)} ml) - {v.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Quantity of Bottles to Produce *
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={bottleQuantity}
                  onChange={(e) => setBottleQuantity(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-gold-500/50"
                />
              </div>
            </div>

            {/* Live Interactive Preview Card */}
            {previewLoading && (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800">
                <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2 text-gold-400" />
                Calculating required bulk liquid, packaging BOM and unit costing...
              </div>
            )}

            {!previewLoading && preview && (
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-xs font-semibold uppercase text-gold-400 tracking-wider">
                    Bottling Calculation Preview
                  </span>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                      preview.can_bottle
                        ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30'
                        : 'bg-rose-950/60 text-rose-400 border-rose-500/30'
                    }`}
                  >
                    {preview.can_bottle ? '✓ All Stocks Sufficient' : '✕ Stock Insufficient'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800/60">
                    <span className="text-[10px] text-slate-500 uppercase">Bulk Needed</span>
                    <div className="font-mono font-bold text-slate-200 mt-0.5">
                      {Number(preview.bulk_needed_ml).toFixed(1)} ml
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Available: {Number(preview.bulk_available_ml).toFixed(1)} ml
                    </div>
                  </div>

                  <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800/60">
                    <span className="text-[10px] text-slate-500 uppercase">Packaging / Bottle</span>
                    <div className="font-mono font-bold text-slate-200 mt-0.5">
                      ${Number(preview.packaging_cost_per_unit).toFixed(2)}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Total: ${Number(preview.packaging_cost_total).toFixed(2)}
                    </div>
                  </div>

                  <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800/60">
                    <span className="text-[10px] text-slate-500 uppercase">True Unit Cost</span>
                    <div className="font-mono font-bold text-gold-300 mt-0.5">
                      ${Number(preview.estimated_unit_cost).toFixed(2)}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Cost per bottle
                    </div>
                  </div>

                  <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800/60">
                    <span className="text-[10px] text-slate-500 uppercase">Total Run Cost</span>
                    <div className="font-mono font-bold text-emerald-400 mt-0.5">
                      ${(Number(preview.estimated_unit_cost) * Number(preview.quantity_bottled)).toFixed(2)}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Inventory Asset Added
                    </div>
                  </div>
                </div>

                {/* Packaging BOM Sufficiency Breakdown */}
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                    Packaging Materials Verification:
                  </span>
                  <div className="space-y-1">
                    {preview.packaging_items.map((item) => (
                      <div
                        key={item.raw_material_id}
                        className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded bg-slate-950/40 border border-slate-800/40"
                      >
                        <div className="flex items-center space-x-2">
                          {item.is_sufficient ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-rose-400" />
                          )}
                          <span className="text-slate-300">{item.name}</span>
                        </div>
                        <div className="font-mono text-right text-slate-400">
                          <span className={item.is_sufficient ? 'text-slate-200' : 'text-rose-400 font-bold'}>
                            {Number(item.quantity_required).toFixed(0)} needed
                          </span>{' '}
                          / <span className="text-slate-500">{Number(item.quantity_available).toFixed(0)} in stock</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsBottleModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!preview || !preview.can_bottle || submitting}
                onClick={handleExecuteBottling}
                className="px-5 py-2 bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold rounded-lg text-xs tracking-wide flex items-center space-x-2 shadow-[0_0_15px_rgba(212,175,55,0.2)]"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Deducting Stocks & Creating Lot...</span>
                  </>
                ) : (
                  <>
                    <PackageCheck className="h-4 w-4" />
                    <span>Execute Bottling Run</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lot Details Modal */}
      {selectedLot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#121622] border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono text-gold-400 uppercase tracking-widest">
                  Finished Goods Lot Traceability
                </span>
                <h3 className="font-serif font-bold text-slate-100 text-lg mt-0.5">
                  {selectedLot.lot_number}
                </h3>
              </div>
              <button
                onClick={() => setSelectedLot(null)}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Fragrance Product</span>
                <span className="font-semibold text-slate-200">{selectedLot.product_name}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Variant SKU</span>
                <span className="font-mono text-gold-300">{selectedLot.variant_sku}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Origin Production Batch</span>
                <span className="font-mono text-slate-300">{selectedLot.batch_code}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Remaining Usable Quantity</span>
                <span className="font-mono font-bold text-emerald-400">
                  {Number(selectedLot.current_quantity).toFixed(0)} units
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">True Manufacturing Unit Cost</span>
                <span className="font-mono font-bold text-gold-300">
                  ${Number(selectedLot.unit_cost).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Bottled On</span>
                <span className="text-slate-400">
                  {new Date(selectedLot.created_at).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setSelectedLot(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium"
              >
                Close Traceability
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
