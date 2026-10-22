import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ProjectAttachment,
  ProjectDetail,
  ProjectMember,
  ProjectMemberRole,
  ProjectMilestone,
  ProjectPriority,
  ProjectStatus,
  ProjectSummary,
  ProjectTask,
  ProjectTaskStatus,
  ProjectTemplate,
  ProjectTemplateTask,
} from '../../../core/models/project.model';
import { Ticket } from '../../../core/models/ticket.model';

export interface ProjectListFilter {
  status?: ProjectStatus;
  priority?: ProjectPriority;
  involvesUserId?: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string | null;
  ownerId: string;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  startDate?: string | null;
  targetEndDate?: string | null;
  actualEndDate?: string | null;
  parentProjectId?: string | null;
  templateId?: string;
}

export type UpdateProjectInput = Partial<Omit<CreateProjectInput, 'templateId'>>;

export interface CreateMilestoneInput {
  name: string;
  dueDate?: string | null;
}

export type UpdateMilestoneInput = Partial<CreateMilestoneInput> & { completed?: boolean };

export interface CreateTemplateInput {
  name: string;
  description?: string | null;
}

export type UpdateTemplateInput = Partial<CreateTemplateInput>;

export interface CreateTemplateTaskInput {
  title: string;
  description?: string | null;
  relativeDueDays?: number | null;
}

export type UpdateTemplateTaskInput = Partial<CreateTemplateTaskInput>;

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  assigneeId?: string | null;
  status?: ProjectTaskStatus;
  dueDate?: string | null;
  percentComplete?: number;
}

export type UpdateTaskInput = Partial<CreateTaskInput>;

export interface MoveTaskInput {
  status: ProjectTaskStatus;
  position: number;
}

@Injectable({ providedIn: 'root' })
export class ProjectService {
  constructor(private readonly http: HttpClient) {}

