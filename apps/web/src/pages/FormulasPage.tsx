import React, { useState, useEffect } from 'react';
import {
  FlaskConical,
  Plus,
  Search,
  Lock,
  Unlock,
  Copy,
  Calculator,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  X,
  AlertCircle,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { apiClient } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Decimal } from 'decimal.js';

interface RawMaterial {
  id: string;
  name: string;
  sku: string;
  category: string;
  base_unit: string;
  cost_per_unit: string;
  current_stock: string;
}

interface FormulaIngredient {
  id: string;
  formula_id: string;
  raw_material_id: string;
  raw_material_name?: string;
  raw_material_sku?: string;
  raw_material_category?: string;
  base_unit?: string;
  quantity_type: 'percent' | 'fixed_ml';
  value: string;
  position: number;
}

interface Formula {
  id: string;
  perfume_name: string;
  code: string;
  version: number;
  version_label: string;
  status: 'active' | 'archived' | 'draft';
  is_locked: boolean;
  locked_reason?: string;
  target_concentration: string;
  notes?: string;
  description?: string;
  created_at: string;
  ingredients?: FormulaIngredient[];
}

interface ScaledIngredient {
  ingredient_id: string;
  raw_material_id: string;
  name: string;
  sku: string;
  category: string;
  base_unit: string;
  quantity_type: 'percent' | 'fixed_ml';
  formula_value: string;
  required_quantity: string;
  available_stock: string;
  shortage: string;
  unit_cost: string;
  line_cost: string;
}

interface ScaleResult {
  formula_id: string;
  perfume_name: string;
  version_label: string;
  target_total_ml: string;
  fixed_ml_total: string;
  remaining_ml: string;
  is_fulfillable: boolean;
  estimated_total_cost: string;
  cost_per_ml: string;
  ingredients: ScaledIngredient[];
}

