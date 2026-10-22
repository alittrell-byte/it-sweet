import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export interface ProjectTemplateTaskAttributes {
  id: string;
  templateId: string;
  title: string;
  description: string | null;
  /** "Due N days after the new project's start date" - templates have no absolute dates. */
  relativeDueDays: number | null;
  position: number;
  createdAt?: Date;
  updatedAt?: Date;
}

type ProjectTemplateTaskCreationAttributes = Optional<
  ProjectTemplateTaskAttributes,
  'id' | 'description' | 'relativeDueDays' | 'position' | 'createdAt' | 'updatedAt'
>;

export class ProjectTemplateTask
  extends Model<ProjectTemplateTaskAttributes, ProjectTemplateTaskCreationAttributes>
  implements ProjectTemplateTaskAttributes
{
  declare id: string;
  declare templateId: string;
  declare title: string;
  declare description: string | null;
  declare relativeDueDays: number | null;
  declare position: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

ProjectTemplateTask.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    templateId: { type: DataTypes.UUID, allowNull: false },
    title: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    relativeDueDays: { type: DataTypes.INTEGER, allowNull: true },
    position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  { sequelize, modelName: 'ProjectTemplateTask', tableName: 'project_template_tasks', timestamps: true }
);
