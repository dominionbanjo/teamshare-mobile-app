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

export const TASK_STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  open: ['in_progress'],
  in_progress: ['in_review', 'open'],
  in_review: ['resolved', 'in_progress', 'open'],
  resolved: ['closed', 'open'],
  closed: ['open'],
};

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

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
