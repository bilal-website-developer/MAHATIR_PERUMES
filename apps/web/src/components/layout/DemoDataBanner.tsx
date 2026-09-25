import React, { useState } from 'react';
import { Database, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/api';
import { useLocation } from 'react-router-dom';

const CLEARED_PREFIX = 'mahatir_demo_data_cleared:';

export const DemoDataBanner: React.FC = () => {
    const { user } = useAuth();
    const { pathname } = useLocation();
    const storageKey = `${CLEARED_PREFIX}${pathname}`;
    const [visible, setVisible] = useState(() => localStorage.getItem(storageKey) !== 'true');
    const [isClearing, setIsClearing] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!visible || !user) return null;

    const clearDemoData = async () => {
        setIsClearing(true);
        setIsConfirmOpen(false);
        setError(null);
        const response = await apiClient<{ cleared: boolean; already_cleared: boolean }>('/api/v1/users/clear-demo-data', {
            method: 'POST',
        });

        if (response.error) {
            setError(response.error.message);
            setIsClearing(false);
            return;
        }

        localStorage.setItem(storageKey, 'true');
        setVisible(false);
    };

    return (
        <div className="mb-5 border border-warning/30 bg-warning/10 px-4 py-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
                <Database className="h-5 w-5 text-warning mt-0.5 shrink-0" />
                <div>
                    <p className="text-sm font-semibold text-foreground">Demo data is available</p>
                    <p className="text-xs text-muted">Clear seeded transactions and inventory once.</p>
                    {error && <p className="text-xs text-danger mt-1">{error}</p>}
                </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <button
                    type="button"
                    onClick={() => setIsConfirmOpen(true)}
                    disabled={isClearing}
                    className="inline-flex items-center gap-2 rounded-lg bg-danger/15 border border-danger/30 px-3 py-2 text-xs font-semibold text-danger hover:bg-danger/25 disabled:opacity-50"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                    {isClearing ? 'Clearing...' : 'Clear All Demo Data'}
                </button>
            </div>
            {isConfirmOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4" role="dialog" aria-modal="true" aria-labelledby="demo-data-confirm-title">
                    <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
                        <h2 id="demo-data-confirm-title" className="text-base font-semibold text-foreground">Remove demo data?</h2>
                        <p className="mt-2 text-sm text-muted">Only records explicitly marked as demo data will be removed. Real user data will be kept.</p>
                        <div className="mt-6 flex justify-end gap-3">
                            <button type="button" onClick={() => setIsConfirmOpen(false)} className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-muted hover:bg-surface">
                                Cancel
                            </button>
                            <button type="button" onClick={clearDemoData} className="rounded-lg bg-danger px-4 py-2 text-xs font-semibold text-accent-foreground hover:bg-danger/80">
                                Remove demo data
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
