import { z } from 'zod';

/**
 * Mirrors the backend contract (generated from prisma/schema.prisma).
 * Backend is the enforcement point; these drive react-hook-form resolvers.
 * See docs/api-contract.md (root).
 */

export const CompanyRoleSchema = z.enum(['owner', 'admin', 'member', 'viewer', 'secret_manager']);
export type CompanyRole = z.infer<typeof CompanyRoleSchema>;

export const ProjectRoleSchema = z.enum(['owner', 'member', 'viewer']);
export type ProjectRole = z.infer<typeof ProjectRoleSchema>;

export const TaskStatusSchema = z.enum(['open', 'in_progress', 'in_review', 'resolved', 'closed']);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

export const EnvTierSchema = z.enum(['dev', 'staging', 'prod']);
export type EnvTier = z.infer<typeof EnvTierSchema>;

export const DocumentTypeSchema = z.enum(['link', 'file']);
export type DocumentType = z.infer<typeof DocumentTypeSchema>;

export const ProjectStatusSchema = z.enum(['active', 'archived']);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const InvitationStatusSchema = z.enum([
  'pending',
  'accepted',
  'declined',
  'revoked',
  'expired',
]);
export type InvitationStatus = z.infer<typeof InvitationStatusSchema>;

export const PlanSchema = z.enum(['free', 'pro', 'enterprise']);
export type Plan = z.infer<typeof PlanSchema>;

export const ProviderSchema = z.enum(['email', 'google']);
export type Provider = z.infer<typeof ProviderSchema>;

export const EnvVarActionSchema = z.enum([
  'view',
  'reveal',
  'create',
  'edit',
  'delete',
  'export',
]);
export type EnvVarAction = z.infer<typeof EnvVarActionSchema>;

export const ApiKeyScopeSchema = z.enum([
  'tasks:read',
  'tasks:write',
  'projects:read',
  'chat:read',
]);
export type ApiKeyScope = z.infer<typeof ApiKeyScopeSchema>;

export const WebhookEventSchema = z.enum([
  'task.created',
  'task.resolved',
  'comment.created',
]);
export type WebhookEvent = z.infer<typeof WebhookEventSchema>;

export const emailSchema = z.string().email('Enter a valid email address').max(254);
export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters').max(128);
export const nameSchema = z.string().min(2, 'At least 2 characters').max(60, 'At most 60 characters');
export const uuidSchema = z.string().uuid('Invalid identifier');

export const SignUpSchema = z.object({ name: nameSchema, email: emailSchema, password: passwordSchema });
export type SignUpInput = z.infer<typeof SignUpSchema>;

export const SignInSchema = z.object({ email: emailSchema, password: z.string().min(1) });
export type SignInInput = z.infer<typeof SignInSchema>;

export const CreateCompanySchema = z.object({
  name: nameSchema,
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, hyphens only').min(2).max(40),
});
export type CreateCompanyInput = z.infer<typeof CreateCompanySchema>;

export const CreateInvitationSchema = z.object({ email: emailSchema, role: CompanyRoleSchema });
export const AcceptInvitationSchema = z.object({ token: z.string().min(1) });

export const CreateTeamSchema = z.object({ name: nameSchema, leadId: uuidSchema.optional() });

export const CreateProjectSchema = z.object({
  name: z.string().min(2, 'At least 2 characters').max(80),
  teamId: uuidSchema.optional(),
});
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export const CreateTaskSchema = z.object({
  projectId: uuidSchema,
  title: z.string().min(2, 'Title is required').max(120),
  description: z.string().max(10_000).optional(),
  status: TaskStatusSchema.default('open'),
  priority: TaskPrioritySchema.default('medium'),
  assigneeId: uuidSchema.optional(),
  dueDate: z.string().datetime().optional(),
  tags: z.array(z.string().min(1).max(24)).max(10).default([]),
});
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = CreateTaskSchema.omit({ projectId: true }).partial();

// Allowed status transitions (PRD s6.4 state machine) live in
// src/constants/enums.ts (import from there; re-exporting here would
// create an import cycle schemas <-> enums).

export const CreateCommentSchema = z.object({
  taskId: uuidSchema,
  body: z.string().min(1, 'Comment cannot be empty').max(8_000),
});

export const CreateEnvVarSchema = z.object({
  projectId: uuidSchema,
  key: z
    .string()
    .regex(/^[A-Z][A-Z0-9_]{1,63}$/, 'Uppercase letters, numbers, underscores (e.g. DATABASE_URL)')
    .max(64),
  value: z.string().min(1).max(8_000),
  tier: EnvTierSchema,
});
export type CreateEnvVarInput = z.infer<typeof CreateEnvVarSchema>;

export const SendChatMessageSchema = z.object({
  projectId: uuidSchema,
  body: z.string().min(1).max(4_000),
});

const httpUrlSchema = z
  .string()
  .trim()
  .max(2_048)
  .refine((v) => /^https?:\/\/.+/i.test(v), 'Enter a valid http(s) URL');

/** Document create payload - url required only for link-type docs (refined). */
export const CreateDocumentSchema = z
  .object({
    projectId: uuidSchema,
    name: z.string().min(2, 'At least 2 characters').max(120),
    type: DocumentTypeSchema.default('link'),
    url: httpUrlSchema.optional(),
  })
  .refine((v) => v.type !== 'link' || Boolean(v.url), { message: 'Enter a valid http(s) URL', path: ['url'] });
export type CreateDocumentInput = z.infer<typeof CreateDocumentSchema>;

/** Mobile form for adding a document link (projectId/type filled by caller). */
export const DocumentLinkFormSchema = z.object({
  name: z.string().min(2, 'At least 2 characters').max(120),
  url: httpUrlSchema,
});
export type DocumentLinkFormInput = z.infer<typeof DocumentLinkFormSchema>;

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const ForgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

/** YYYY-MM-DD text input for task due dates (converted to ISO before submit). */
export const DueDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD (e.g. 2026-12-31)')
  .or(z.literal(''))
  .optional();

export const CommentFormSchema = z.object({ body: z.string().min(1, 'Comment cannot be empty').max(8_000) });
export type CommentFormInput = z.infer<typeof CommentFormSchema>;

/** Mobile-friendly task create form (dueDate as YYYY-MM-DD text). */
export const CreateTaskFormSchema = z.object({
  title: z.string().min(2, 'Title is required').max(120),
  priority: TaskPrioritySchema.default('medium'),
  assigneeId: uuidSchema.optional().or(z.literal('')).optional(),
  dueDate: DueDateSchema,
});
export type CreateTaskFormInput = z.infer<typeof CreateTaskFormSchema>;

/** Project-scoped invite (roles from PRD section 5 project matrix). */
export const ProjectInviteSchema = z.object({
  email: emailSchema,
  role: ProjectRoleSchema.default('member'),
});
export type ProjectInviteInput = z.infer<typeof ProjectInviteSchema>;
