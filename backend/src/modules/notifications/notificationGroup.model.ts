import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export interface NotificationGroupAttributes {
  id: string;
  name: string;
  // Master on/off switch: admins can pause "new ticket" alerts to this group without deleting it or its members.
  notifyOnNewTicket: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

type NotificationGroupCreationAttributes = Optional<
  NotificationGroupAttributes,
  'id' | 'notifyOnNewTicket' | 'createdAt' | 'updatedAt'
>;

export class NotificationGroup
  extends Model<NotificationGroupAttributes, NotificationGroupCreationAttributes>
  implements NotificationGroupAttributes
{
  declare id: string;
  declare name: string;
  declare notifyOnNewTicket: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

NotificationGroup.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(150), allowNull: false, unique: true },
    notifyOnNewTicket: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    sequelize,
    modelName: 'NotificationGroup',
    tableName: 'notification_groups',
    timestamps: true,
  }
);
