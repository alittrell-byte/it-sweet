import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export interface NotificationGroupAttributes {
  id: string;
  name: string;
  // Master on/off switch: admins can pause "new ticket" alerts to this group without deleting it or its members.
  notifyOnNewTicket: boolean;
  notifyOnLicenseOverage: boolean;
  notifyOnContractRenewal: boolean;
  notifyOnPatchOverdue: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

type NotificationGroupCreationAttributes = Optional<
  NotificationGroupAttributes,
  | 'id'
  | 'notifyOnNewTicket'
  | 'notifyOnLicenseOverage'
  | 'notifyOnContractRenewal'
  | 'notifyOnPatchOverdue'
  | 'createdAt'
  | 'updatedAt'
>;

export class NotificationGroup
  extends Model<NotificationGroupAttributes, NotificationGroupCreationAttributes>
  implements NotificationGroupAttributes
{
  declare id: string;
  declare name: string;
  declare notifyOnNewTicket: boolean;
  declare notifyOnLicenseOverage: boolean;
  declare notifyOnContractRenewal: boolean;
  declare notifyOnPatchOverdue: boolean;
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
    notifyOnLicenseOverage: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    notifyOnContractRenewal: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    notifyOnPatchOverdue: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    sequelize,
    modelName: 'NotificationGroup',
    tableName: 'notification_groups',
    timestamps: true,
  }
);
