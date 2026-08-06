import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export interface AlertEventAttributes {
  id: string;
  ruleId: string;
  triggeredAt: Date;
  matchCount: number;
  sampleMessage: string;
  resolvedTicketId: number | null;
  createdAt?: Date;
}

type AlertEventCreationAttributes = Optional<AlertEventAttributes, 'id' | 'triggeredAt' | 'resolvedTicketId' | 'createdAt'>;

export class AlertEvent extends Model<AlertEventAttributes, AlertEventCreationAttributes> implements AlertEventAttributes {
  declare id: string;
  declare ruleId: string;
  declare triggeredAt: Date;
  declare matchCount: number;
  declare sampleMessage: string;
  declare resolvedTicketId: number | null;
  declare readonly createdAt: Date;
}

AlertEvent.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    ruleId: { type: DataTypes.UUID, allowNull: false },
    triggeredAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    matchCount: { type: DataTypes.INTEGER, allowNull: false },
    sampleMessage: { type: DataTypes.TEXT, allowNull: false },
    resolvedTicketId: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    sequelize,
    modelName: 'AlertEvent',
    tableName: 'alert_events',
    timestamps: true,
    updatedAt: false,
  }
);
