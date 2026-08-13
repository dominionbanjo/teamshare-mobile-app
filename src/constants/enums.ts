import {
  ApiKeyScopeSchema,
  CompanyRoleSchema,
  DocumentTypeSchema,
  EnvTierSchema,
  EnvVarActionSchema,
  InvitationStatusSchema,
  PlanSchema,
  ProjectRoleSchema,
  ProjectStatusSchema,
  ProviderSchema,
  TaskPrioritySchema,
  TaskStatusSchema,
  WebhookEventSchema,
} from '@/lib/validation/schemas';

/**
 * Canonical enum constants for the mobile app, mirroring the backend's
 * src/common/constants/enums.ts (see docs/api-contract.md type-mirroring
 * rule). Every value derives from the zod schemas in
 * src/lib/validation/schemas.ts — the backend contract is canonical, these
 * cannot drift on their own.
 *
 * Naming: `<Name>Enum` = value record, `<NAME>_VALUES` = value array,
 * `type <Name>Value` = the union type.
 */

export const CompanyRoleEnum = CompanyRoleSchema.enum;
export const COMPANY_ROLE_VALUES = CompanyRoleSchema.options;
export type CompanyRoleValue = (typeof COMPANY_ROLE_VALUES)[number];

export const ProjectRoleEnum = ProjectRoleSchema.enum;
export const PROJECT_ROLE_VALUES = ProjectRoleSchema.options;
export type ProjectRoleValue = (typeof PROJECT_ROLE_VALUES)[number];

export const TaskStatusEnum = TaskStatusSchema.enum;
export const TASK_STATUS_VALUES = TaskStatusSchema.options;
export type TaskStatusValue = (typeof TASK_STATUS_VALUES)[number];

export const TaskPriorityEnum = TaskPrioritySchema.enum;
export const TASK_PRIORITY_VALUES = TaskPrioritySchema.options;
export type TaskPriorityValue = (typeof TASK_PRIORITY_VALUES)[number];

export const EnvTierEnum = EnvTierSchema.enum;
export const ENV_TIER_VALUES = EnvTierSchema.options;
export type EnvTierValue = (typeof ENV_TIER_VALUES)[number];

export const ProjectStatusEnum = ProjectStatusSchema.enum;
export const PROJECT_STATUS_VALUES = ProjectStatusSchema.options;
export type ProjectStatusValue = (typeof PROJECT_STATUS_VALUES)[number];

export const DocumentTypeEnum = DocumentTypeSchema.enum;
export const DOCUMENT_TYPE_VALUES = DocumentTypeSchema.options;
export type DocumentTypeValue = (typeof DOCUMENT_TYPE_VALUES)[number];

export const InvitationStatusEnum = InvitationStatusSchema.enum;
export const INVITATION_STATUS_VALUES = InvitationStatusSchema.options;
export type InvitationStatusValue = (typeof INVITATION_STATUS_VALUES)[number];

export const PlanEnum = PlanSchema.enum;
export const PLAN_VALUES = PlanSchema.options;
export type PlanValue = (typeof PLAN_VALUES)[number];

export const ProviderEnum = ProviderSchema.enum;
export const PROVIDER_VALUES = ProviderSchema.options;
export type ProviderValue = (typeof PROVIDER_VALUES)[number];

export const EnvVarActionEnum = EnvVarActionSchema.enum;
export const ENV_VAR_ACTION_VALUES = EnvVarActionSchema.options;
export type EnvVarActionValue = (typeof ENV_VAR_ACTION_VALUES)[number];

export const ApiKeyScopeEnum = ApiKeyScopeSchema.enum;
export const API_KEY_SCOPES = ApiKeyScopeSchema.options;
export type ApiKeyScopeValue = (typeof API_KEY_SCOPES)[number];

export const WebhookEventEnum = WebhookEventSchema.enum;
export const WEBHOOK_EVENTS = WebhookEventSchema.options;
export type WebhookEventValue = (typeof WEBHOOK_EVENTS)[number];

/** Paid plans offered via upgrade (mirrors backend UPGRADE_PLANS). */
export const UPGRADE_PLANS = ['pro', 'enterprise'] as const;
export type UpgradePlan = (typeof UPGRADE_PLANS)[number];

/** Notification `type` values (mirrors backend NotificationTypeEnum). */
export const NotificationTypeEnum = {
  mention: 'mention',
  assignment: 'assignment',
  due_date: 'due_date',
  comment: 'comment',
  invite: 'invite',
  task_resolved: 'task_resolved',
  task_started: 'task_started',
  task_reopened: 'task_reopened',
  task_closed: 'task_closed',
  digest: 'digest',
} as const;
export type NotificationType =
  (typeof NotificationTypeEnum)[keyof typeof NotificationTypeEnum];

/** Notification / entity `entityType` values (mirrors backend). */
export const EntityTypeEnum = {
  task: 'task',
  comment: 'comment',
  document: 'document',
  chat: 'chat',
  project: 'project',
  company: 'company',
} as const;
export type EntityTypeValue =
  (typeof EntityTypeEnum)[keyof typeof EntityTypeEnum];

/** Search entity kinds (mirrors backend SEARCH_TYPES). */
export const SEARCH_TYPES = [
  'task',
  'comment',
  'document',
  'chat',
  'all',
] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

/** Allowed task status transitions (PRD s6.4 state machine). */
export const TASK_STATUS_TRANSITIONS: Record<
  TaskStatusValue,
  TaskStatusValue[]
> = {
  [TaskStatusEnum.open]: [TaskStatusEnum.in_progress],
  [TaskStatusEnum.in_progress]: [TaskStatusEnum.in_review, TaskStatusEnum.open],
  [TaskStatusEnum.in_review]: [
    TaskStatusEnum.resolved,
    TaskStatusEnum.in_progress,
    TaskStatusEnum.open,
  ],
  [TaskStatusEnum.resolved]: [TaskStatusEnum.closed, TaskStatusEnum.open],
  [TaskStatusEnum.closed]: [TaskStatusEnum.open],
};
