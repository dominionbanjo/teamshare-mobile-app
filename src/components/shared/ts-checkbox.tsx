import * as React from 'react';
import { View } from 'react-native';

import { Checkbox } from '@/components/ui/checkbox';

export type TSCheckboxProps = React.ComponentProps<typeof Checkbox>;

/**
 * TeamShare checkbox - vendor rn-primitives Checkbox wrapped for app code
 * (mirrors the web TSCheckbox; style guide 7.4).
 */
export function TSCheckbox(props: TSCheckboxProps) {
  return (
    <View>
      <Checkbox data-slot="ts-checkbox" {...props} />
    </View>
  );
}
