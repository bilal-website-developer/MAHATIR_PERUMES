import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface CopyButtonProps {
    value: string;
    label?: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({ value, label = 'Copy code' }) => {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
    };

    return (
        <button
            type="button"
            onClick={() => void copy()}
            aria-label={copied ? 'Copied' : label}
            title={copied ? 'Copied' : label}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-semibold text-muted hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
            {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
    );
};
