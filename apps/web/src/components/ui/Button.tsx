import React from 'react';
import { cn } from '../../lib/utils';
import { playClickSound } from '../../lib/sound';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, children, disabled, onClick, ...props }, ref) => {
    const baseClasses = 'inline-flex items-center justify-center font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed select-none';

    const sizeClasses = {
      sm: 'px-3 py-1.5 text-xs tracking-wide',
      md: 'px-4 py-2 text-sm tracking-wide',
      lg: 'px-6 py-2.5 text-base tracking-wide',
    };

    const variantClasses = {
      primary: 'erp-primary-button font-semibold shadow-[0_2px_14px_var(--accent-glow-color)] focus:ring-accent',
      secondary: 'bg-surface text-foreground hover:bg-card border border-border/60 focus:ring-muted',
      outline: 'border border-accent/40 text-accent hover:bg-accent/10 focus:ring-accent',
      ghost: 'text-muted hover:text-foreground hover:bg-surface/50 focus:ring-muted',
      danger: 'bg-danger/40 text-danger border border-danger/50 hover:bg-danger/60 focus:ring-danger',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        data-sound-button="true"
        className={cn(baseClasses, sizeClasses[size], variantClasses[variant], className)}
        onClick={(event) => {
          playClickSound();
          onClick?.(event);
        }}
        {...props}
      >
        {isLoading ? (
          <span className={cn('flex items-center space-x-2', variant === 'primary' && 'erp-button-content')}>
            <svg className="animate-spin h-4 w-4 text-current" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Processing...</span>
          </span>
        ) : (
          variant === 'primary' ? <span className="erp-button-content">{children}</span> : children
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';
