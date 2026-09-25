import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, type = 'text', ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label className="block text-xs font-semibold uppercase tracking-wider text-foreground/80">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            type={isPassword && showPassword ? 'text' : type}
            ref={ref}
            className={cn(
              'w-full rounded-md bg-background px-3.5 py-2 text-sm text-foreground placeholder-muted transition-all duration-200',
              isPassword && 'pr-10',
              'border border-border/80 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/50',
              className,
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute inset-y-0 right-0 rounded-r-md px-3 text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        {!error && helperText && <p className="text-xs text-muted">{helperText}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
