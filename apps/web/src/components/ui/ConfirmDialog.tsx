import React, { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
    onCancel: () => void;
    isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    open,
    title,
    message,
    confirmLabel,
    onConfirm,
    onCancel,
    isLoading = false,
}) => {
    const cancelRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!open) return undefined;
        cancelRef.current?.focus();
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !isLoading) onCancel();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open, isLoading, onCancel]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-background/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
            <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
                <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-danger/15 p-2 text-danger">
                        <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 id="confirm-dialog-title" className="text-base font-semibold text-foreground">{title}</h2>
                        <p className="mt-2 text-sm text-muted">{message}</p>
                    </div>
                    <button type="button" aria-label="Close confirmation" onClick={onCancel} disabled={isLoading} className="rounded p-1 text-muted hover:bg-surface hover:text-foreground disabled:opacity-50">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <button ref={cancelRef} type="button" onClick={onCancel} disabled={isLoading} className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-muted hover:bg-surface hover:text-foreground disabled:opacity-50">
                        Cancel
                    </button>
                    <button type="button" onClick={onConfirm} disabled={isLoading} className="rounded-lg bg-danger px-4 py-2 text-xs font-semibold text-accent-foreground hover:bg-danger/80 disabled:opacity-50">
                        {isLoading ? 'Working...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};
