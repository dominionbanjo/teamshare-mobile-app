import * as React from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Eye, EyeSlash, SearchNormal1 } from 'iconsax-react-native';
import { tokens } from '@/constants/theme';

export type TSInputProps = TextInputProps & {
  /** IconSax element (variant + color per style guide). */
  leadingIcon?: React.ReactNode;
  trailing?: React.ReactNode;
  containerClassName?: string;
};

/** TeamShare input - 40px, strong border, focus ring per style guide 7.2. */
export const TSInput = React.forwardRef<TextInput, TSInputProps>(
  ({ className, containerClassName, leadingIcon, trailing, ...props }, ref) => (
    <View className={cn('relative w-full', containerClassName)}>
      {leadingIcon && (
        <View className="absolute inset-y-0 left-3 z-10 justify-center">{leadingIcon}</View>
      )}
      <Input
        ref={ref}
        className={cn(
          'h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground',
          leadingIcon && 'pl-10',
          trailing && 'pr-10',
          className
        )}
        {...props}
      />
      {trailing && <View className="absolute inset-y-0 right-3 justify-center">{trailing}</View>}
    </View>
  )
);
TSInput.displayName = 'TSInput';

/** Password input with Eye/EyeSlash reveal toggle (style guide 7.2). */
export function TSPasswordInput(props: Omit<TSInputProps, 'type' | 'trailing'>) {
  const [visible, setVisible] = React.useState(false);
  return (
    <TSInput
      secureTextEntry={!visible}
      trailing={
        <Pressable
          onPress={() => setVisible((v) => !v)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? (
            <EyeSlash size={16} variant="Outline" color={tokens.textSecondary} />
          ) : (
            <Eye size={16} variant="Outline" color={tokens.textSecondary} />
          )}
        </Pressable>
      }
      {...props}
    />
  );
}

/** Search input with IconSax SearchNormal1 leading icon. */
export function TSSearchInput(props: Omit<TSInputProps, 'leadingIcon'>) {
  return (
    <TSInput
      leadingIcon={<SearchNormal1 size={16} variant="Outline" color={tokens.textMuted} />}
      placeholder="Search..."
      {...props}
    />
  );
}
