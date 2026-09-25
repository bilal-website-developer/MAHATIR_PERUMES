import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Calculator,
  FlaskConical,
  Factory,
  Sparkles,
  Droplet,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Save,
  Layers,
  Scale,
} from 'lucide-react';
import { apiClient } from '../lib/api';
import { formatCurrency, formatNumber } from '../lib/utils';

interface RawMaterial {
  id: string;
  name: string;
  sku: string;
  category: string;
  base_unit: string;
  cost_per_unit: string;
  current_stock: string;
}

interface DilutedComponent {
  component_type: 'oil' | 'alcohol' | 'fixative' | 'additive';
  raw_material_id: string;
  material_name: string;
  material_sku: string;
  material_category: string;
  base_unit: string;
  percentage: string;
  required_volume_ml: string;
  available_stock: string;
  shortage: string;
  unit_cost: string;
  line_cost: string;
  notes?: string;
}

interface DilutionResult {
  target_volume_ml: string;
  concentration_type: string;
  oil_percentage: string;
  alcohol_percentage: string;
  total_percentage: string;
  is_fulfillable: boolean;
  total_cost: string;
  cost_per_ml: string;
  components: DilutedComponent[];
}

interface AdditiveRow {
  raw_material_id: string;
  percentage: number;
  notes?: string;
}

const CONCENTRATION_ARCHETYPES = [
  {
    type: 'extrait',
    name: 'Extrait de Parfum',
    range: '30% – 40%',
    defaultPct: 30,
    min: 30,
    max: 40,
    desc: 'Dense, opulent sillage. The highest artisanal concentration.',
    accent: 'border-amber-500/60 bg-amber-500/10 text-amber-300',
  },
  {
    type: 'edp',
    name: 'Eau de Parfum (EDP)',
    range: '15% – 25%',
    defaultPct: 20,
    min: 15,
    max: 25,
    desc: 'Haute perfumery standard balancing radiant projection and all-day longevity.',
    accent: 'border-gold-500/60 bg-gold-500/10 text-gold-300',
  },
  {
    type: 'edt',
    name: 'Eau de Toilette (EDT)',
    range: '5% – 15%',
    defaultPct: 10,
    min: 5,
    max: 15,
    desc: 'Sparkling, buoyant daytime radiance with vibrant top notes.',
    accent: 'border-cyan-500/60 bg-cyan-500/10 text-cyan-300',
  },
  {
    type: 'edc',
    name: 'Eau de Cologne (EDC)',
    range: '2% – 5%',
    defaultPct: 4,
    min: 2,
    max: 5,
    desc: 'Brisk, refreshing splash cologne with delicate citrus nuances.',
    accent: 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300',
  },
  {
    type: 'custom',
    name: 'Bespoke / Custom',
    range: '1% – 100%',
    defaultPct: 22,
    min: 1,
    max: 100,
    desc: 'Custom laboratory ratio for experimental macerations and attars.',
    accent: 'border-purple-500/60 bg-purple-500/10 text-purple-300',
  },
] as const;

