/**
 * TeamShare billing - mirror of backend /billing (PRD F14).
 * Backend enforces plan limits (free: 5 members / 10 projects).
 */

import { apiFetch } from './client';

export type BillingPlanValue = 'free' | 'pro' | 'enterprise';

export interface BillingUsageItem {
  used: number;
  limit: number;
}

export interface BillingUsage {
  plan: BillingPlanValue;
  members: BillingUsageItem;
  projects: BillingUsageItem;
}

export interface BillingUpgradeResult {
  mock?: boolean;
  url?: string;
  message?: string;
  plan: BillingPlanValue;
}

export async function getBillingUsage(token: string): Promise<BillingUsage> {
  return apiFetch<BillingUsage>('/billing/usage', { token });
}

export async function upgradePlan(
  token: string,
  plan: Exclude<BillingPlanValue, 'free'>
): Promise<BillingUpgradeResult> {
  return apiFetch<BillingUpgradeResult>('/billing/upgrade', { method: 'POST', body: { plan }, token });
}
