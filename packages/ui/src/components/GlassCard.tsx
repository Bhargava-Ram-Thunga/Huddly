import React, { type HTMLAttributes, forwardRef } from 'react';
import { cn } from '../utils/cn.js';

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, glow = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('huddly-card', glow && 'huddly-card-glow', className)}
        {...props}
      >
        {children}
      </div>
    );
  },
);

GlassCard.displayName = 'GlassCard';
