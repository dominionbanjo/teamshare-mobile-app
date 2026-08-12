import * as React from 'react';
import { Text, View, type ViewProps } from 'react-native';
import {
  useForm,
  FormProvider,
  Controller,
  useFormContext,
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
import { TSInput, TSPasswordInput } from './ts-input';
import { TSSelect } from './ts-select';

type FormErrors = Record<string, { message?: string } | undefined>;

function errorFor(formState: { errors: object }, name: string): string | undefined {
  return (formState.errors as FormErrors)[name]?.message;
}

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

/** Inline form-level error (mutation failures) - error tone per style guide 7.2. */
export function TSFormFieldError({ message }: { message: string }) {
  return (
    <View className="flex-row items-start gap-1.5 rounded-md bg-[var(--ts-error-100)] px-3 py-2">
      <InfoCircle size={14} variant="Outline" color={tokens.error} />
      <UIText className="flex-1 text-xs text-[var(--ts-error-500)]">{message}</UIText>
    </View>
  );
}

export type TSFormTextInputProps = {
  name: string;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  required?: boolean;
  className?: string;
} & React.ComponentProps<typeof TSInput>;

/** React-hook-form wired text input (uses FormProvider from TSForm). */
export function TSFormTextInput({ name, label, hint, required, className, ...props }: TSFormTextInputProps) {
  const { control, formState } = useFormContext();
  return (
    <TSFormField
      name={name}
      label={label}
      hint={hint}
      required={required}
      error={errorFor(formState, name)}
      className={className}
    >
      <Controller
        control={control}
        name={name as never}
        render={({ field }) => (
          <TSInput
            {...props}
            value={typeof field.value === 'string' ? field.value : ''}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
          />
        )}
      />
    </TSFormField>
  );
}

export type TSFormPasswordInputProps = Omit<TSFormTextInputProps, 'secureTextEntry'>;

/** React-hook-form wired password input. */
export function TSFormPasswordInput(props: TSFormPasswordInputProps) {
  const { control, formState } = useFormContext();
  const { name, label, hint, required, className } = props;
  return (
    <TSFormField
      name={name}
      label={label}
      hint={hint}
      required={required}
      error={errorFor(formState, name)}
      className={className}
    >
      <Controller
        control={control}
        name={name as never}
        render={({ field }) => (
          <TSPasswordInput
            value={typeof field.value === 'string' ? field.value : ''}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
          />
        )}
      />
    </TSFormField>
  );
}

export type TSFormSelectProps = {
  name: string;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  required?: boolean;
  placeholder?: string;
  options: { value: string; label: string }[];
  className?: string;
};

/** React-hook-form wired select. */
export function TSFormSelect({ name, label, hint, required, placeholder, options, className }: TSFormSelectProps) {
  const { control, formState } = useFormContext();
  return (
    <TSFormField
      name={name}
      label={label}
      hint={hint}
      required={required}
      error={errorFor(formState, name)}
      className={className}
    >
      <Controller
        control={control}
        name={name as never}
        render={({ field }) => (
          <TSSelect
            value={typeof field.value === 'string' ? field.value : undefined}
            onValueChange={field.onChange}
            placeholder={placeholder}
            options={options}
          />
        )}
      />
    </TSFormField>
  );
}
