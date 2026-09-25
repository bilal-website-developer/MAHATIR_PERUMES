import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Command, PackageSearch, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/api';

interface SearchItem {
    id: string;
    label: string;
    detail: string;
    href: string;
    kind: 'module' | 'product';
}

interface ProductResult {
    id: string;
    name: string;
    code: string;
    variants?: Array<{ name: string; sku: string }>;
}

const moduleItems: SearchItem[] = [
    { id: 'dashboard', label: 'Dashboard', detail: 'Overview and KPIs', href: '/', kind: 'module' },
    { id: 'raw-materials', label: 'Raw Materials', detail: 'Inventory and stock ledger', href: '/raw-materials', kind: 'module' },
    { id: 'purchase-orders', label: 'Purchase Orders', detail: 'Purchasing workflow', href: '/purchase-orders', kind: 'module' },
    { id: 'suppliers', label: 'Suppliers Directory', detail: 'Supplier records', href: '/suppliers', kind: 'module' },
    { id: 'formulas', label: 'Formulas (BOM)', detail: 'Formula and recipe management', href: '/formulas', kind: 'module' },
    { id: 'batches', label: 'Batch Production', detail: 'Manufacturing and bulk inventory', href: '/batches', kind: 'module' },
    { id: 'finished-goods', label: 'Bottling & SKUs', detail: 'Finished goods and variants', href: '/finished-goods', kind: 'module' },
    { id: 'pos', label: 'Retail POS Counter', detail: 'Sales and invoices', href: '/pos', kind: 'module' },
    { id: 'reports', label: 'Financial Reports', detail: 'Valuation and performance', href: '/reports', kind: 'module' },
    { id: 'traceability', label: 'Traceability Navigator', detail: 'Forward and backward trace', href: '/traceability', kind: 'module' },
    { id: 'alerts', label: 'Alerts & System Health', detail: 'Operational alerts', href: '/alerts', kind: 'module' },
];

const modulePermissions: Record<string, string> = {
    'raw-materials': 'raw_materials',
    'purchase-orders': 'purchases',
    suppliers: 'suppliers',
    formulas: 'formulas',
    batches: 'batches',
    'finished-goods': 'bottling',
    pos: 'pos',
    reports: 'reports',
    traceability: 'reports',
    alerts: 'dashboard',
};

export const GlobalSearch: React.FC = () => {
    const { canAccess } = useAuth();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [products, setProducts] = useState<SearchItem[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const accessibleModules = useMemo(
        () => moduleItems.filter((item) => canAccess(modulePermissions[item.id] || item.id)),
        [canAccess],
    );

    const results = useMemo(() => {
        const allItems = [...accessibleModules, ...products];
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) return allItems.slice(0, 8);
        return allItems.filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(normalizedQuery)).slice(0, 12);
    }, [accessibleModules, products, query]);

    useEffect(() => {
        const handleShortcut = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setOpen(true);
            }
            if (event.key === 'Escape') setOpen(false);
        };
        document.addEventListener('keydown', handleShortcut);
        return () => document.removeEventListener('keydown', handleShortcut);
    }, []);

    useEffect(() => {
        if (!open) return undefined;
        setActiveIndex(0);
        inputRef.current?.focus();

        const loadProducts = async () => {
            const response = await apiClient<ProductResult[]>('/api/v1/products');
            if (!response.data) return;
            setProducts(
                response.data.flatMap((product) => [
                    {
                        id: `product-${product.id}`,
                        label: product.name,
                        detail: `Product ${product.code}`,
                        href: '/pos',
                        kind: 'product' as const,
                    },
                    ...(product.variants || []).map((variant) => ({
                        id: `variant-${variant.sku}`,
                        label: `${product.name} ${variant.name}`,
                        detail: `SKU ${variant.sku}`,
                        href: '/pos',
                        kind: 'product' as const,
                    })),
                ]),
            );
        };
        void loadProducts();
        return undefined;
    }, [open]);

    const selectResult = (item: SearchItem | undefined) => {
        if (!item) return;
        setOpen(false);
        setQuery('');
        navigate(item.href);
    };

    return (
        <>
            <button
                type="button"
                aria-label="Search modules and products"
                onClick={() => setOpen(true)}
                className="hidden items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-muted hover:border-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:flex"
            >
                <Search className="h-3.5 w-3.5" />
                <span>Search</span>
                <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">Ctrl K</kbd>
            </button>
            {open && (
                <div className="fixed inset-0 z-[80] flex items-start justify-center bg-background/70 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
                    <div role="dialog" aria-modal="true" aria-label="Search modules and products" className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
                        <div className="flex items-center gap-3 border-b border-border px-4">
                            <Search className="h-5 w-5 text-accent" />
                            <input
                                ref={inputRef}
                                value={query}
                                onChange={(event) => {
                                    setQuery(event.target.value);
                                    setActiveIndex(0);
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === 'ArrowDown') {
                                        event.preventDefault();
                                        setActiveIndex((index) => Math.min(index + 1, results.length - 1));
                                    } else if (event.key === 'ArrowUp') {
                                        event.preventDefault();
                                        setActiveIndex((index) => Math.max(index - 1, 0));
                                    } else if (event.key === 'Enter') {
                                        event.preventDefault();
                                        selectResult(results[activeIndex]);
                                    } else if (event.key === 'Escape') {
                                        setOpen(false);
                                    }
                                }}
                                placeholder="Search modules, products, or SKUs..."
                                className="min-w-0 flex-1 bg-transparent py-4 text-sm text-foreground placeholder-muted focus:outline-none"
                            />
                            <button type="button" aria-label="Close search" onClick={() => setOpen(false)} className="rounded p-1 text-muted hover:bg-surface hover:text-foreground">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="max-h-[55vh] overflow-y-auto p-2">
                            {results.length === 0 ? (
                                <div className="px-3 py-10 text-center text-sm text-muted">No matching records found.</div>
                            ) : (
                                results.map((item, index) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onMouseEnter={() => setActiveIndex(index)}
                                        onClick={() => selectResult(item)}
                                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left ${index === activeIndex ? 'bg-surface' : ''}`}
                                    >
                                        {item.kind === 'product' ? <PackageSearch className="h-4 w-4 shrink-0 text-accent" /> : <Command className="h-4 w-4 shrink-0 text-muted" />}
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium text-foreground">{item.label}</span>
                                            <span className="block truncate text-xs text-muted">{item.detail}</span>
                                        </span>
                                        <span className="text-[10px] uppercase tracking-wider text-muted">{item.kind}</span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
