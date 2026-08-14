import * as React from 'react';
import { Text, View, type ViewProps } from 'react-native';

import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type TSSelectProps = ViewProps & {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
};

/**
 * TeamShare select - reusables Select. The chevron is rendered once by the
 * vendor SelectTrigger (ui/select) - never add another one here.
 */
export function TSSelect({
  value,
  onValueChange,
  placeholder = 'Select...',
  options,
  disabled,
  className,
}: TSSelectProps) {
  const selected = options.find((o) => o.value === value) ?? undefined;

  return (
    <Select
      value={selected}
      onValueChange={(option) => option && onValueChange?.(option.value)}
      disabled={disabled}
      className={cn('w-full', className)}
    >
      <SelectTrigger className="h-10 flex-row items-center justify-between rounded-md border border-input bg-background px-3">
        <SelectValue className="text-sm text-foreground" placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="bg-surface shadow-lg">
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} label={opt.label} className="h-9">
            <Text className="text-sm text-foreground">{opt.label}</Text>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
