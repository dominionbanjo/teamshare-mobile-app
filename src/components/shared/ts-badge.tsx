import * as React from 'react';
import { Text, type TextProps } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import type { EnvTier, TaskPriority, TaskStatus } from '@/lib/validation/schemas';

const tsBadgeVariants = cva('overflow-hidden rounded-full px-2.5 py-1 text-xs font-semibold', {
  variants: {
    tone: {
      success: 'bg-[var(--ts-success-100)] text-[var(--ts-success-500)]',
      warning: 'bg-[var(--ts-warning-100)] text-[var(--ts-warning-500)]',
      error: 'bg-[var(--ts-error-100)] text-[var(--ts-error-500)]',
      info: 'bg-[var(--ts-info-100)] text-[var(--ts-info-500)]',
      violet: 'bg-[var(--ts-violet-100)] text-[var(--ts-violet-500)]',
      neutral: 'bg-muted text-muted-foreground',
      primary: 'bg-primary/10 text-primary',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export type TSBadgeProps = TextProps &
  VariantProps<typeof tsBadgeVariants> & {
    tone?: 'success' | 'warning' | 'error' | 'info' | 'violet' | 'neutral' | 'primary';
  };

/** TeamShare badge - pill, tinted per domain semantics (style guide 2.3/7.4). */
export function TSBadge({ className, tone = 'neutral', children, ...props }: TSBadgeProps) {
  return (
    <Text className={cn(tsBadgeVariants({ tone }), className)} {...props}>
      {children}
    </Text>
  );
}

const STATUS_META: Record<TaskStatus, { label: string; tone: NonNullable<TSBadgeProps['tone']> }> = {
  open: { label: 'Open', tone: 'info' },
  in_progress: { label: 'In Progress', tone: 'warning' },
  in_review: { label: 'In Review', tone: 'violet' },
  resolved: { label: 'Resolved', tone: 'success' },
  closed: { label: 'Closed', tone: 'neutral' },
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const meta = STATUS_META[status];
  return <TSBadge tone={meta.tone}>{meta.label}</TSBadge>;
}

const PRIORITY_META: Record<TaskPriority, { label: string; tone: NonNullable<TSBadgeProps['tone']> }> = {
  low: { label: 'Low', tone: 'neutral' },
  medium: { label: 'Medium', tone: 'info' },
  high: { label: 'High', tone: 'warning' },
  urgent: { label: 'Urgent', tone: 'error' },
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const meta = PRIORITY_META[priority];
  return <TSBadge tone={meta.tone}>{meta.label}</TSBadge>;
}

const TIER_META: Record<EnvTier, { label: string; tone: NonNullable<TSBadgeProps['tone']> }> = {
  dev: { label: 'dev', tone: 'success' },
  staging: { label: 'staging', tone: 'warning' },
  prod: { label: 'prod', tone: 'error' },
};

export function EnvTierBadge({ tier }: { tier: EnvTier }) {
  const meta = TIER_META[tier];
  return <TSBadge tone={meta.tone}>{meta.label}</TSBadge>;
}
