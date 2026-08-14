import * as React from 'react';
import { Text, View } from 'react-native';
import { Radar } from 'iconsax-react-native';

import { TSAvatar } from '@/components/shared';
import { cn } from '@/lib/utils';
import { tokens } from '@/constants/theme';

export interface TSAgentAvatarProps {
  name: string;
  src?: string | null;
  size?: 20 | 24 | 32 | 40;
  className?: string;
}

/** Agent avatar - initials + a small Radar corner chip (agents are users with kind = "agent"). */
export function TSAgentAvatar({ name, src, size = 40, className }: TSAgentAvatarProps) {
  return (
    <View className={cn('relative shrink-0', className)}>
      <TSAvatar name={name} src={src} size={size} />
      <View
        className="absolute -bottom-0.5 -right-0.5 items-center justify-center rounded-full border-2 border-background"
        style={{
          width: Math.max(14, size / 2),
          height: Math.max(14, size / 2),
          backgroundColor: tokens.violet100,
        }}
      >
        <Radar size={Math.max(8, size / 3.2)} variant="Bold" color={tokens.violet} />
      </View>
    </View>
  );
}

/** Inline "AI" pill - violet tint pair per style guide section 7.4. */
export function TSAgentBadge() {
  return (
    <View
      className="flex-row items-center gap-0.5 self-start rounded-full px-1.5 py-0.5"
      style={{ backgroundColor: tokens.violet100 }}
    >
      <Radar size={11} variant="Bold" color={tokens.violet} />
      <Text className="text-[10px] font-bold" style={{ color: tokens.violet }}>
        AI
      </Text>
    </View>
  );
}
