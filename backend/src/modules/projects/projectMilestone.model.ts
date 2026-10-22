import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export interface ProjectMilestoneAttributes {
  id: string;
  projectId: string;
  name: string;
  dueDate: string | null;
  /** Edge-triggered, not a boolean - null means not complete, matches AssetAssignment.unassignedAt style. */
  completedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type ProjectMilestoneCreationAttributes = Optional<
  ProjectMilestoneAttributes,
  'id' | 'dueDate' | 'completedAt' | 'createdAt' | 'updatedAt'
>;

export class ProjectMilestone
  extends Model<ProjectMilestoneAttributes, ProjectMilestoneCreationAttributes>
  implements ProjectMilestoneAttributes
{
  declare id: string;
  declare projectId: string;
  declare name: string;
  declare dueDate: string | null;
  declare completedAt: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

ProjectMilestone.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    projectId: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING(200), allowNull: false },
    dueDate: { type: DataTypes.DATEONLY, allowNull: true },
    completedAt: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, modelName: 'ProjectMilestone', tableName: 'project_milestones', timestamps: true }
);
