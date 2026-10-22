import { NotFoundError } from '../../common/errors';
import { PUBLIC_USER_ATTRIBUTES, User } from '../auth/user.model';
import { ProjectTemplate } from './projectTemplate.model';
import { ProjectTemplateTask } from './projectTemplateTask.model';

const TEMPLATE_INCLUDES = [
  { model: User, as: 'createdBy', attributes: [...PUBLIC_USER_ATTRIBUTES] },
  { model: ProjectTemplateTask, as: 'tasks' },
];

export interface CreateTemplateInput {
  name: string;
  description?: string | null;
}

export type UpdateTemplateInput = Partial<CreateTemplateInput>;

export function listTemplates(): Promise<ProjectTemplate[]> {
  return ProjectTemplate.findAll({ order: [['name', 'ASC']], include: TEMPLATE_INCLUDES });
}

export async function getTemplate(id: string): Promise<ProjectTemplate> {
  const template = await ProjectTemplate.findByPk(id, { include: TEMPLATE_INCLUDES });
  if (!template) throw new NotFoundError('Project template not found');
  return template;
}

export function createTemplate(input: CreateTemplateInput, createdById: string): Promise<ProjectTemplate> {
  return ProjectTemplate.create({ name: input.name, description: input.description ?? null, createdById });
}

export async function updateTemplate(id: string, input: UpdateTemplateInput): Promise<ProjectTemplate> {
  const template = await ProjectTemplate.findByPk(id);
  if (!template) throw new NotFoundError('Project template not found');
  await template.update(input);
  return template;
}

export async function deleteTemplate(id: string): Promise<void> {
  const template = await ProjectTemplate.findByPk(id);
  if (!template) throw new NotFoundError('Project template not found');
  await template.destroy();
}

// --- Template tasks ---

export interface CreateTemplateTaskInput {
  title: string;
  description?: string | null;
  relativeDueDays?: number | null;
}

export type UpdateTemplateTaskInput = Partial<CreateTemplateTaskInput>;

async function findTemplateOrThrow(templateId: string): Promise<ProjectTemplate> {
  const template = await ProjectTemplate.findByPk(templateId);
  if (!template) throw new NotFoundError('Project template not found');
  return template;
}

export async function addTemplateTask(templateId: string, input: CreateTemplateTaskInput): Promise<ProjectTemplateTask> {
  await findTemplateOrThrow(templateId);
  const position = await ProjectTemplateTask.count({ where: { templateId } });
  return ProjectTemplateTask.create({
    templateId,
    title: input.title,
    description: input.description ?? null,
    relativeDueDays: input.relativeDueDays ?? null,
    position,
  });
}

export async function updateTemplateTask(
  templateId: string,
  taskId: string,
  input: UpdateTemplateTaskInput
): Promise<ProjectTemplateTask> {
  const task = await ProjectTemplateTask.findOne({ where: { id: taskId, templateId } });
  if (!task) throw new NotFoundError('Template task not found');
  await task.update(input);
  return task;
}

export async function deleteTemplateTask(templateId: string, taskId: string): Promise<void> {
  const task = await ProjectTemplateTask.findOne({ where: { id: taskId, templateId } });
  if (!task) throw new NotFoundError('Template task not found');
  await task.destroy();
}
