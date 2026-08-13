export type BillingPlanValue = 'free' | 'pro' | 'enterprise';

/** Mirrors backend BillingService.usage() ({success,data:{...}} envelope). */
export interface BillingUsage {
  plan: BillingPlanValue;
  members: number;
  projects: number;
  memberLimit: number | null;
  projectLimit: number | null;
  limitsReached: string[];
}

export interface BillingUpgradeResult {
  url?: string;
  reference?: string;
  mock?: boolean;
  message?: string;
  plan?: BillingPlanValue;
}

export async function getBillingUsage(token: string, companyId: string): Promise<BillingUsage> {
  return apiFetch<BillingUsage>('/billing/usage', { token, query: { companyId } });
}

export async function upgradePlan(
  token: string,
  companyId: string,
  plan: Exclude<BillingPlanValue, 'free'>
): Promise<BillingUpgradeResult> {
  return apiFetch<BillingUpgradeResult>('/billing/upgrade', {
    method: 'POST',
    body: { companyId, plan },
    token,
  });
}

import { apiFetch } from './client';
