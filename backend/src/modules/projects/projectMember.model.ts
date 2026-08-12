import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export type ProjectMemberRole = 'lead' | 'contributor' | 'reviewer';

export interface ProjectMemberAttributes {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectMemberRole;
  createdAt?: Date;
  updatedAt?: Date;
}

type ProjectMemberCreationAttributes = Optional<ProjectMemberAttributes, 'id' | 'role' | 'createdAt' | 'updatedAt'>;

export class ProjectMember extends Model<ProjectMemberAttributes, ProjectMemberCreationAttributes> implements ProjectMemberAttributes {
  declare id: string;
  declare projectId: string;
  declare userId: string;
  declare role: ProjectMemberRole;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

ProjectMember.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    projectId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    role: {
      type: DataTypes.ENUM('lead', 'contributor', 'reviewer'),
      allowNull: false,
      defaultValue: 'contributor',
    },
  },
  { sequelize, modelName: 'ProjectMember', tableName: 'project_members', timestamps: true }
);
