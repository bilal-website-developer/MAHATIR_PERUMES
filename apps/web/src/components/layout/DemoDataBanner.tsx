import React, { useState } from 'react';
import { Database, X, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/api';

const DISMISSED_KEY = 'mahatir_demo_data_prompt_dismissed';

export const DemoDataBanner: React.FC = () => {
    const { user } = useAuth();
    const [visible, setVisible] = useState(() => localStorage.getItem(DISMISSED_KEY) !== 'true');
    const [isClearing, setIsClearing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!visible || user?.role !== 'admin') return null;

    const dismiss = () => {
        localStorage.setItem(DISMISSED_KEY, 'true');
        setVisible(false);
    };

    const clearDemoData = async () => {
        if (!window.confirm('Clear demo transactions, inventory, alerts, and audit entries? User accounts, branches, settings, and units will remain.')) {
            return;
        }

        setIsClearing(true);
        setError(null);
        const response = await apiClient<{ cleared: boolean; already_cleared: boolean }>('/api/v1/users/clear-demo-data', {
            method: 'POST',
        });

        if (response.error) {
            setError(response.error.message);
            setIsClearing(false);
            return;
        }

        localStorage.setItem(DISMISSED_KEY, 'true');
        setVisible(false);
    };

    return (
        <div className="mb-5 border border-amber-500/30 bg-amber-500/10 px-4 py-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
                <Database className="h-5 w-5 text-amber-300 mt-0.5 shrink-0" />
                <div>
                    <p className="text-sm font-semibold text-amber-100">Demo data is available</p>
                    <p className="text-xs text-amber-200/70">Clear seeded transactions and inventory once, or dismiss this notice.</p>
                    {error && <p className="text-xs text-rose-300 mt-1">{error}</p>}
                </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <button type="button" onClick={dismiss} className="p-2 text-slate-300 hover:text-white" title="Keep demo data and dismiss">
                    <X className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={clearDemoData}
                    disabled={isClearing}
                    className="inline-flex items-center gap-2 rounded-lg bg-rose-500/15 border border-rose-400/30 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/25 disabled:opacity-50"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                    {isClearing ? 'Clearing...' : 'Clear demo data'}
                </button>
            </div>
        </div>
    );
};
