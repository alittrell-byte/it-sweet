import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ProjectDetail,
  ProjectMember,
  ProjectMemberRole,
  ProjectPriority,
  ProjectStatus,
  ProjectSummary,
  ProjectTask,
  ProjectTaskStatus,
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
}

export type UpdateProjectInput = Partial<CreateProjectInput>;

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
}
