import { cva, type VariantProps } from 'class-variance-authority';
import React, { type HTMLAttributes } from 'react';
import { cn } from '../utils/cn.js';

export const badgeVariants = cva('huddly-badge', {
  variants: {
    variant: {
      default: 'huddly-badge-default',
      butter: 'huddly-badge-butter',
      caramel: 'huddly-badge-caramel',
      success: 'huddly-badge-success',
      danger: 'huddly-badge-danger',
      glass: 'huddly-badge-glass',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export const Badge: React.FC<BadgeProps> = ({ className, variant, children, ...props }) => {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {children}
    </span>
  );
};
