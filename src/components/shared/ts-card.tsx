import * as React from 'react';
import { View, type ViewProps } from 'react-native';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';

export type TSCardProps = ViewProps & {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
};

/** TeamShare card - surface + border + rounded-lg + shadow-sm (style guide 5). */
export function TSCard({ title, description, actions, footer, className, children, ...props }: TSCardProps) {
  return (
    <Card className={cn('rounded-lg border border-border bg-background shadow-sm', className)} {...props}>
      {(title || actions) && (
        <CardHeader className="flex-row items-center justify-between gap-3">
          <View className="flex-1">
            {title && <CardTitle className="text-base">{title}</CardTitle>}
            {description && <CardDescription className="text-xs text-muted-foreground">{description}</CardDescription>}
          </View>
          {actions}
        </CardHeader>
      )}
      <CardContent className="p-4">{children}</CardContent>
      {footer && <CardFooter className="p-4 pt-0">{footer}</CardFooter>}
    </Card>
  );
}
