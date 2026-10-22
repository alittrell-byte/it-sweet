import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export interface ProjectAttachmentAttributes {
  id: string;
  projectId: string;
  uploadedById: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  createdAt?: Date;
  updatedAt?: Date;
}

type ProjectAttachmentCreationAttributes = Optional<ProjectAttachmentAttributes, 'id' | 'uploadedById' | 'createdAt' | 'updatedAt'>;

export class ProjectAttachment
  extends Model<ProjectAttachmentAttributes, ProjectAttachmentCreationAttributes>
  implements ProjectAttachmentAttributes
{
  declare id: string;
  declare projectId: string;
  declare uploadedById: string | null;
  declare fileName: string;
  declare mimeType: string;
  declare sizeBytes: number;
  declare storageKey: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

ProjectAttachment.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    projectId: { type: DataTypes.UUID, allowNull: false },
    uploadedById: { type: DataTypes.UUID, allowNull: true },
    fileName: { type: DataTypes.STRING(255), allowNull: false },
    mimeType: { type: DataTypes.STRING(150), allowNull: false },
    sizeBytes: { type: DataTypes.INTEGER, allowNull: false },
    storageKey: { type: DataTypes.STRING(512), allowNull: false },
  },
  { sequelize, modelName: 'ProjectAttachment', tableName: 'project_attachments', timestamps: true }
);
