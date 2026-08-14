import * as React from 'react';

import { Switch } from '@/components/ui/switch';

export type TSSwitchProps = Omit<React.ComponentProps<typeof Switch>, 'onCheckedChange'> & {
  /** Native alias for onCheckedChange - both fire on toggle. */
  onValueChange?: (checked: boolean) => void;
  onCheckedChange?: (checked: boolean) => void;
};

/** TeamShare switch - thin wrapper over the vendor switch (style guide 7.3). */
export function TSSwitch({ onValueChange, onCheckedChange, ...props }: TSSwitchProps) {
  return (
    <Switch
      {...props}
      onCheckedChange={(checked) => {
        onCheckedChange?.(checked);
        onValueChange?.(checked);
      }}
    />
  );
}
