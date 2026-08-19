import { cva, type VariantProps } from 'class-variance-authority';
import React, { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '../utils/cn.js';

export const buttonVariants = cva('huddly-btn', {
  variants: {
    variant: {
      primary: 'huddly-btn-primary',
      glass: 'huddly-btn-glass',
      secondary: 'huddly-btn-secondary',
      danger: 'huddly-btn-danger',
      ghost: 'huddly-btn-ghost',
      outline: 'huddly-btn-outline',
    },
    size: {
      xs: 'huddly-btn-xs',
      sm: 'huddly-btn-sm',
      md: 'huddly-btn-md',
      lg: 'huddly-btn-lg',
      icon: 'huddly-btn-icon',
      'icon-sm': 'huddly-btn-icon-sm',
      'icon-lg': 'huddly-btn-icon-lg',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
});

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, children, ...props }, ref) => {
    return (
      <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props}>
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
