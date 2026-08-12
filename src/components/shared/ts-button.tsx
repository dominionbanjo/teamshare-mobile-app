import * as React from 'react';
import { ActivityIndicator, Pressable, Text, type TextProps, type ViewProps } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const tsButtonVariants = cva('', {
  variants: {
    tsSize: {
      sm: 'h-8 px-3',
      md: 'h-10 px-4',
      lg: 'h-12 px-6',
    },
  },
  defaultVariants: { tsSize: 'md' },
});

export type TSButtonProps = React.ComponentProps<typeof Pressable> &
  VariantProps<typeof tsButtonVariants> & {
    tsSize?: 'sm' | 'md' | 'lg';
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
    loading?: boolean;
    /** IconSax element (variant + color required per style guide). */
    icon?: React.ReactNode;
    textClassName?: string;
  };

/** TeamShare button - size scale sm=32 / md=40 / lg=48 per style guide 7.1. */
export function TSButton({
  className,
  textClassName,
  tsSize = 'md',
  variant = 'default',
  loading = false,
  icon,
  children,
  disabled,
  ...props
}: TSButtonProps) {
  return (
    <Button
      className={cn(tsButtonVariants({ tsSize }), className)}
      variant={variant}
      disabled={disabled || loading}
      {...(props as object)}
    >
      {loading ? <ActivityIndicator size="small" color="#fff" /> : icon}
      {typeof children === 'string' ? (
        <Text className={cn('text-sm font-medium text-primary-foreground', textClassName)}>
          {children}
        </Text>
      ) : (
        (children as React.ReactNode)
      )}
    </Button>
  );
}
