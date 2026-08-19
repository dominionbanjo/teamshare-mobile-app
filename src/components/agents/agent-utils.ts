import type { AgentCapabilityValue, AgentLogActionValue, AgentStatusValue } from '@/constants/enums';

export interface CapabilityMeta {
  label: string;
  description: string;
}

/**
 * Display metadata per capability (Agent Hub contract section 1).
 * Backend is canonical; these are labels only, never enforcement.
 */
export const AGENT_CAPABILITY_META: Record<AgentCapabilityValue, CapabilityMeta> = {
  'tasks:read': { label: 'Read tasks', description: 'List and read tasks' },
  'tasks:create': { label: 'Create tasks', description: 'Create tasks and subtasks' },
  'tasks:update': { label: 'Update tasks', description: 'Change status, priority, tags, assignee' },
  'tasks:assign': { label: 'Assign tasks', description: 'Assign tasks to people (off by default)' },
  'comments:create': { label: 'Comment', description: 'Comment on tasks and documents' },
  'chat:read': { label: 'Read chat', description: 'Read project chat channels' },
  'chat:write': { label: 'Post to chat', description: 'Send messages in project chat' },
  'documents:read': { label: 'Read documents', description: 'Read documents (truncated - never env vars)' },
  'documents:write': { label: 'Write documents', description: 'Create and edit markdown notes + folder docs' },
  search: { label: 'Search', description: 'Global search across visible items' },
  'projects:read': { label: 'Read projects', description: 'Read project and member context' },
};

export function capabilityLabel(capability: AgentCapabilityValue): string {
  return AGENT_CAPABILITY_META[capability]?.label ?? capability;
}

export function capabilityDescription(capability: AgentCapabilityValue): string {
  return AGENT_CAPABILITY_META[capability]?.description ?? '';
}

export interface AgentStatusMeta {
  label: string;
  /** Semantic tone - success/warning/neutral per style guide 2.2. */
  tone: 'success' | 'warning' | 'neutral';
}

export const AGENT_STATUS_META: Record<AgentStatusValue, AgentStatusMeta> = {
  online: { label: 'Online', tone: 'success' },
  working: { label: 'Working', tone: 'warning' },
  offline: { label: 'Offline', tone: 'neutral' },
};

export interface AgentLogActionMeta {
  label: string;
}

export const AGENT_LOG_ACTION_META: Record<AgentLogActionValue, AgentLogActionMeta> = {
  run_started: { label: 'Run started' },
  run_completed: { label: 'Run completed' },
  task_created: { label: 'Task created' },
  task_updated: { label: 'Task updated' },
  comment_created: { label: 'Comment posted' },
  chat_message: { label: 'Chat message' },
  wake_sent: { label: 'Wake sent' },
  error: { label: 'Error' },
};

// ---------------------------------------------------------------- commands
// Command templates shown in the Launch Console / Connect card. The API key
// is only ever a placeholder here - the real key is shown once at creation.

export function buildInstallCommand(): string {
  return 'npm i -g .';
}

export function buildConnectCommand(agentId: string): string {
  return `teamshare-agent connect --agent ${agentId} --key ts_...`;
}

/** Ready command template - taskId is filled in when in task context. */
export function buildRunCommand(agentId: string, taskId?: string): string {
  const task = taskId ?? '<task-id>';
  return `teamshare-agent run --task ${task} --agent ${agentId} --key ts_...`;
}

export function buildDaemonCommand(): string {
  return 'teamshare-bridge daemon';
}

export function buildDaemonConfig(agentId: string): string {
  return JSON.stringify(
    {
      agents: [{ agentId, apiKey: 'ts_...' }],
      port: 48231,
      harness: 'auto',
      quietHours: null,
      wakeRules: { priorities: ['high', 'urgent'] },
    },
    null,
    2
  );
}

export function buildRegisterCommand(): string {
  return 'teamshare-bridge register';
}

export function buildMcpSnippet(): string {
  return JSON.stringify(
    {
      mcp: {
        teamshare: {
          type: 'remote',
          url: 'http://localhost:4000/mcp',
          headers: { 'X-Api-Key': 'ts_...' },
        },
      },
    },
    null,
    2
  );
}