export const FormulasPage: React.FC = () => {
  const { user } = useAuth();
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals & Action States
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [isScaleOpen, setIsScaleOpen] = useState(false);
  const [isLockModalOpen, setIsLockModalOpen] = useState(false);
  const [activeFormula, setActiveFormula] = useState<Formula | null>(null);
  const [lockReason, setLockReason] = useState('');
  const [targetBatchMl, setTargetBatchMl] = useState<string>('500');
  const [scaleResult, setScaleResult] = useState<ScaleResult | null>(null);
  const [isScaling, setIsScaling] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New Formula Builder state
  const [perfumeName, setPerfumeName] = useState('');
  const [formulaCode, setFormulaCode] = useState('');
  const [targetConcentration, setTargetConcentration] = useState('Extrait de Parfum (30%)');
  const [formulaNotes, setFormulaNotes] = useState('');
  const [ingredients, setIngredients] = useState<
    Array<{
      raw_material_id: string;
      quantity_type: 'percent' | 'fixed_ml';
      value: string;
    }>
  >([
    { raw_material_id: '', quantity_type: 'fixed_ml', value: '20' },
    { raw_material_id: '', quantity_type: 'percent', value: '80' },
    { raw_material_id: '', quantity_type: 'percent', value: '20' },
  ]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [frmRes, matRes] = await Promise.all([
        apiClient<Formula[]>('/api/v1/formulas'),
        apiClient<RawMaterial[]>('/api/v1/raw-materials'),
      ]);

      if (frmRes.data) setFormulas(frmRes.data);
      if (matRes.data) {
        setRawMaterials(matRes.data);
        if (matRes.data.length >= 3 && !ingredients[0].raw_material_id) {
          setIngredients([
            { raw_material_id: matRes.data[1].id, quantity_type: 'fixed_ml', value: '20' },
            { raw_material_id: matRes.data[2].id, quantity_type: 'percent', value: '80' },
            { raw_material_id: matRes.data[3] ? matRes.data[3].id : matRes.data[0].id, quantity_type: 'percent', value: '20' },
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

  // Validation calculations for formula builder
  const calculateSums = () => {
    let fixed = new Decimal(0);
    let percent = new Decimal(0);

    for (const item of ingredients) {
      const val = new Decimal(item.value || 0);
      if (item.quantity_type === 'fixed_ml') {
        fixed = fixed.plus(val);
      } else {
        percent = percent.plus(val);
      }
    }

    return { fixed, percent, isValid: percent.equals(100) };
  };

  const { fixed, percent, isValid } = calculateSums();

  const addIngredientRow = () => {
    if (rawMaterials.length === 0) return;
    setIngredients([
      ...ingredients,
      { raw_material_id: rawMaterials[0].id, quantity_type: 'percent', value: '10' },
    ]);
  };

  const removeIngredientRow = (index: number) => {
    if (ingredients.length <= 1) return;
    setIngredients(ingredients.filter((_, idx) => idx !== index));
  };

  const updateIngredientRow = (index: number, key: string, value: any) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [key]: value };
    setIngredients(updated);
  };

  const handleCreateFormula = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!isValid) {
      setFeedback({
        type: 'error',
        message: `Percentage ingredients must sum to exactly 100%. Current sum: ${percent.toFixed(2)}%`,
      });
      return;
    }

    const payload = {
      perfume_name: perfumeName,
      code: formulaCode,
      target_concentration: targetConcentration,
      notes: formulaNotes,
      ingredients: ingredients.map((item) => ({
        raw_material_id: item.raw_material_id,
        quantity_type: item.quantity_type,
        value: parseFloat(item.value) || 0,
      })),
    };

    try {
      const res = await apiClient<Formula>('/api/v1/formulas', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.data) {
        setFeedback({
          type: 'success',
          message: `Formula '${res.data.perfume_name}' (${res.data.version_label}) created successfully!`,
        });
        setIsBuilderOpen(false);
        fetchData();
      } else {
        setFeedback({ type: 'error', message: res.error?.message || 'Failed to create formula' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const openScaleDrawer = async (formula: Formula) => {
    setActiveFormula(formula);
    setIsScaleOpen(true);
    triggerScale(formula.id, targetBatchMl);
  };

  const triggerScale = async (formulaId: string, ml: string) => {
    const numericMl = parseFloat(ml);
    if (isNaN(numericMl) || numericMl <= 0) return;

    setIsScaling(true);
    try {
      const res = await apiClient<ScaleResult>(`/api/v1/formulas/${formulaId}/scale`, {
        method: 'POST',
        body: JSON.stringify({ total_ml: numericMl }),
      });
      if (res.data) {
        setScaleResult(res.data);
      }
    } finally {
      setIsScaling(false);
    }
  };

  const handleCloneVersion = async (formulaId: string) => {
    try {
      const res = await apiClient<Formula>(`/api/v1/formulas/${formulaId}/version`, {
        method: 'POST',
      });
      if (res.data) {
        setFeedback({
          type: 'success',
          message: `New version created: ${res.data.perfume_name} (${res.data.version_label}). Previous version archived.`,
        });
        fetchData();
      } else {
        setFeedback({ type: 'error', message: res.error?.message || 'Cloning failed' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleLockFormula = async () => {
    if (!activeFormula) return;
    try {
      const res = await apiClient<Formula>(`/api/v1/formulas/${activeFormula.id}/lock`, {
        method: 'POST',
        body: JSON.stringify({ reason: lockReason || 'Locked against edits by master perfumer' }),
      });
      if (res.data) {
        setFeedback({
          type: 'success',
          message: `Formula ${res.data.perfume_name} (${res.data.version_label}) locked permanently.`,
        });
        setIsLockModalOpen(false);
        fetchData();
      } else {
        setFeedback({ type: 'error', message: res.error?.message || 'Failed to lock formula' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const filtered = formulas.filter((f) => {
    const matchesSearch =
      f.perfume_name.toLowerCase().includes(search.toLowerCase()) ||
      f.code.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || f.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center space-x-2 text-gold-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <FlaskConical className="h-4 w-4" />
            <span>Fragrance Lab</span>
          </div>
          <h1 className="text-2xl font-serif font-bold text-slate-100 flex items-center space-x-2">
            <span>Formula & BOM Engine</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gold-500/10 text-gold-300 border border-gold-500/20 font-sans">
              Dynamic Auto-Scaling
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Version-controlled recipes with fixed & percentage blending, immutable auto-locking, and live warehouse inventory checks.
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
              onClick={() => setIsBuilderOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-slate-950 font-semibold text-xs rounded-lg flex items-center space-x-2 shadow-[0_0_15px_rgba(212,175,55,0.2)] transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Create New Formula</span>
            </button>
          )}
        </div>
      </div>

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
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-medium tracking-wider">Active Formulas</span>
            <FlaskConical className="h-4 w-4 text-gold-400" />
          </div>
          <div className="text-2xl font-serif font-bold text-gold-300">
            {formulas.filter((f) => f.status === 'active').length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Unique active blend versions</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-medium tracking-wider">Locked Recipes</span>
            <Lock className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-serif font-bold text-slate-100">
            {formulas.filter((f) => f.is_locked).length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Production verified & immutable</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-medium tracking-wider">Blending Engine</span>
            <Sparkles className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-sm font-semibold text-slate-200 mt-1">Precision Scaling Active</div>
          <div className="text-[11px] text-slate-500 mt-1">Fixed ml Base + 100% Volume Balance</div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-slate-900/40 p-3 rounded-xl border border-slate-800/60">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search perfume or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-gold-500/50"
          />
        </div>

        <div className="flex items-center space-x-1.5">
          {['all', 'active', 'archived'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${statusFilter === status
                  ? 'bg-gold-500/20 text-gold-300 border border-gold-500/30'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-800/40'
                }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Formulas List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          <div className="col-span-full py-16 text-center text-slate-500 bg-[#0f121a] rounded-2xl border border-slate-800">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-gold-500" />
            <span>Loading perfume formulas...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-500 bg-[#0f121a] rounded-2xl border border-slate-800">
            <FlaskConical className="h-8 w-8 mx-auto mb-2 text-slate-600" />
            <span>No perfume formulas found matching your filters.</span>
          </div>
        ) : (
          filtered.map((formula) => (
            <div
              key={formula.id}
              className="bg-[#0f121a] p-5 rounded-2xl border border-slate-800/80 hover:border-gold-500/30 transition-all flex flex-col justify-between shadow-xl relative"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-serif font-bold text-base text-slate-100">
                        {formula.perfume_name}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-gold-500/10 text-gold-300 border border-gold-500/20 font-bold">
                        {formula.version_label}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                      {formula.code} • {formula.target_concentration}
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {formula.is_locked ? (
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center space-x-1"
                        title={formula.locked_reason || 'Formula is locked against edits'}
                      >
                        <Lock className="h-3 w-3" />
                        <span>Locked</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-400 border border-slate-700 flex items-center space-x-1">
                        <Unlock className="h-3 w-3" />
                        <span>Draft/Editable</span>
                      </span>
                    )}
                  </div>
                </div>

                {formula.description && (
                  <p className="text-xs text-slate-400 mt-2.5 line-clamp-2 leading-relaxed">
                    {formula.description}
                  </p>
                )}

                {/* Recipe Composition Pills */}
                {formula.ingredients && (
                  <div className="mt-4 pt-3 border-t border-slate-800/60 space-y-1.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Recipe Composition ({formula.ingredients.length} items)
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {formula.ingredients.map((ing) => (
                        <span
                          key={ing.id}
                          className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 flex items-center space-x-1"
                        >
                          <span>{ing.raw_material_name}</span>
                          <span className="text-gold-400 font-bold">
                            {ing.quantity_type === 'fixed_ml'
                              ? `${parseFloat(ing.value).toFixed(1)} ml fixed`
                              : `${parseFloat(ing.value).toFixed(0)}%`}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => openScaleDrawer(formula)}
                    className="px-3 py-1.5 bg-gold-500 hover:bg-gold-400 text-slate-950 font-bold text-xs rounded-lg flex items-center space-x-1.5 shadow-[0_0_12px_rgba(212,175,55,0.25)] transition-all"
                  >
                    <Calculator className="h-3.5 w-3.5" />
                    <span>Scale Batch BOM</span>
                  </button>

                  {['admin', 'production_manager'].includes(user?.role || '') && (
                    <button
                      onClick={() => handleCloneVersion(formula.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1 transition-colors"
                      title="Clone to V+1"
                    >
                      <Copy className="h-3.5 w-3.5 text-slate-400" />
                      <span>V+1</span>
                    </button>
                  )}
                </div>

                {!formula.is_locked && ['admin', 'production_manager'].includes(user?.role || '') && (
                  <button
                    onClick={() => {
                      setActiveFormula(formula);
                      setIsLockModalOpen(true);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition-colors"
                    title="Lock formula to prevent further edits"
                  >
                    <Lock className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Scaling Calculator Drawer / Modal */}
      {isScaleOpen && activeFormula && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-[#121620] border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="font-serif font-bold text-base text-slate-100 flex items-center space-x-2">
                  <Calculator className="h-4 w-4 text-gold-400" />
                  <span>Batch BOM Scaling Calculator</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Recipe: <span className="text-slate-100 font-semibold">{activeFormula.perfume_name}</span> ({activeFormula.version_label})
                </p>
              </div>
              <button onClick={() => setIsScaleOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 flex-1 overflow-y-auto pr-1">
              {/* Target Volume Input & Quick Buttons */}
              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
                <label className="block text-slate-300 font-medium text-xs">
                  Target Batch Production Size (ml)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={targetBatchMl}
                    onChange={(e) => {
                      setTargetBatchMl(e.target.value);
                      triggerScale(activeFormula.id, e.target.value);
                    }}
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 font-mono focus:outline-none focus:border-gold-500/50"
                  />
                  <span className="font-mono text-xs text-slate-400">Millilitres</span>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {['100', '250', '500', '1000', '5000', '10000'].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        setTargetBatchMl(val);
                        triggerScale(activeFormula.id, val);
                      }}
                      className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors ${targetBatchMl === val
                          ? 'bg-gold-500 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                    >
                      {parseInt(val) >= 1000 ? `${parseInt(val) / 1000} L` : `${val} ml`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Scale Result */}
              {isScaling ? (
                <div className="py-12 text-center text-slate-500">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-gold-500" />
                  <span>Computing scaled BOM and inventory stock availability...</span>
                </div>
              ) : scaleResult ? (
                <div className="space-y-4">
                  {/* Summary Bar */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                      <div className="text-[10px] uppercase text-slate-500 font-medium">Batch Cost</div>
                      <div className="font-serif font-bold text-gold-300 text-sm">
                        ${parseFloat(scaleResult.estimated_total_cost).toFixed(2)}
                      </div>
                    </div>
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                      <div className="text-[10px] uppercase text-slate-500 font-medium">Cost / ml</div>
                      <div className="font-mono font-bold text-slate-200 text-sm">
                        ${parseFloat(scaleResult.cost_per_ml).toFixed(4)}
                      </div>
                    </div>
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                      <div className="text-[10px] uppercase text-slate-500 font-medium">Stock Status</div>
                      <div
                        className={`text-xs font-bold ${scaleResult.is_fulfillable ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                      >
                        {scaleResult.is_fulfillable ? 'In Stock (Ready)' : 'Shortage Detected'}
                      </div>
                    </div>
                  </div>

                  {/* Scaled Ingredients Table */}
                  <div className="rounded-xl border border-slate-800 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#141824] text-slate-400 font-semibold text-[10px] uppercase border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3">Ingredient</th>
                          <th className="py-2.5 px-3">Formula Value</th>
                          <th className="py-2.5 px-3">Required Qty</th>
                          <th className="py-2.5 px-3">Warehouse Stock</th>
                          <th className="py-2.5 px-3 text-right">Est. Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300">
                        {scaleResult.ingredients.map((ing) => {
                          const hasShortage = parseFloat(ing.shortage) > 0;
                          return (
                            <tr key={ing.ingredient_id} className="hover:bg-slate-800/30">
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-slate-100">{ing.name}</div>
                                <div className="text-[10px] font-mono text-slate-500">{ing.sku}</div>
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-400">
                                {ing.quantity_type === 'fixed_ml'
                                  ? `${parseFloat(ing.formula_value).toFixed(1)} ml fixed`
                                  : `${parseFloat(ing.formula_value).toFixed(0)}%`}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-100">
                                {parseFloat(ing.required_quantity).toFixed(2)} {ing.base_unit}
                              </td>
                              <td className="py-2.5 px-3 font-mono">
                                <span className={hasShortage ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                                  {parseFloat(ing.available_stock).toFixed(2)} {ing.base_unit}
                                </span>
                                {hasShortage && (
                                  <div className="text-[9px] text-rose-400">
                                    Need +{parseFloat(ing.shortage).toFixed(2)}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-right text-gold-300">
                                ${parseFloat(ing.line_cost).toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsScaleOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg"
              >
                Close Calculator
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formula Builder Modal */}
      {isBuilderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-[#121620] border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="font-serif font-bold text-base text-slate-100">
                  New Perfume Formula (V1)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Mix percentage (%) and fixed ml components. Percentages must total 100% of remaining volume.
                </p>
              </div>
              <button onClick={() => setIsBuilderOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFormula} className="flex-1 overflow-y-auto mt-4 space-y-4 text-xs pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Perfume Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Royal Oud Extrait"
                    value={perfumeName}
                    onChange={(e) => setPerfumeName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-gold-500/50"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Formula Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. FRM-ROE-01"
                    value={formulaCode}
                    onChange={(e) => setFormulaCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-gold-500/50"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-slate-300 font-medium mb-1">Target Concentration</label>
                  <select
                    value={targetConcentration}
                    onChange={(e) => setTargetConcentration(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-gold-500/50"
                  >
                    <option value="Extrait de Parfum (30%)">Extrait de Parfum (30%)</option>
                    <option value="Eau de Parfum (20%)">Eau de Parfum (20%)</option>
                    <option value="Eau de Toilette (12%)">Eau de Toilette (12%)</option>
                  </select>
                </div>
              </div>

              {/* Ingredients Composition List */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Formula Recipe Ingredients</span>
                  <button
                    type="button"
                    onClick={addIngredientRow}
                    className="text-gold-400 hover:text-gold-300 flex items-center space-x-1 text-xs font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Ingredient</span>
                  </button>
                </div>

                {ingredients.map((line, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl grid grid-cols-1 md:grid-cols-4 gap-2 relative items-center"
                  >
                    {ingredients.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeIngredientRow(idx)}
                        className="absolute right-2 top-2 text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}

                    <div className="md:col-span-2">
                      <label className="block text-slate-400 text-[10px] mb-1">Raw Material</label>
                      <select
                        value={line.raw_material_id}
                        onChange={(e) => updateIngredientRow(idx, 'raw_material_id', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100"
                        required
                      >
                        {rawMaterials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.base_unit})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 text-[10px] mb-1">Type</label>
                      <select
                        value={line.quantity_type}
                        onChange={(e) => updateIngredientRow(idx, 'quantity_type', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100"
                      >
                        <option value="percent">Percentage (%)</option>
                        <option value="fixed_ml">Fixed (ml)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 text-[10px] mb-1">Value</label>
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={line.value}
                          onChange={(e) => updateIngredientRow(idx, 'value', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 font-mono"
                        />
                        <span className="text-slate-500 font-mono text-xs">
                          {line.quantity_type === 'percent' ? '%' : 'ml'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 100% Validation Indicator Bar */}
              <div
                className={`p-3 rounded-xl border flex items-center justify-between text-xs ${isValid
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                  }`}
              >
                <div className="flex items-center space-x-2">
                  {isValid ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-rose-400" />
                  )}
                  <span>
                    Fixed base volume: <strong>{fixed.toFixed(1)} ml</strong> • Percentage total:{' '}
                    <strong>{percent.toFixed(1)}% / 100%</strong>
                  </span>
                </div>
                <span className="font-bold font-mono">
                  {isValid ? 'Ready to Save' : `${new Decimal(100).minus(percent).toFixed(1)}% needed`}
                </span>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Formulator Notes</label>
                <textarea
                  rows={2}
                  placeholder="Artisanal olfactory notes, maturation advice..."
                  value={formulaNotes}
                  onChange={(e) => setFormulaNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-gold-500/50"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsBuilderOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isValid}
                  className={`px-4 py-2 rounded-lg font-bold shadow-md ${isValid
                      ? 'bg-gold-500 hover:bg-gold-400 text-slate-950 cursor-pointer'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                >
                  Save Active Recipe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lock Confirmation Modal */}
      {isLockModalOpen && activeFormula && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-[#121620] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center space-x-3 text-amber-400 mb-2">
              <Lock className="h-5 w-5" />
              <h3 className="font-serif font-bold text-base text-slate-100">
                Lock Formula Permanently?
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Once locked, <strong className="text-slate-200">{activeFormula.perfume_name} ({activeFormula.version_label})</strong> cannot be altered by anyone. Any recipe changes will require cloning to <strong className="text-gold-300">V+1</strong>.
            </p>

            <div className="mt-4">
              <label className="block text-slate-300 font-medium mb-1 text-xs">
                Audit Reason for Locking
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Recipe finalized for commercial bottling batch..."
                value={lockReason}
                onChange={(e) => setLockReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4 mt-2">
              <button
                type="button"
                onClick={() => setIsLockModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLockFormula}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs"
              >
                Lock Formula
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
