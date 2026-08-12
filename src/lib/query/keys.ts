export const queryKeys = {
  projects: ['projects'] as const,
  project: (id: string) => ['projects', id] as const,
  projectTasks: (projectId: string) => ['projects', projectId, 'tasks'] as const,
  projectMembers: (projectId: string) => ['projects', projectId, 'members'] as const,
  tasks: (params?: Record<string, unknown>) => ['tasks', params ?? {}] as const,
  task: (id: string) => ['tasks', id] as const,
  taskComments: (taskId: string) => ['tasks', taskId, 'comments'] as const,
  teams: ['teams'] as const,
  invitations: ['invitations'] as const,
  notifications: ['notifications'] as const,
  companies: ['companies'] as const,
};