export const DilutionPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // State
  const [selectedType, setSelectedType] = useState<string>('edp');
  const [targetVolume, setTargetVolume] = useState<number>(500);
  const [oilPercentage, setOilPercentage] = useState<number>(20);
  const [selectedOilId, setSelectedOilId] = useState<string>('');
  const [additives, setAdditives] = useState<AdditiveRow[]>([
    { raw_material_id: '', percentage: 3, notes: 'Ambroxan fixative' },
  ]);

  // Modals
  const [showFormulaModal, setShowFormulaModal] = useState<boolean>(false);
  const [showBatchModal, setShowBatchModal] = useState<boolean>(false);
  const [formulaForm, setFormulaForm] = useState({
    name: '',
    code: '',
    description: '',
  });
  const [batchForm, setBatchForm] = useState({
    name: '',
    code: '',
    notes: '',
  });

  // Notification / Feedback banner
  const [banner, setBanner] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Queries
  const { data: rawMaterials = [] } = useQuery<RawMaterial[]>({
    queryKey: ['raw-materials-for-dilution'],
    queryFn: async () => {
      const res = await apiClient<RawMaterial[]>('/api/v1/raw-materials');
      return res.data || [];
    },
  });

  // Categorized materials
  const oilMaterials = rawMaterials.filter((m) => m.category === 'oil');
  const fixativeMaterials = rawMaterials.filter((m) => m.category === 'fixative');
  const alcoholMaterials = rawMaterials.filter((m) => m.category === 'alcohol');

  // Set default oil material
  useEffect(() => {
    if (!selectedOilId && oilMaterials.length > 0) {
      setSelectedOilId(oilMaterials[0].id);
    }
  }, [oilMaterials, selectedOilId]);

  // Set default fixative row
  useEffect(() => {
    if (additives.length > 0 && !additives[0].raw_material_id && fixativeMaterials.length > 0) {
      setAdditives([{ raw_material_id: fixativeMaterials[0].id, percentage: 3, notes: 'Fixative Enhancer' }]);
    }
  }, [fixativeMaterials]);

  // Handle concentration card click
  const handleTypeSelect = (type: string) => {
    setSelectedType(type);
    const archetype = CONCENTRATION_ARCHETYPES.find((a) => a.type === type);
    if (archetype) {
      setOilPercentage(archetype.defaultPct);
    }
  };

  // Live calculation query
  const { data: calculation } = useQuery<DilutionResult>({
    queryKey: ['dilution-calc', targetVolume, selectedType, oilPercentage, selectedOilId, additives],
    queryFn: async () => {
      const activeAdditives = additives
        .filter((a) => a.raw_material_id && a.percentage > 0)
        .map((a) => ({
          raw_material_id: a.raw_material_id,
          percentage: Number(a.percentage),
          notes: a.notes,
        }));

      const res = await apiClient<DilutionResult>('/api/v1/dilution/calculate', {
        method: 'POST',
        body: JSON.stringify({
          target_volume: Number(targetVolume),
          concentration_type: selectedType,
          oil_percentage: Number(oilPercentage),
          oil_material_id: selectedOilId || undefined,
          additives: activeAdditives.length > 0 ? activeAdditives : undefined,
        }),
      });

      if (!res.data) {
        throw new Error(res.error?.message || 'Calculation failed');
      }
      return res.data;
    },
    enabled: targetVolume > 0 && oilPercentage > 0,
  });

  // Save as Formula Mutation
  const saveFormulaMutation = useMutation({
    mutationFn: async () => {
      if (!calculation) throw new Error('Calculation is not ready.');
      return await apiClient('/api/v1/dilution/save-formula', {
        method: 'POST',
        body: JSON.stringify({
          perfume_name: formulaForm.name,
          code: formulaForm.code,
          target_concentration:
            selectedType === 'extrait'
              ? 'Extrait'
              : selectedType === 'edp'
              ? 'EDP'
              : selectedType === 'edt'
              ? 'EDT'
              : selectedType === 'edc'
              ? 'EDC'
              : 'Custom',
          description: formulaForm.description,
          calculation,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formulas'] });
      setShowFormulaModal(false);
      setBanner({
        message: `Formula "${formulaForm.name}" created successfully as Version 1!`,
        type: 'success',
      });
      setTimeout(() => navigate('/formulas'), 1200);
    },
    onError: (err: any) => {
      setBanner({ message: err.message || 'Failed to save formula', type: 'error' });
    },
  });

  // Convert to Batch Mutation
  const convertBatchMutation = useMutation({
    mutationFn: async () => {
      if (!calculation) throw new Error('Calculation is not ready.');
      return await apiClient<{ id: string; batch_code: string }>('/api/v1/dilution/to-batch', {
        method: 'POST',
        body: JSON.stringify({
          perfume_name: batchForm.name || `Studio Blend ${Date.now().toString().slice(-4)}`,
          code: batchForm.code || `FOR-DIL-${Date.now().toString().slice(-4)}`,
          target_volume: Number(targetVolume),
          calculation,
          notes: batchForm.notes || 'Created directly from Dilution Calculator studio',
        }),
      });
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setShowBatchModal(false);
      setBanner({
        message: `Manufacturing Batch "${res.data?.batch_code || 'New Batch'}" created in draft status!`,
        type: 'success',
      });
      setTimeout(() => navigate('/batches'), 1200);
    },
    onError: (err: any) => {
      setBanner({ message: err.message || 'Failed to convert to batch', type: 'error' });
    },
  });

  const currentArchetype = CONCENTRATION_ARCHETYPES.find((a) => a.type === selectedType);
  const totalAdditivePct = additives.reduce((acc, curr) => acc + (Number(curr.percentage) || 0), 0);
  const alcoholPct = Math.max(0, 100 - oilPercentage - totalAdditivePct);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Page Title & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-gold-400 to-amber-600 flex items-center justify-center shadow-lg shadow-gold-500/20">
              <Calculator className="h-5 w-5 text-slate-950" />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold text-slate-100 flex items-center gap-2">
                Dilution Calculator & Studio Formulator
              </h1>
              <p className="text-xs text-slate-400">
                Scientific alcohol-to-oil compounding, real-time warehouse cost valuation, and seamless formula generation
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              setFormulaForm({
                name: `${oilMaterials.find((m) => m.id === selectedOilId)?.name || 'Signature'} ${
                  selectedType.toUpperCase()
                }`,
                code: `FOR-${Date.now().toString().slice(-6)}`,
                description: `Created via Dilution Calculator with ${oilPercentage}% oil and ${targetVolume}ml volume.`,
              });
              setShowFormulaModal(true);
            }}
            disabled={!calculation}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-lg border border-gold-500/40 bg-gold-500/10 text-gold-300 hover:bg-gold-500/20 font-medium text-xs transition-all shadow-sm disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>Save as Formula (BOM)</span>
          </button>

          <button
            onClick={() => {
              setBatchForm({
                name: `${oilMaterials.find((m) => m.id === selectedOilId)?.name || 'Signature'} ${
                  selectedType.toUpperCase()
                }`,
                code: `FOR-${Date.now().toString().slice(-6)}`,
                notes: `Direct dilution to batch production (${targetVolume} ml target).`,
              });
              setShowBatchModal(true);
            }}
            disabled={!calculation}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-gold-400 via-amber-500 to-gold-600 text-slate-950 hover:brightness-110 font-semibold text-xs transition-all shadow-md shadow-gold-500/20 disabled:opacity-50"
          >
            <Factory className="h-4 w-4" />
            <span>Convert to Batch</span>
          </button>
        </div>
      </div>

      {/* Banner */}
      {banner && (
        <div
          className={`p-4 rounded-xl border flex items-center space-x-3 ${
            banner.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              : 'border-red-500/40 bg-red-500/10 text-red-300'
          }`}
        >
          {banner.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          )}
          <span className="text-sm">{banner.message}</span>
        </div>
      )}

      {/* 1. Concentration Archetypes Selector Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {CONCENTRATION_ARCHETYPES.map((arch) => {
          const isSelected = selectedType === arch.type;
          return (
            <button
              key={arch.type}
              onClick={() => handleTypeSelect(arch.type)}
              className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden ${
                isSelected
                  ? 'border-gold-500/80 bg-gradient-to-b from-slate-900 to-card shadow-lg shadow-gold-500/10'
                  : 'border-slate-800/80 bg-slate-900/60 hover:border-slate-700 text-slate-400'
              }`}
            >
              {isSelected && (
                <div className="absolute top-0 right-0 h-6 w-6 bg-gold-500/20 rounded-bl-lg flex items-center justify-center">
                  <Sparkles className="h-3 w-3 text-gold-400" />
                </div>
              )}
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                {arch.range}
              </div>
              <div className="font-serif font-bold text-sm text-slate-100 mt-1">{arch.name}</div>
              <p className="text-[11px] text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                {arch.desc}
              </p>
            </button>
          );
        })}
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Compounding Parameters */}
        <div className="lg:col-span-6 space-y-6">
          <div className="p-6 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm space-y-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gold-400 flex items-center gap-2">
              <FlaskConical className="h-4 w-4" />
              <span>1. Target Production Volume</span>
            </h2>

            {/* Quick volume buttons */}
            <div className="space-y-3">
              <label className="text-xs text-slate-400">Quick Volume Presets (Millilitres)</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[50, 100, 250, 500, 1000, 5000].map((vol) => (
                  <button
                    key={vol}
                    type="button"
                    onClick={() => setTargetVolume(vol)}
                    className={`py-2 px-2 text-xs font-mono font-medium rounded-lg border transition-all ${
                      targetVolume === vol
                        ? 'border-gold-500 bg-gold-500/20 text-gold-300 shadow-sm'
                        : 'border-slate-800 bg-slate-800/50 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {vol >= 1000 ? `${vol / 1000} L` : `${vol} ml`}
                  </button>
                ))}
              </div>

              {/* Direct numeric input */}
              <div className="relative mt-2">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={targetVolume}
                  onChange={(e) => setTargetVolume(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-100 font-mono text-sm focus:outline-none focus:border-gold-500/60 pl-4 pr-12"
                />
                <span className="absolute right-4 top-2.5 text-xs font-mono text-slate-500">ml</span>
              </div>
            </div>

            <hr className="border-slate-800/60" />

            {/* 2. Oil Concentration & Material */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gold-400 flex items-center gap-2">
                  <Droplet className="h-4 w-4" />
                  <span>2. Fragrance Oil Concentration</span>
                </h2>
                <div className="px-3 py-1 rounded-md bg-gold-500/20 border border-gold-500/40 font-mono text-gold-300 font-bold text-sm">
                  {oilPercentage.toFixed(1)}%
                </div>
              </div>

              {/* Slider */}
              <div className="space-y-2">
                <input
                  type="range"
                  min={currentArchetype ? currentArchetype.min : 1}
                  max={currentArchetype ? currentArchetype.max : 100}
                  step="0.5"
                  value={oilPercentage}
                  onChange={(e) => setOilPercentage(Number(e.target.value))}
                  className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-gold-500"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>{currentArchetype?.min}% Min</span>
                  <span className="text-slate-400">Target: {oilPercentage}%</span>
                  <span>{currentArchetype?.max}% Max</span>
                </div>
              </div>

              {/* Fragrance Oil Selector */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Select Fragrance Oil Concentrate</label>
                <select
                  value={selectedOilId}
                  onChange={(e) => setSelectedOilId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-gold-500/60"
                >
                  {oilMaterials.map((mat) => (
                    <option key={mat.id} value={mat.id}>
                      {mat.name} ({mat.sku}) — Stock: {formatNumber(mat.current_stock)} {mat.base_unit} @{' '}
                      {formatCurrency(mat.cost_per_unit)}/{mat.base_unit}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <hr className="border-slate-800/60" />

            {/* 3. Additives & Fixatives */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gold-400 flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  <span>3. Fixatives & Enhancers (Optional)</span>
                </h2>
                <button
                  type="button"
                  onClick={() =>
                    setAdditives([
                      ...additives,
                      {
                        raw_material_id: fixativeMaterials[0]?.id || '',
                        percentage: 2,
                        notes: 'Fixative',
                      },
                    ])
                  }
                  className="text-xs text-gold-400 hover:text-gold-300 flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add Modifier</span>
                </button>
              </div>

              {additives.map((add, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                  <div className="flex-1">
                    <select
                      value={add.raw_material_id}
                      onChange={(e) => {
                        const copy = [...additives];
                        copy[idx].raw_material_id = e.target.value;
                        setAdditives(copy);
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                    >
                      {fixativeMaterials.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.sku})
                        </option>
                      ))}
                      {rawMaterials
                        .filter((m) => m.category !== 'packaging')
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.sku})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="w-24 relative">
                    <input
                      type="number"
                      min="0"
                      max="20"
                      step="0.5"
                      value={add.percentage}
                      onChange={(e) => {
                        const copy = [...additives];
                        copy[idx].percentage = Number(e.target.value);
                        setAdditives(copy);
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-100 font-mono text-right pr-6 focus:outline-none"
                    />
                    <span className="absolute right-2 top-2 text-[10px] text-slate-500 font-mono">%</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setAdditives(additives.filter((_, i) => i !== idx));
                    }}
                    className="p-1.5 text-slate-500 hover:text-red-400 rounded transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <hr className="border-slate-800/60" />

            {/* 4. Carrier Alcohol (Auto-calculated) */}
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-cyan-500/20 bg-cyan-950/20">
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Droplet className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-cyan-300">Carrier Solvent: Perfumer's Alcohol</div>
                  <div className="text-[11px] text-slate-400">
                    {alcoholMaterials[0]?.name || 'Denatured Ethanol 96% Pure'} (Auto-balanced)
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm font-bold text-cyan-300">{alcoholPct.toFixed(1)}%</div>
                <div className="text-[10px] font-mono text-slate-400">
                  {((targetVolume * alcoholPct) / 100).toFixed(1)} ml
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Visual Breakdown & Costing Card */}
        <div className="lg:col-span-6 space-y-6">
          <div className="p-6 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm space-y-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gold-400 flex items-center gap-2">
              <Scale className="h-4 w-4" />
              <span>Studio Compounding Output & Financial Telemetry</span>
            </h2>

            {/* Stacked Percentage Visualizer Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Concentration Architecture</span>
                <span className="font-mono text-gold-300 font-bold">100.0% Total Allocation</span>
              </div>
              <div className="h-4 w-full rounded-full bg-slate-950 overflow-hidden flex border border-slate-800 p-0.5">
                {/* Oil segment */}
                <div
                  style={{ width: `${oilPercentage}%` }}
                  className="h-full bg-gradient-to-r from-gold-400 to-amber-500 rounded-l-full transition-all"
                  title={`Fragrance Oil: ${oilPercentage}%`}
                />
                {/* Additives segment */}
                {totalAdditivePct > 0 && (
                  <div
                    style={{ width: `${totalAdditivePct}%` }}
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
                    title={`Fixatives/Modifiers: ${totalAdditivePct}%`}
                  />
                )}
                {/* Alcohol segment */}
                <div
                  style={{ width: `${alcoholPct}%` }}
                  className="h-full bg-gradient-to-r from-cyan-400 to-blue-600 rounded-r-full transition-all"
                  title={`Alcohol: ${alcoholPct}%`}
                />
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-gold-400" />
                  Oil ({oilPercentage.toFixed(1)}%)
                </span>
                {totalAdditivePct > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Fixative ({totalAdditivePct.toFixed(1)}%)
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-cyan-400" />
                  Ethanol ({alcoholPct.toFixed(1)}%)
                </span>
              </div>
            </div>

            {/* Formulation BOM Table */}
            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Scaled Compounding Recipe ({targetVolume} ml)
              </div>
              <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/40">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase font-mono">
                    <tr>
                      <th className="py-2.5 px-3">Ingredient</th>
                      <th className="py-2.5 px-3 text-right">Ratio</th>
                      <th className="py-2.5 px-3 text-right">Required Volume</th>
                      <th className="py-2.5 px-3 text-right">Stock</th>
                      <th className="py-2.5 px-3 text-right">Line Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                    {calculation?.components.map((comp) => {
                      const hasShortage = Number(comp.shortage) > 0;
                      return (
                        <tr key={comp.raw_material_id} className="hover:bg-slate-900/40">
                          <td className="py-2.5 px-3 font-sans font-medium text-slate-200">
                            {comp.material_name}
                            <span className="block text-[10px] font-mono text-slate-500">
                              {comp.material_sku}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right text-gold-300 font-bold">
                            {Number(comp.percentage).toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {formatNumber(comp.required_volume_ml)} ml
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {hasShortage ? (
                              <span className="text-red-400 font-bold">
                                Short ({formatNumber(comp.shortage)} ml)
                              </span>
                            ) : (
                              <span className="text-emerald-400">
                                {formatNumber(comp.available_stock)} ml
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-100">
                            {formatCurrency(comp.line_cost)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Telemetry KPI Badges */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60">
                <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500">
                  Total Batch Estimated Cost
                </div>
                <div className="text-2xl font-serif font-bold text-gold-400 mt-1">
                  {formatCurrency(calculation?.total_cost || 0)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 font-mono">
                  Target volume: {formatNumber(targetVolume)} ml
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60">
                <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500">
                  True Manufacturing Cost per ml
                </div>
                <div className="text-2xl font-serif font-bold text-slate-100 mt-1">
                  {formatCurrency(calculation?.cost_per_ml || 0)}
                  <span className="text-xs font-mono font-normal text-slate-400 ml-1">/ml</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1 font-mono">
                  50ml Flacon: {formatCurrency(Number(calculation?.cost_per_ml || 0) * 50)} bulk
                </div>
              </div>
            </div>

            {/* Warehouse Stock Sufficiency Indicator */}
            <div
              className={`p-3.5 rounded-xl border flex items-center space-x-3 ${
                calculation?.is_fulfillable
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-red-500/30 bg-red-500/10 text-red-300'
              }`}
            >
              {calculation?.is_fulfillable ? (
                <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              )}
              <div className="text-xs">
                {calculation?.is_fulfillable ? (
                  <span>
                    <strong>Warehouse Sufficient:</strong> All raw oils, alcohol, and fixatives are in stock to compound this batch immediately.
                  </span>
                ) : (
                  <span>
                    <strong>Inventory Shortage:</strong> One or more ingredients exceed current warehouse levels. A purchase order may be required before batch confirmation.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save as Formula Modal */}
      {showFormulaModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-gold-500/40 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl shadow-gold-500/10">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-xl bg-gold-500/20 text-gold-400 flex items-center justify-center">
                <FlaskConical className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-serif font-bold text-slate-100">Save as Formula (BOM)</h3>
                <p className="text-xs text-slate-400">
                  Creates Version 1 in the permanent Formula Registry
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Perfume Name</label>
                <input
                  type="text"
                  value={formulaForm.name}
                  onChange={(e) => setFormulaForm({ ...formulaForm, name: e.target.value })}
                  placeholder="e.g. Imperial Cambodi Oud Extrait"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-gold-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Formula Code</label>
                <input
                  type="text"
                  value={formulaForm.code}
                  onChange={(e) => setFormulaForm({ ...formulaForm, code: e.target.value })}
                  placeholder="e.g. FOR-OUD-EXT-01"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-gold-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Notes & Description</label>
                <textarea
                  value={formulaForm.description}
                  onChange={(e) => setFormulaForm({ ...formulaForm, description: e.target.value })}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-gold-500"
                />
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1 font-mono">
                <div>Concentration: {selectedType.toUpperCase()} ({oilPercentage}% Oil)</div>
                <div>Ingredients: {calculation?.components.length} components auto-scaled to 100%</div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowFormulaModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-200 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => saveFormulaMutation.mutate()}
                disabled={saveFormulaMutation.isPending || !formulaForm.name || !formulaForm.code}
                className="px-4 py-2 rounded-lg bg-gold-500 text-slate-950 font-semibold text-xs hover:bg-gold-400 transition-colors disabled:opacity-50"
              >
                {saveFormulaMutation.isPending ? 'Saving...' : 'Confirm & Save Formula'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert to Batch Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl shadow-amber-500/10">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Factory className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-serif font-bold text-slate-100">Convert to Manufacturing Batch</h3>
                <p className="text-xs text-slate-400">
                  Instantly creates a draft production batch with target volume
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Batch Perfume Name</label>
                <input
                  type="text"
                  value={batchForm.name}
                  onChange={(e) => setBatchForm({ ...batchForm, name: e.target.value })}
                  placeholder="e.g. Royal Oud Batch Run"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Production Notes</label>
                <textarea
                  value={batchForm.notes}
                  onChange={(e) => setBatchForm({ ...batchForm, notes: e.target.value })}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1 font-mono">
                <div>Target Volume: {formatNumber(targetVolume)} ml</div>
                <div>Est. Unit Cost: {formatCurrency(calculation?.cost_per_ml || 0)} / ml</div>
                <div>Total Est. Cost: {formatCurrency(calculation?.total_cost || 0)}</div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-200 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => convertBatchMutation.mutate()}
                disabled={convertBatchMutation.isPending || !batchForm.name}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-semibold text-xs hover:brightness-110 transition-all disabled:opacity-50"
              >
                {convertBatchMutation.isPending ? 'Initiating Batch...' : 'Create Production Batch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DilutionPage;
