import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { DataTable, Column } from '../components/common/DataTable';
import { apiClient } from '../lib/api';
import { ShieldAlert, FileText, Eye, Filter, X } from 'lucide-react';

interface AuditLogEntry {
  id: string;
  table_name: string;
  row_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  user_id: string | null;
  created_at: string;
}

export const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [tableFilter, setTableFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = '/api/v1/audit-log';
      const params = new URLSearchParams();
      if (tableFilter) params.append('table', tableFilter);
      if (actionFilter) params.append('action', actionFilter);
      if (params.toString()) query += `?${params.toString()}`;

      const res = await apiClient<AuditLogEntry[]>(query);
      if (res.data) setLogs(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [tableFilter, actionFilter]);

  const actionBadge = (action: AuditLogEntry['action']) => {
    switch (action) {
      case 'INSERT':
        return <Badge variant="success">INSERT</Badge>;
      case 'UPDATE':
        return <Badge variant="warning">UPDATE</Badge>;
      case 'DELETE':
        return <Badge variant="danger">DELETE</Badge>;
    }
  };

  const columns: Column<AuditLogEntry>[] = [
    {
      key: 'created_at',
      header: 'Timestamp',
      sortable: true,
      accessor: (entry) => (
        <span className="font-mono text-xs text-slate-300">
          {new Date(entry.created_at).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'table_name',
      header: 'Target Table',
      sortable: true,
      accessor: (entry) => (
        <span className="font-mono text-xs font-semibold text-gold-300 bg-gold-500/10 px-2 py-0.5 rounded border border-gold-400/20">
          {entry.table_name}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      sortable: true,
      accessor: (entry) => actionBadge(entry.action),
    },
    {
      key: 'row_id',
      header: 'Record UUID',
      sortable: true,
      accessor: (entry) => (
        <span className="font-mono text-xs text-slate-400 truncate max-w-[120px] block">
          {entry.row_id}
        </span>
      ),
    },
    {
      key: 'user_id',
      header: 'Acting User',
      sortable: true,
      accessor: (entry) => (
        <span className="font-mono text-xs text-slate-400">
          {entry.user_id ? `${entry.user_id.slice(0, 8)}...` : 'System Trigger'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Payload Diff',
      accessor: (entry) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedEntry(entry)}
          className="flex items-center gap-1.5 py-1 px-2.5 text-xs"
        >
          <Eye className="h-3 w-3 text-gold-400" />
          <span>Inspect Diff</span>
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-slate-100 flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-gold-400" />
            <span>Immutable Audit Trail</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            System-wide automated PostgreSQL trigger log capturing every INSERT, UPDATE, and DELETE.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Filter className="h-4 w-4 text-gold-400" />
          <span>Filter Logs:</span>
        </div>

        <select
          value={tableFilter}
          onChange={(e) => setTableFilter(e.target.value)}
          className="bg-[#0f1219] border border-slate-700 text-xs text-slate-200 rounded px-2.5 py-1.5 focus:border-gold-400 focus:outline-none"
        >
          <option value="">All Tables</option>
          <option value="profiles">profiles</option>
          <option value="branches">branches</option>
          <option value="app_settings">app_settings</option>
          <option value="raw_materials">raw_materials</option>
          <option value="formulas">formulas</option>
          <option value="batches">batches</option>
        </select>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="bg-[#0f1219] border border-slate-700 text-xs text-slate-200 rounded px-2.5 py-1.5 focus:border-gold-400 focus:outline-none"
        >
          <option value="">All Actions</option>
          <option value="INSERT">INSERT</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
        </select>

        {(tableFilter || actionFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setTableFilter('');
              setActionFilter('');
            }}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            Clear Filters
          </Button>
        )}
      </Card>

      {/* Audit DataTable */}
      <Card className="space-y-4">
        <DataTable
          title="Audit Ledger"
          data={logs}
          columns={columns}
          isLoading={loading}
          searchPlaceholder="Search audit records by table or id..."
          exportFileName="mahatir-audit-log"
        />
      </Card>

      {/* JSON Diff Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-[#141824] border border-gold-400/40 rounded-xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-serif text-lg font-semibold text-slate-100 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-gold-400" />
                  <span>Audit Change Diff — {selectedEntry.table_name}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Record ID: <span className="font-mono text-slate-300">{selectedEntry.row_id}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              {/* Old Data */}
              <div className="space-y-2">
                <div className="text-slate-400 font-semibold uppercase tracking-wider flex items-center justify-between">
                  <span>Previous State (OLD)</span>
                  <Badge variant="neutral">Before</Badge>
                </div>
                <div className="p-3 bg-[#0d1017] border border-slate-800 rounded-lg overflow-x-auto text-slate-300 max-h-96">
                  {selectedEntry.old_data ? (
                    <pre>{JSON.stringify(selectedEntry.old_data, null, 2)}</pre>
                  ) : (
                    <span className="text-slate-500 italic">None (INSERT operation)</span>
                  )}
                </div>
              </div>

              {/* New Data */}
              <div className="space-y-2">
                <div className="text-gold-300 font-semibold uppercase tracking-wider flex items-center justify-between">
                  <span>Applied State (NEW)</span>
                  <Badge variant="gold">After</Badge>
                </div>
                <div className="p-3 bg-[#0d1017] border border-gold-400/20 rounded-lg overflow-x-auto text-gold-100 max-h-96">
                  {selectedEntry.new_data ? (
                    <pre>{JSON.stringify(selectedEntry.new_data, null, 2)}</pre>
                  ) : (
                    <span className="text-rose-400 italic">None (DELETE operation)</span>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedEntry(null)}
              >
                Close Diff
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
