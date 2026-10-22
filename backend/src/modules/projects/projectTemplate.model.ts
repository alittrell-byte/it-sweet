import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export interface ProjectTemplateAttributes {
  id: string;
  name: string;
  description: string | null;
  createdById: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type ProjectTemplateCreationAttributes = Optional<ProjectTemplateAttributes, 'id' | 'description' | 'createdById' | 'createdAt' | 'updatedAt'>;

export class ProjectTemplate
  extends Model<ProjectTemplateAttributes, ProjectTemplateCreationAttributes>
  implements ProjectTemplateAttributes
{
  declare id: string;
  declare name: string;
  declare description: string | null;
  declare createdById: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

ProjectTemplate.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    createdById: { type: DataTypes.UUID, allowNull: true },
  },
  { sequelize, modelName: 'ProjectTemplate', tableName: 'project_templates', timestamps: true }
);
