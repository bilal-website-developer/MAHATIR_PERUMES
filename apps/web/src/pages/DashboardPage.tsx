import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  Layers,
  FlaskConical,
  Factory,
  PackageCheck,
  ShoppingCart,
  ArrowRight,
  TrendingUp,
  Percent,
  Compass,
  FileSpreadsheet,
  Calculator,
  AlertTriangle,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/api';
import { formatCurrency, formatNumber } from '../lib/utils';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  // Query live dashboard metrics
  const { data: dashboardData } = useQuery({
    queryKey: ['dashboard-telemetry', user?.role],
    queryFn: async () => {
      const res = await apiClient<any>('/api/v1/dashboard');
      return res.data;
    },
  });

  const lifecycleSteps = [
    { name: 'Raw Material', desc: 'Oils, Alcohol, Fixatives', icon: Layers, link: '/raw-materials' },
    { name: 'Formula (BOM)', desc: 'Scaled & Locked Recipes', icon: FlaskConical, link: '/formulas' },
    { name: 'Batch', desc: 'Bulk Compounding & Losses', icon: Factory, link: '/batches' },
    { name: 'Bottling', desc: 'SKU Variant Packaging', icon: PackageCheck, link: '/finished-goods' },
    { name: 'POS Sale', desc: 'Counter Sales & Decants', icon: ShoppingCart, link: '/pos' },
  ];

  const kpis = dashboardData?.kpis || {};

  return (
    <div className="space-y-8 animate-fadeIn max-w-7xl mx-auto pb-12">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-card via-card to-card border border-gold-400/25 p-8 shadow-2xl">
        <div className="absolute right-0 top-0 h-full w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-gold-500/10 via-transparent to-transparent pointer-events-none" />

        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center space-x-2 bg-gold-500/15 border border-gold-400/30 px-3 py-1 rounded-full text-xs text-gold-300">
            <Sparkles className="h-3.5 w-3.5 text-gold-400" />
            <span>Mahatir Perfumes Haute Parfumerie ERP + POS</span>
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-slate-100">
            Welcome, {user?.fullName || 'Master Perfumer'}
          </h1>

          <p className="text-sm text-slate-300 leading-relaxed">
            Centralized intelligence command for artisanal compounding, atomic inventory safety,
            boutique sales, and bidirectional lot-to-bottle traceability.
          </p>

          <div className="pt-2 flex flex-wrap gap-2.5">
            <Link
              to="/traceability"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-gold-500 text-slate-950 font-semibold text-xs hover:bg-gold-400 transition-colors shadow-sm"
            >
              <Compass className="h-4 w-4" />
              <span>Trace Provenance</span>
            </Link>
            <Link
              to="/reports"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg border border-slate-800 bg-slate-900/80 text-slate-200 font-medium text-xs hover:border-slate-700 transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4 text-gold-400" />
              <span>Financial Reports</span>
            </Link>
            <Link
              to="/pos"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg border border-slate-800 bg-slate-900/80 text-slate-200 font-medium text-xs hover:border-slate-700 transition-colors"
            >
              <ShoppingCart className="h-4 w-4 text-cyan-400" />
              <span>Retail POS Counter</span>
            </Link>
            <Link
              to="/dilution"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg border border-slate-800 bg-slate-900/80 text-slate-200 font-medium text-xs hover:border-slate-700 transition-colors"
            >
              <Calculator className="h-4 w-4 text-amber-400" />
              <span>Dilution Studio</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Role-Specific Live Telemetry KPI Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold text-slate-100 flex items-center gap-2">
            <span>Executive Business Telemetry</span>
            <Badge variant="gold" className="uppercase text-[9px]">
              {user?.role || 'Admin'} View
            </Badge>
          </h2>
          <span className="text-[11px] font-mono text-slate-500">Live Ledger Aggregates</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Card 1 */}
          <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                {user?.role === 'production_manager'
                  ? 'Active Production Batches'
                  : user?.role === 'inventory_manager'
                    ? 'Total Warehouse Valuation'
                    : user?.role === 'sales_staff'
                      ? "Today's Gross Sales"
                      : 'Total Retail Revenue'}
              </span>
              <TrendingUp className="h-4 w-4 text-gold-400" />
            </div>
            <div className="text-2xl font-serif font-bold text-slate-100">
              {user?.role === 'production_manager'
                ? kpis.active_batches ?? 1
                : user?.role === 'inventory_manager'
                  ? formatCurrency(kpis.total_warehouse_value || 0)
                  : formatCurrency(kpis.today_revenue || kpis.total_revenue || 0)}
            </div>
            <p className="text-[10px] text-slate-400 font-mono">Audited financial ledger</p>
          </div>

          {/* Card 2 */}
          <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                {user?.role === 'production_manager'
                  ? 'Bulk Maceration Liquid'
                  : user?.role === 'inventory_manager'
                    ? 'Raw Materials Valuation'
                    : user?.role === 'sales_staff'
                      ? 'Completed Invoices'
                      : 'Net Gross Profit'}
              </span>
              <Percent className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-serif font-bold text-emerald-400">
              {user?.role === 'production_manager'
                ? `${formatNumber(kpis.bulk_liquid_volume_ml || 0)} ml`
                : user?.role === 'inventory_manager'
                  ? formatCurrency(kpis.raw_materials_value || 0)
                  : user?.role === 'sales_staff'
                    ? kpis.completed_orders ?? 0
                    : formatCurrency(kpis.gross_profit || 0)}
            </div>
            <p className="text-[10px] text-slate-400 font-mono">
              {user?.role === 'admin' ? `${kpis.gross_margin || '0%'} Margin` : 'Verified stock balance'}
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                {user?.role === 'production_manager'
                  ? 'Bulk Valuation'
                  : user?.role === 'inventory_manager'
                    ? 'Packaging Materials Value'
                    : user?.role === 'sales_staff'
                      ? 'Average Order Value'
                      : 'Total Inventory Valuation'}
              </span>
              <Layers className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-serif font-bold text-slate-100">
              {user?.role === 'production_manager'
                ? formatCurrency(kpis.bulk_inventory_valuation || 0)
                : user?.role === 'inventory_manager'
                  ? formatCurrency(kpis.packaging_value || 0)
                  : user?.role === 'sales_staff'
                    ? formatCurrency(kpis.average_order_value || 0)
                    : formatCurrency(kpis.total_inventory_valuation || 0)}
            </div>
            <p className="text-[10px] text-slate-400 font-mono">Raw + Bulk + Finished Flacons</p>
          </div>

          {/* Card 4 */}
          <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                {user?.role === 'sales_staff' ? 'Available Flacon Lots' : 'Low Stock Reorder Alerts'}
              </span>
              <AlertTriangle className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-2xl font-serif font-bold text-amber-300">
              {user?.role === 'sales_staff'
                ? kpis.available_perfume_lots ?? 0
                : kpis.stock_alerts_count ?? kpis.reorder_alerts_count ?? kpis.low_stock_raw_materials ?? 0}
            </div>
            <p className="text-[10px] text-slate-400 font-mono">Safety stock triggers</p>
          </div>
        </div>
      </div>

      {/* Fragrance Business Lifecycle Diagram */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold text-slate-100">
            Fragrance Production & Commerce Lifecycle
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {lifecycleSteps.map((step, idx) => (
            <Link key={step.name} to={step.link}>
              <Card className="relative p-5 flex flex-col justify-between hover:border-gold-400/50 transition-all duration-200 h-full group">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="h-9 w-9 rounded-lg bg-gold-500/10 border border-gold-400/20 flex items-center justify-center text-gold-400 group-hover:scale-105 transition-transform">
                      <step.icon className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                      Step {idx + 1}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-slate-100 group-hover:text-gold-300 transition-colors">
                      {step.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">{step.desc}</p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-gold-400">Launch Module</span>
                  <ArrowRight className="h-3 w-3 text-slate-500 group-hover:translate-x-1 transition-transform" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
