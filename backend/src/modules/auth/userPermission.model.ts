import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export interface UserPermissionAttributes {
  userId: string;
  permissionKey: string;
  createdAt?: Date;
}

export class UserPermission extends Model<UserPermissionAttributes> implements UserPermissionAttributes {
  declare userId: string;
  declare permissionKey: string;
  declare readonly createdAt: Date;
}

UserPermission.init(
  {
    userId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    permissionKey: { type: DataTypes.STRING(100), allowNull: false, primaryKey: true },
  },
  {
    sequelize,
    modelName: 'UserPermission',
    tableName: 'user_permissions',
    timestamps: true,
    updatedAt: false,
  }
);
