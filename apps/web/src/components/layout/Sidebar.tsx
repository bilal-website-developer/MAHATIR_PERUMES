import React, { useEffect, useRef } from 'react';
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
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  module: string;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, module: 'dashboard' },
  { name: 'System Diagnostics', href: '/health', icon: Activity, module: 'health' },
  { name: 'System Settings', href: '/settings', icon: Settings, module: 'settings' },
  { name: 'Staff & Roles', href: '/users', icon: Users, module: 'users' },
  { name: 'Raw Materials', href: '/raw-materials', icon: Layers, module: 'raw_materials' },
  { name: 'Purchase Orders', href: '/purchase-orders', icon: FileSpreadsheet, module: 'purchases' },
  { name: 'Suppliers Directory', href: '/suppliers', icon: Settings, module: 'suppliers' },
  { name: 'Formulas (BOM)', href: '/formulas', icon: FlaskConical, module: 'formulas' },
  { name: 'Batch Production', href: '/batches', icon: Factory, module: 'batches' },
  { name: 'Bottling & SKUs', href: '/finished-goods', icon: PackageCheck, module: 'bottling' },
  { name: 'Retail POS Counter', href: '/pos', icon: ShoppingCart, module: 'pos' },
  { name: 'Dilution Calculator', href: '/dilution', icon: Calculator, module: 'dilution' },
  { name: 'Financial Reports', href: '/reports', icon: FileSpreadsheet, module: 'reports' },
  { name: 'Traceability Navigator', href: '/traceability', icon: Compass, module: 'reports' },
  { name: 'Alerts & System Health', href: '/alerts', icon: Bell, module: 'dashboard' },
  { name: 'Production Suggestions', href: '/suggestions', icon: Sparkles, module: 'batches' },
  { name: 'Audit Ledger', href: '/audit', icon: ShieldAlert, module: 'audit' },
];

export const Sidebar: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { user, canAccess } = useAuth();
  const sidebarRef = useRef<HTMLElement>(null);

  // Filter navigation items based on role permissions
  const visibleNav = navigation.filter((item) => canAccess(item.module));

  useEffect(() => {
    if (!isOpen) return undefined;

    const sidebar = sidebarRef.current;
    if (!sidebar) return undefined;

    const focusable = sidebar.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
    focusable[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-background/70 backdrop-blur-sm md:hidden"
        />
      )}
      <aside
        data-print-hidden="true"
        ref={sidebarRef}
        aria-label="Main navigation"
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-64 transform flex-col select-none border-r border-border/80 bg-sidebar transition-transform duration-200 md:sticky md:top-0 md:z-20 md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {/* Brand Header */}
        <div className="h-20 flex items-center px-6 border-b border-border/60 bg-gradient-to-b from-card to-sidebar">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-gold-300 via-gold-500 to-amber-700 flex items-center justify-center shadow-[0_0_15px_rgba(212,175,55,0.3)]">
              <Sparkles className="h-5 w-5 text-slate-950" />
            </div>
            <div>
              <h1 className="font-serif text-lg font-bold tracking-wider gold-gradient-text">
                MAHATIR
              </h1>
              <p className="text-[10px] tracking-widest uppercase text-sidebar-foreground/70 font-sans">
                Haute Parfumerie ERP
              </p>
            </div>
            <button
              type="button"
              aria-label="Close navigation"
              onClick={onClose}
              className="ml-auto rounded-md p-1 text-muted hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Navigation List */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-0.5 sm:py-4">
          <div className="flex items-center justify-between px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/60">
            <span>Modules</span>
            <span className="text-[9px] text-accent">{user?.role}</span>
          </div>

          {visibleNav.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'group flex min-h-9 items-center justify-between px-3 py-2 text-xs font-medium leading-tight rounded-lg transition-all duration-150',
                  isActive
                    ? 'bg-gold-500/15 text-gold-300 border-l-2 border-gold-400 font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                    : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-surface/60',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center space-x-3">
                    <item.icon
                      className={cn(
                        'h-4 w-4 transition-colors',
                        isActive ? 'text-accent' : 'text-sidebar-foreground/60 group-hover:text-sidebar-foreground',
                      )}
                    />
                    <span>{item.name}</span>
                  </div>
                </>
              )}
            </NavLink>
          ))}
        </div>

        {/* Footer / System Status */}
        <div className="p-4 border-t border-border/60 bg-sidebar">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-sidebar-foreground font-medium">System Active</span>
            </div>
            <span className="text-[10px] text-gold-400 font-mono font-medium">RLS On</span>
          </div>
        </div>
      </aside>
    </>
  );
};
