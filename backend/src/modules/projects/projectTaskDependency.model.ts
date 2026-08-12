import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export interface ProjectTaskDependencyAttributes {
  /** The task that is blocked. */
  taskId: string;
  /** The task that must reach 'done' before taskId can start. */
  dependsOnTaskId: string;
  createdAt?: Date;
}

export class ProjectTaskDependency extends Model<ProjectTaskDependencyAttributes> implements ProjectTaskDependencyAttributes {
  declare taskId: string;
  declare dependsOnTaskId: string;
  declare readonly createdAt: Date;
}

ProjectTaskDependency.init(
  {
    taskId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    dependsOnTaskId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
  },
  {
    sequelize,
    modelName: 'ProjectTaskDependency',
    tableName: 'project_task_dependencies',
    timestamps: true,
    updatedAt: false,
  }
);