  listProjects(filter: ProjectListFilter = {}): Promise<ProjectSummary[]> {
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(filter)) {
      if (value) params[key] = String(value);
    }
    return firstValueFrom(this.http.get<ProjectSummary[]>('/api/projects', { params }));
  }

  getProject(id: string): Promise<ProjectDetail> {
    return firstValueFrom(this.http.get<ProjectDetail>(`/api/projects/${id}`));
  }

  createProject(input: CreateProjectInput): Promise<ProjectSummary> {
    return firstValueFrom(this.http.post<ProjectSummary>('/api/projects', input));
  }

  updateProject(id: string, input: UpdateProjectInput): Promise<ProjectSummary> {
    return firstValueFrom(this.http.patch<ProjectSummary>(`/api/projects/${id}`, input));
  }

  deleteProject(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/projects/${id}`));
  }

  addMember(projectId: string, userId: string, role?: ProjectMemberRole): Promise<ProjectMember> {
    return firstValueFrom(this.http.post<ProjectMember>(`/api/projects/${projectId}/members`, { userId, role }));
  }

  updateMemberRole(projectId: string, memberId: string, role: ProjectMemberRole): Promise<ProjectMember> {
    return firstValueFrom(this.http.patch<ProjectMember>(`/api/projects/${projectId}/members/${memberId}`, { role }));
  }

  removeMember(projectId: string, memberId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/projects/${projectId}/members/${memberId}`));
  }

  linkTicket(projectId: string, ticketId: number): Promise<void> {
    return firstValueFrom(this.http.post<void>(`/api/projects/${projectId}/tickets`, { ticketId }));
  }

  unlinkTicket(projectId: string, ticketId: number): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/projects/${projectId}/tickets/${ticketId}`));
  }

  linkAsset(projectId: string, assetId: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`/api/projects/${projectId}/assets`, { assetId }));
  }

  unlinkAsset(projectId: string, assetId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/projects/${projectId}/assets/${assetId}`));
  }

  listTasks(projectId: string): Promise<ProjectTask[]> {
    return firstValueFrom(this.http.get<ProjectTask[]>(`/api/projects/${projectId}/tasks`));
  }

  createTask(projectId: string, input: CreateTaskInput): Promise<ProjectTask> {
    return firstValueFrom(this.http.post<ProjectTask>(`/api/projects/${projectId}/tasks`, input));
  }

  updateTask(projectId: string, taskId: string, input: UpdateTaskInput): Promise<ProjectTask> {
    return firstValueFrom(this.http.patch<ProjectTask>(`/api/projects/${projectId}/tasks/${taskId}`, input));
  }

  deleteTask(projectId: string, taskId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/projects/${projectId}/tasks/${taskId}`));
  }

  moveTask(projectId: string, taskId: string, input: MoveTaskInput): Promise<ProjectTask> {
    return firstValueFrom(this.http.post<ProjectTask>(`/api/projects/${projectId}/tasks/${taskId}/move`, input));
  }

  listDependencies(projectId: string, taskId: string): Promise<ProjectTask[]> {
    return firstValueFrom(this.http.get<ProjectTask[]>(`/api/projects/${projectId}/tasks/${taskId}/dependencies`));
  }

  addDependency(projectId: string, taskId: string, dependsOnTaskId: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(`/api/projects/${projectId}/tasks/${taskId}/dependencies`, { dependsOnTaskId })
    );
  }

  removeDependency(projectId: string, taskId: string, dependsOnTaskId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`/api/projects/${projectId}/tasks/${taskId}/dependencies/${dependsOnTaskId}`)
    );
  }

  spawnTicketFromTask(projectId: string, taskId: string): Promise<Ticket> {
    return firstValueFrom(this.http.post<Ticket>(`/api/projects/${projectId}/tasks/${taskId}/spawn-ticket`, {}));
  }

  linkExistingTicketToTask(projectId: string, taskId: string, ticketId: number): Promise<ProjectTask> {
    return firstValueFrom(
      this.http.post<ProjectTask>(`/api/projects/${projectId}/tasks/${taskId}/link-ticket`, { ticketId })
    );
  }

  unlinkTicketFromTask(projectId: string, taskId: string): Promise<ProjectTask> {
    return firstValueFrom(this.http.delete<ProjectTask>(`/api/projects/${projectId}/tasks/${taskId}/link-ticket`));
  }

  // --- Attachments ---

  listAttachments(projectId: string): Promise<ProjectAttachment[]> {
    return firstValueFrom(this.http.get<ProjectAttachment[]>(`/api/projects/${projectId}/attachments`));
  }

  uploadAttachment(projectId: string, file: File): Promise<ProjectAttachment> {
    const form = new FormData();
    form.append('file', file);
    return firstValueFrom(this.http.post<ProjectAttachment>(`/api/projects/${projectId}/attachments`, form));
  }

  attachmentDownloadUrl(projectId: string, attachmentId: string): string {
    return `/api/projects/${projectId}/attachments/${attachmentId}`;
  }

  deleteAttachment(projectId: string, attachmentId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/projects/${projectId}/attachments/${attachmentId}`));
  }

  // --- Milestones ---

  listMilestones(projectId: string): Promise<ProjectMilestone[]> {
    return firstValueFrom(this.http.get<ProjectMilestone[]>(`/api/projects/${projectId}/milestones`));
  }

  createMilestone(projectId: string, input: CreateMilestoneInput): Promise<ProjectMilestone> {
    return firstValueFrom(this.http.post<ProjectMilestone>(`/api/projects/${projectId}/milestones`, input));
  }

  updateMilestone(projectId: string, milestoneId: string, input: UpdateMilestoneInput): Promise<ProjectMilestone> {
    return firstValueFrom(this.http.patch<ProjectMilestone>(`/api/projects/${projectId}/milestones/${milestoneId}`, input));
  }

  deleteMilestone(projectId: string, milestoneId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/projects/${projectId}/milestones/${milestoneId}`));
  }

  // --- Templates ---

  listTemplates(): Promise<ProjectTemplate[]> {
    return firstValueFrom(this.http.get<ProjectTemplate[]>('/api/projects/templates'));
  }

  getTemplate(templateId: string): Promise<ProjectTemplate> {
    return firstValueFrom(this.http.get<ProjectTemplate>(`/api/projects/templates/${templateId}`));
  }

  createTemplate(input: CreateTemplateInput): Promise<ProjectTemplate> {
    return firstValueFrom(this.http.post<ProjectTemplate>('/api/projects/templates', input));
  }

  updateTemplate(templateId: string, input: UpdateTemplateInput): Promise<ProjectTemplate> {
    return firstValueFrom(this.http.patch<ProjectTemplate>(`/api/projects/templates/${templateId}`, input));
  }

  deleteTemplate(templateId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/projects/templates/${templateId}`));
  }

  addTemplateTask(templateId: string, input: CreateTemplateTaskInput): Promise<ProjectTemplateTask> {
    return firstValueFrom(this.http.post<ProjectTemplateTask>(`/api/projects/templates/${templateId}/tasks`, input));
  }

  updateTemplateTask(templateId: string, taskId: string, input: UpdateTemplateTaskInput): Promise<ProjectTemplateTask> {
    return firstValueFrom(this.http.patch<ProjectTemplateTask>(`/api/projects/templates/${templateId}/tasks/${taskId}`, input));
  }

  deleteTemplateTask(templateId: string, taskId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/projects/templates/${templateId}/tasks/${taskId}`));
  }
}
