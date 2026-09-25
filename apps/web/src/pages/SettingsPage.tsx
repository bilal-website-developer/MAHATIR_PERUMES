import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { DataTable, Column } from '../components/common/DataTable';
import { apiClient } from '../lib/api';
import { Settings, Plus } from 'lucide-react';

interface BranchItem {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  is_active: boolean;
}

interface AppSettings {
  id: string;
  company_name: string;
  currency: string;
  currency_symbol: string;
  tax_percentage: string | number;
  invoice_prefix: string;
  contact_email: string;
  phone: string;
  address: string;
}

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [settingsRes, branchesRes] = await Promise.all([
          apiClient<AppSettings>('/api/v1/settings'),
          apiClient<BranchItem[]>('/api/v1/branches'),
        ]);

        if (settingsRes.data) setSettings(settingsRes.data);
        if (branchesRes.data) setBranches(branchesRes.data);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const branchColumns: Column<BranchItem>[] = [
    {
      key: 'name',
      header: 'Branch Name',
      sortable: true,
      accessor: (item) => (
        <div>
          <div className="font-semibold text-slate-100">{item.name}</div>
          <div className="text-[11px] text-slate-400">{item.address}</div>
        </div>
      ),
    },
    {
      key: 'code',
      header: 'Code',
      sortable: true,
      accessor: (item) => (
        <span className="font-mono text-xs font-semibold text-gold-300 bg-gold-500/10 px-2 py-0.5 rounded border border-gold-400/20">
          {item.code}
        </span>
      ),
    },
    {
      key: 'phone',
      header: 'Contact Phone',
      sortable: true,
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
    },
    {
      key: 'is_active',
      header: 'Status',
      sortable: true,
      accessor: (item) => (
        <Badge variant={item.is_active ? 'success' : 'neutral'}>
          {item.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Settings className="h-6 w-6 text-gold-400" />
          <span>Application Settings & Multi-Branch Architecture</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Global ERP configurations, default tax %, currency symbols, and multi-branch registry.
        </p>
      </div>

      {/* Global Settings Summary */}
      <Card goldBorder className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <h2 className="font-serif text-lg font-semibold text-slate-100">
            Company & System Defaults
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="bg-sidebar p-3.5 rounded-lg border border-slate-800">
            <span className="text-slate-400 uppercase tracking-wider text-[10px] block">
              Company Name
            </span>
            <span className="text-slate-100 font-semibold text-sm mt-1 block">
              {settings?.company_name || 'Mahatir Perfumes'}
            </span>
          </div>

          <div className="bg-sidebar p-3.5 rounded-lg border border-slate-800">
            <span className="text-slate-400 uppercase tracking-wider text-[10px] block">
              Base Currency
            </span>
            <span className="text-gold-300 font-semibold text-sm mt-1 block">
              {settings?.currency || 'PKR'} ({settings?.currency_symbol || 'Rs. '})
            </span>
          </div>

          <div className="bg-sidebar p-3.5 rounded-lg border border-slate-800">
            <span className="text-slate-400 uppercase tracking-wider text-[10px] block">
              Default VAT / Tax %
            </span>
            <span className="text-slate-100 font-semibold text-sm mt-1 block">
              {settings?.tax_percentage ?? '5.00'}%
            </span>
          </div>

          <div className="bg-sidebar p-3.5 rounded-lg border border-slate-800">
            <span className="text-slate-400 uppercase tracking-wider text-[10px] block">
              Invoice Prefix
            </span>
            <span className="font-mono text-slate-100 font-semibold text-sm mt-1 block">
              {settings?.invoice_prefix || 'MP-INV-'}
            </span>
          </div>
        </div>
      </Card>

      {/* Branches Table via Reusable DataTable */}
      <Card className="space-y-4">
        <DataTable
          title="Active Operational Branches"
          data={branches}
          columns={branchColumns}
          isLoading={loading}
          searchPlaceholder="Search branch by name, code, address..."
          exportFileName="mahatir-branches"
          actionButton={
            <Button size="sm" variant="outline" className="flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              <span>Add Branch</span>
            </Button>
          }
        />
      </Card>
    </div>
  );
};
