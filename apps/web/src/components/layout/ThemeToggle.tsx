import React, { useEffect, useRef, useState } from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type Theme } from '../../context/ThemeContext';

const options: Array<{ value: Theme; label: string; icon: React.ElementType }> = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
];

export const ThemeToggle: React.FC = () => {
    const { theme, setTheme } = useTheme();
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(() => Math.max(0, options.findIndex((option) => option.value === theme)));
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setActiveIndex(Math.max(0, options.findIndex((option) => option.value === theme)));
    }, [theme]);

    useEffect(() => {
        const handlePointerDown = (event: PointerEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener('pointerdown', handlePointerDown);
        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, []);

    const CurrentIcon = options.find((option) => option.value === theme)?.icon || Monitor;

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                aria-label="Change theme"
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen((isOpen) => !isOpen)}
                onKeyDown={(event) => {
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                        event.preventDefault();
                        setOpen(true);
                        setActiveIndex((index) => (index + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length);
                    }
                    if (event.key === 'Escape') setOpen(false);
                }}
                className="rounded-lg p-2 text-muted hover:bg-surface hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent"
            >
                <CurrentIcon className="h-4 w-4" />
            </button>
            {open && (
                <div role="menu" aria-label="Theme options" className="absolute right-0 mt-2 w-36 rounded-lg border border-border bg-card p-1 shadow-xl">
                    {options.map((option, index) => {
                        const Icon = option.icon;
                        const selected = theme === option.value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                role="menuitemradio"
                                aria-checked={selected}
                                onMouseEnter={() => setActiveIndex(index)}
                                onClick={() => {
                                    setTheme(option.value);
                                    setOpen(false);
                                }}
                                className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs focus:outline-none focus:ring-2 focus:ring-accent ${activeIndex === index ? 'bg-surface' : ''} ${selected ? 'text-accent' : 'text-foreground'}`}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                <span className="flex-1">{option.label}</span>
                                {selected && <Check className="h-3.5 w-3.5" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
