import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export interface ProjectAssetLinkAttributes {
  projectId: string;
  assetId: string;
  createdAt?: Date;
}

export class ProjectAssetLink extends Model<ProjectAssetLinkAttributes> implements ProjectAssetLinkAttributes {
  declare projectId: string;
  declare assetId: string;
  declare readonly createdAt: Date;
}

ProjectAssetLink.init(
  {
    projectId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    assetId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
  },
  {
    sequelize,
    modelName: 'ProjectAssetLink',
    tableName: 'project_assets',
    timestamps: true,
    updatedAt: false,
  }
);
