import React from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  goldBorder?: boolean;
}

export const Card: React.FC<CardProps> = ({
  className,
  goldBorder = false,
  children,
  ...props
}) => {
  return (
    <div
      className={cn(
        'rounded-xl bg-card/90 backdrop-blur-md p-6 shadow-xl transition-all duration-300',
        goldBorder
          ? 'border border-gold-400/30 hover:border-gold-400/50 shadow-[0_4px_24px_rgba(212,175,55,0.08)]'
          : 'border border-border/80 hover:border-border',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};
