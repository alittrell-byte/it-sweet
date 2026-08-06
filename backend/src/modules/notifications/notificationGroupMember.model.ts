import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export interface NotificationGroupMemberAttributes {
  groupId: string;
  userId: string;
  createdAt?: Date;
}

export class NotificationGroupMember
  extends Model<NotificationGroupMemberAttributes>
  implements NotificationGroupMemberAttributes
{
  declare groupId: string;
  declare userId: string;
  declare readonly createdAt: Date;
}

NotificationGroupMember.init(
  {
    groupId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
  },
  {
    sequelize,
    modelName: 'NotificationGroupMember',
    tableName: 'notification_group_members',
    timestamps: true,
    updatedAt: false,
  }
);
