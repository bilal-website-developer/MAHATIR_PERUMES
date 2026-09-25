import React from 'react';
import { Sparkles } from 'lucide-react';

interface BrandLogoProps {
    compact?: boolean;
    centered?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ compact = false, centered = false }) => {
    return (
        <div className={`flex items-center gap-3 ${centered ? 'justify-center text-center' : ''}`} aria-label="Mahatir Perfumes">
            <div className={`${compact ? 'h-9 w-9 rounded-lg' : 'h-11 w-11 rounded-xl'} flex shrink-0 items-center justify-center bg-gradient-to-br from-gold-300 via-gold-500 to-amber-700 shadow-[0_0_18px_rgba(212,175,55,0.28)]`}>
                <Sparkles className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} text-accent-foreground`} />
            </div>
            <div>
                <div className={`${compact ? 'text-base' : 'text-xl'} font-serif font-semibold tracking-[0.16em] gold-gradient-text`}>MAHATIR</div>
                <div className="text-[9px] uppercase tracking-[0.2em] text-sidebar-foreground/70">Haute Parfumerie ERP</div>
            </div>
        </div>
    );
};
