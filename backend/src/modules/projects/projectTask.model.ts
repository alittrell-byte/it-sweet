import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export type ProjectTaskStatus = 'todo' | 'in_progress' | 'done';

export interface ProjectTaskAttributes {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  assigneeId: string | null;
  status: ProjectTaskStatus;
  dueDate: string | null;
  percentComplete: number;
  /** Ordering within its status column on the board - unique per (projectId, status), not globally. */
  position: number;
  /** The ticket this task spawned, or an existing ticket linked to it. At most one. */
  ticketId: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type ProjectTaskCreationAttributes = Optional<
  ProjectTaskAttributes,
  | 'id'
  | 'description'
  | 'assigneeId'
  | 'status'
  | 'dueDate'
  | 'percentComplete'
  | 'position'
  | 'ticketId'
  | 'createdAt'
  | 'updatedAt'
>;

export class ProjectTask extends Model<ProjectTaskAttributes, ProjectTaskCreationAttributes> implements ProjectTaskAttributes {
  declare id: string;
  declare projectId: string;
  declare title: string;
  declare description: string | null;
  declare assigneeId: string | null;
  declare status: ProjectTaskStatus;
  declare dueDate: string | null;
  declare percentComplete: number;
  declare position: number;
  declare ticketId: number | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

ProjectTask.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    projectId: { type: DataTypes.UUID, allowNull: false },
    title: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    assigneeId: { type: DataTypes.UUID, allowNull: true },
    status: {
      type: DataTypes.ENUM('todo', 'in_progress', 'done'),
      allowNull: false,
      defaultValue: 'todo',
    },
    dueDate: { type: DataTypes.DATEONLY, allowNull: true },
    percentComplete: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    ticketId: { type: DataTypes.INTEGER, allowNull: true },
  },
  { sequelize, modelName: 'ProjectTask', tableName: 'project_tasks', timestamps: true }
);
