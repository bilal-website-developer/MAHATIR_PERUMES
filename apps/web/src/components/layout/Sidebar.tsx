import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Layers,
  FlaskConical,
  Factory,
  PackageCheck,
  ShoppingCart,
  Calculator,
  FileSpreadsheet,
  Compass,
  ShieldAlert,
  Settings,
  Activity,
  Sparkles,
  Users,
  Bell,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  phase: string;
  module: string;
  badge?: string;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, phase: 'Core', module: 'dashboard' },
  { name: 'System Diagnostics', href: '/health', icon: Activity, phase: 'Phase 0', module: 'health' },
  { name: 'System Settings', href: '/settings', icon: Settings, phase: 'Phase 0', module: 'settings' },
  { name: 'Staff & Roles', href: '/users', icon: Users, phase: 'Phase 1', module: 'users' },
  { name: 'Audit Trail', href: '/audit', icon: ShieldAlert, phase: 'Phase 1', module: 'audit' },
  { name: 'Raw Materials', href: '/raw-materials', icon: Layers, phase: 'Phase 2', module: 'raw_materials' },
  { name: 'Purchase Orders', href: '/purchase-orders', icon: FileSpreadsheet, phase: 'Phase 2', module: 'purchases' },
  { name: 'Suppliers Directory', href: '/suppliers', icon: Settings, phase: 'Phase 2', module: 'suppliers' },
  { name: 'Formulas (BOM)', href: '/formulas', icon: FlaskConical, phase: 'Phase 3', module: 'formulas' },
  { name: 'Batch Production', href: '/batches', icon: Factory, phase: 'Phase 4', module: 'batches' },
  { name: 'Bottling & SKUs', href: '/finished-goods', icon: PackageCheck, phase: 'Phase 5', module: 'bottling' },
  { name: 'Retail POS Counter', href: '/pos', icon: ShoppingCart, phase: 'Phase 6', module: 'pos', badge: 'Touch' },
  { name: 'Dilution Calculator', href: '/dilution', icon: Calculator, phase: 'Phase 7', module: 'dilution' },
  { name: 'Financial Reports', href: '/reports', icon: FileSpreadsheet, phase: 'Phase 8', module: 'reports' },
  { name: 'Traceability Navigator', href: '/traceability', icon: Compass, phase: 'Phase 8', module: 'reports' },
  { name: 'Alerts & System Health', href: '/alerts', icon: Bell, phase: 'Phase 9', module: 'dashboard' },
  { name: 'Production Suggestions', href: '/suggestions', icon: Sparkles, phase: 'Phase 9', module: 'batches' },
];

export const Sidebar: React.FC = () => {
  const { user, canAccess } = useAuth();

  // Filter navigation items based on role permissions
  const visibleNav = navigation.filter((item) => canAccess(item.module));

  return (
    <aside className="w-64 bg-[#0f121a] border-r border-slate-800/80 flex flex-col h-screen sticky top-0 select-none z-20">
      {/* Brand Header */}
      <div className="h-20 flex items-center px-6 border-b border-slate-800/60 bg-gradient-to-b from-[#141824] to-[#0f121a]">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-gold-300 via-gold-500 to-amber-700 flex items-center justify-center shadow-[0_0_15px_rgba(212,175,55,0.3)]">
            <Sparkles className="h-5 w-5 text-slate-950" />
          </div>
          <div>
            <h1 className="font-serif text-lg font-bold tracking-wider gold-gradient-text">
              MAHATIR
            </h1>
            <p className="text-[10px] tracking-widest uppercase text-slate-400 font-sans">
              Haute Parfumerie ERP
            </p>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <div className="flex items-center justify-between px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          <span>Modules</span>
          <span className="text-[9px] text-gold-400">{user?.role}</span>
        </div>

        {visibleNav.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              cn(
                'group flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-all duration-150',
                isActive
                  ? 'bg-gold-500/15 text-gold-300 border-l-2 border-gold-400 font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40',
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className="flex items-center space-x-3">
                  <item.icon
                    className={cn(
                      'h-4 w-4 transition-colors',
                      isActive ? 'text-gold-400' : 'text-slate-500 group-hover:text-slate-300',
                    )}
                  />
                  <span>{item.name}</span>
                </div>
                {item.badge ? (
                  <span className="text-[9px] font-semibold bg-gold-500/20 text-gold-300 px-1.5 py-0.5 rounded border border-gold-400/30">
                    {item.badge}
                  </span>
                ) : (
                  <span className="text-[9px] text-slate-600 group-hover:text-slate-500">
                    {item.phase}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* Footer / System Status */}
      <div className="p-4 border-t border-slate-800/60 bg-[#0d1017]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-300 font-medium">Phase 1 Active</span>
          </div>
          <span className="text-[10px] text-gold-400 font-mono font-medium">RLS On</span>
        </div>
      </div>
    </aside>
  );
};
