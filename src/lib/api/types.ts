/**
 * TeamShare API types - public contract mirror of teamshare-backend
 * prisma/schema.prisma (see docs/api-contract.md). Backend is canonical.
 */

import type { ApiPagination } from './client';

/**
 * Enum value types (canonical: src/constants/enums.ts, derived from the zod
 * schemas that mirror the backend contract).
 */
import type {
  AgentCapabilityValue,
  AgentKindValue,
  AgentLogActionValue,
  AgentStatusValue,
  CompanyRoleValue,
  DocumentTypeValue,
  EnvTierValue,
  EnvVarActionValue,
  InvitationStatusValue,
  PlanValue,
  ProjectRoleValue,
  ProjectStatusValue,
  TaskPriorityValue,
  TaskStatusValue,
} from '@/constants/enums';
export type {
  AgentCapabilityValue,
  AgentKindValue,
  AgentLogActionValue,
  AgentStatusValue,
  CompanyRoleValue,
  DocumentTypeValue,
  EnvTierValue,
  EnvVarActionValue,
  InvitationStatusValue,
  PlanValue,
  ProjectRoleValue,
  ProjectStatusValue,
  TaskPriorityValue,
  TaskStatusValue,
};

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  /** Prisma UserKind - "agent" for AI crew members (Agent Hub contract). */
  kind?: AgentKindValue;
  createdAt: string;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  plan?: 'free' | 'pro' | 'enterprise';
  createdAt: string;
  memberships?: Membership[];
  /** Role of the requesting user (backend includes it on GET /companies/:id). */
  membershipRole?: CompanyRoleValue;
  owner?: User | null;
  _count?: { memberships: number; teams: number; projects: number };
}

export interface Membership {
  id: string;
  userId: string;
  companyId: string;
  role: CompanyRoleValue;
  joinedAt: string;
}

/** Row from GET /companies (memberships with the nested company). */
export interface CompanyMembershipRow {
  id: string;
  userId: string;
  companyId: string;
  role: CompanyRoleValue;
  joinedAt: string;
  company: Company;
}

/** Row from GET /companies/:id/members. */
export interface CompanyMember {
  id: string;
  userId: string;
  companyId: string;
  role: CompanyRoleValue;
  joinedAt: string;
  user: User;
}

export interface Team {
  id: string;
  companyId?: string | null;
  name: string;
  leadId?: string | null;
  createdBy: string;
  members?: TeamMember[];
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  user?: User;
}


export interface Project {
  id: string;
  name: string;
  companyId?: string | null;
  ownerId?: string | null;
  createdBy: string;
  status: ProjectStatusValue;
  teamId?: string | null;
  createdAt?: string;
  members?: ProjectMember[];
  tasks?: Task[];
  team?: Team | null;
  company?: Company | null;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: 'owner' | 'member' | 'viewer';
  user?: User;
}


export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  status: TaskStatusValue;
  priority: TaskPriorityValue;
  assigneeId?: string | null;
  dueDate?: string | null;
  tags: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  project?: Project | null;
  assignee?: User | null;
  creator?: User | null;
  /** Watch state - backend returns these on GET /tasks/:id. */
  watching?: boolean;
  watcherCount?: number;
  attachments?: Attachment[];
}

export interface Comment {
  id: string;
  taskId?: string | null;
  documentId?: string | null;
  parentId?: string | null;
  authorId: string;
  body: string;
  editedAt?: string | null;
  createdAt: string;
  author?: User | null;
}

export interface Attachment {
  id: string;
  taskId?: string | null;
  commentId?: string | null;
  fileKey?: string;
  url?: string | null;
  name: string;
  mime: string;
  uploadedBy: string;
  createdAt: string;
}


export interface Invitation {
  id: string;
  companyId?: string | null;
  projectId?: string | null;
  email: string;
  role: string;
  token: string;
  status: InvitationStatusValue;
  expiresAt: string;
  createdAt: string;
  company?: Company | null;
  project?: Project | null;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  actorId?: string | null;
  entityType: string;
  entityId?: string | null;
  title: string;
  body?: string | null;
  deepLink?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}


export interface Paginated<T> {
  items: T[];
  pagination: ApiPagination;
}

export interface ListParams {
  page?: number;
  pageSize?: number;
  search?: string;
}


/** Env var as returned by list endpoints - always masked (no value). */
export interface EnvVar {
  id: string;
  projectId: string;
  key: string;
  tier: EnvTierValue;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  creator?: User | null;
}

export interface EnvVarAuditEntry {
  id: string;
  envVarId: string;
  userId: string;
  action: EnvVarActionValue;
  at: string;
  user?: User | null;
}


export interface DocumentItem {
  id: string;
  projectId: string;
  type: DocumentTypeValue;
  /** http(s) URL for links; storage key/path or Cloudinary URL for files. */
  urlOrKey: string;
  name: string;
  mime?: string | null;
  uploadedBy: string;
  createdAt: string;
  uploader?: User | null;
}

export interface ChatMessage {
  id: string;
  projectId: string;
  authorId: string;
  body: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentMime?: string | null;
  editedAt?: string | null;
  createdAt: string;
  author?: User | null;
}

// ---------------------------------------------------------------- agents
// Agent Hub contract: docs/agent-tasks/agent-hub-connection.md

/** Mirrors backend AgentService list/detail payloads. */
export interface Agent {
  id: string;
  name: string;
  model?: string | null;
  systemPrompt?: string | null;
  capabilities: AgentCapabilityValue[];
  /** false = paused (archived): no wakes, tasks stay assigned. */
  active: boolean;
  status: AgentStatusValue;
  companyId?: string | null;
  createdBy: string;
  createdAt: string;
  lastSeenAt?: string | null;
  lastCheckedAt?: string | null;
  /** Backend addition (P2) - degrade gracefully when absent. */
  lastRunAt?: string | null;
  user?: Pick<User, 'id' | 'name' | 'avatarUrl' | 'kind'> | null;
  /** Project memberships from GET /agents/:id (detail only). */
  memberships?: { projectId: string }[] | null;
  _count?: { tasks: number; logs: number };
}

/** POST /agents response - plaintext API key shown exactly once. */
export interface AgentCreated {
  agent: Agent;
  token: string;
}

/** AgentLog row (GET /agents/:id/logs). */
export interface AgentLogRow {
  id: string;
  agentId: string;
  action: AgentLogActionValue;
  taskId?: string | null;
  task?: { id: string; title: string } | null;
  detail?: unknown;
  createdAt: string;
}
