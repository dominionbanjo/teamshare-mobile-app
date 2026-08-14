import * as React from 'react';
import { Text, View } from 'react-native';

import type { AgentStatusValue } from '@/constants/enums';
import { cn } from '@/lib/utils';
import { formatRelative } from '@/lib/format';
import { AGENT_STATUS_META } from './agent-utils';

export interface AgentStatusDotProps {
  status: AgentStatusValue;
  /** Pause (archive) state - overrides with a muted idle dot. */
  active?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

const DOT_SIZE = { sm: 'h-2 w-2', md: 'h-2.5 w-2.5' } as const;

const DOT_COLOR: Record<AgentStatusValue, string> = {
  online: 'bg-[var(--ts-success-500)]',
  working: 'bg-[var(--ts-warning-500)]',
  offline: 'bg-[var(--ts-text-muted)]',
};

/** The signature agent signal: green/amber/slate dot; paused agents go muted. */
export function AgentStatusDot({ status, active = true, size = 'md', className }: AgentStatusDotProps) {
  if (!active) {
    return <View className={cn('rounded-full bg-[var(--ts-text-muted)] opacity-60', DOT_SIZE[size], className)} />;
  }
  return <View className={cn('rounded-full', DOT_COLOR[status], DOT_SIZE[size], className)} />;
}

export interface AgentStatusLabelProps {
  status: AgentStatusValue;
  active?: boolean;
  lastSeenAt?: string | null;
  className?: string;
  size?: 'sm' | 'md';
}

/** Status signal + text label (+ relative last-seen), the agent heartbeat. */
export function AgentStatusLabel({ status, active = true, lastSeenAt, className, size = 'md' }: AgentStatusLabelProps) {
  const meta = AGENT_STATUS_META[status];
  const label = active ? meta.label : 'Paused';
  return (
    <View className={cn('flex-row items-center gap-1.5', className)}>
      <AgentStatusDot status={status} active={active} size={size} />
      <Text className={cn('font-medium text-foreground', size === 'sm' ? 'text-[11px]' : 'text-xs')}>{label}</Text>
      {active && lastSeenAt ? (
        <Text className={cn('text-muted-foreground', size === 'sm' ? 'text-[11px]' : 'text-xs')}>
          · {formatRelative(lastSeenAt)}
        </Text>
      ) : null}
    </View>
  );
}
