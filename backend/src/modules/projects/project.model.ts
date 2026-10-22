import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
export type ProjectPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface ProjectAttributes {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  startDate: string | null;
  targetEndDate: string | null;
  actualEndDate: string | null;
  /** Simple self-referencing hierarchy for multi-phase initiatives; null = top-level project. */
  parentProjectId: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type ProjectCreationAttributes = Optional<
  ProjectAttributes,
  | 'id'
  | 'description'
  | 'status'
  | 'priority'
  | 'startDate'
  | 'targetEndDate'
  | 'actualEndDate'
  | 'parentProjectId'
  | 'createdAt'
  | 'updatedAt'
>;

export class Project extends Model<ProjectAttributes, ProjectCreationAttributes> implements ProjectAttributes {
  declare id: string;
  declare name: string;
  declare description: string | null;
  declare ownerId: string;
  declare status: ProjectStatus;
  declare priority: ProjectPriority;
  declare startDate: string | null;
  declare targetEndDate: string | null;
  declare actualEndDate: string | null;
  declare parentProjectId: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Project.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    ownerId: { type: DataTypes.UUID, allowNull: false },
    status: {
      type: DataTypes.ENUM('planning', 'active', 'on_hold', 'completed', 'cancelled'),
      allowNull: false,
      defaultValue: 'planning',
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      allowNull: false,
      defaultValue: 'medium',
    },
    startDate: { type: DataTypes.DATEONLY, allowNull: true },
    targetEndDate: { type: DataTypes.DATEONLY, allowNull: true },
    actualEndDate: { type: DataTypes.DATEONLY, allowNull: true },
    parentProjectId: { type: DataTypes.UUID, allowNull: true },
  },
  { sequelize, modelName: 'Project', tableName: 'projects', timestamps: true }
);
