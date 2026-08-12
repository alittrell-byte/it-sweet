export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
export type ProjectPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ProjectTaskStatus = 'todo' | 'in_progress' | 'done';
export type ProjectMemberRole = 'lead' | 'contributor' | 'reviewer';

export const PROJECT_STATUSES: ProjectStatus[] = ['planning', 'active', 'on_hold', 'completed', 'cancelled'];
export const PROJECT_PRIORITIES: ProjectPriority[] = ['low', 'medium', 'high', 'urgent'];
export const PROJECT_TASK_STATUSES: ProjectTaskStatus[] = ['todo', 'in_progress', 'done'];
export const PROJECT_MEMBER_ROLES: ProjectMemberRole[] = ['lead', 'contributor', 'reviewer'];

export const PROJECT_TASK_STATUS_LABELS: Record<ProjectTaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
};

interface PublicUser {
  id: string;
  displayName: string;
  email: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  owner: PublicUser | null;
  status: ProjectStatus;
  priority: ProjectPriority;
  startDate: string | null;
  targetEndDate: string | null;
  actualEndDate: string | null;
  percentComplete: number;
  taskCount: number;
  ticketCount: number;
  openTicketCount: number;
  assetCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  id: string;
  role: ProjectMemberRole;
  user: PublicUser;
}

export interface ProjectLinkedTicket {
  id: number;
  subject: string;
  status: string;
  priority: string;
}

export interface ProjectLinkedAsset {
  id: string;
  name: string;
  type: string;
}

export interface ProjectDetail {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  owner: PublicUser | null;
  status: ProjectStatus;
  priority: ProjectPriority;
  startDate: string | null;
  targetEndDate: string | null;
  actualEndDate: string | null;
  percentComplete: number;
  taskCounts: { todo: number; inProgress: number; done: number };
  members: ProjectMember[];
  linkedTickets: ProjectLinkedTicket[];
  linkedAssets: ProjectLinkedAsset[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTask {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  assigneeId: string | null;
  assignee?: PublicUser | null;
  status: ProjectTaskStatus;
  dueDate: string | null;
  percentComplete: number;
  position: number;
  ticketId: number | null;
  createdAt: string;
  updatedAt: string;
}
