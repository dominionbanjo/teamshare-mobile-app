import * as React from 'react';
import { Text, View, type ViewProps } from 'react-native';
import {
  useForm,
  FormProvider,
  type FieldValues,
  type SubmitHandler,
  type UseFormReturn,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';

import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Text as UIText } from '@/components/ui/text';
import { InfoCircle } from 'iconsax-react-native';
import { tokens } from '@/constants/theme';

export type TSFormProps<T extends FieldValues> = {
  schema: z.ZodType<T>;
  onSubmit: SubmitHandler<T>;
  defaultValues?: Partial<T>;
  className?: string;
  render?: (methods: UseFormReturn<T>) => React.ReactNode;
  children?: React.ReactNode;
};

/**
 * TeamShare form - react-hook-form + zodResolver, mirrors the web TSForm.
 * Use TSFormField for label/error wiring.
 */
export function TSForm<T extends FieldValues>({
  schema,
  onSubmit,
  defaultValues,
  className,
  render,
  children,
}: TSFormProps<T>) {
  const form = useForm<T>({
    resolver: zodResolver(schema as never),
    defaultValues: defaultValues as never,
    mode: 'onTouched',
  });

  return (
    <FormProvider {...form}>
      <View className={cn('gap-4', className)}>
        {render ? render(form) : children}
      </View>
    </FormProvider>
  );
}

export type TSFormFieldProps = ViewProps & {
  name: string;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
};

/** Labeled + hinted + error-wired field row (style guide 7.2). */
export function TSFormField({ name, label, hint, error, required, children, className }: TSFormFieldProps) {
  return (
    <View className={cn('gap-2', className)}>
      {label && (
        <Label className="text-sm font-medium text-foreground">
          {label}
          {required && <Text className="text-[var(--ts-error-500)]"> *</Text>}
        </Label>
      )}
      {children}
      {hint && (
        <View className="flex-row items-center gap-1">
          <InfoCircle size={12} variant="Outline" color={tokens.textMuted} />
          <UIText className="text-xs text-muted-foreground">{hint}</UIText>
        </View>
      )}
      {error && <UIText className="text-xs text-[var(--ts-error-500)]">{error}</UIText>}
    </View>
  );
}
