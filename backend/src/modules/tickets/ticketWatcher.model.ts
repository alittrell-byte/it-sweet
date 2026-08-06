import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export interface TicketWatcherAttributes {
  ticketId: number;
  userId: string;
  createdAt?: Date;
}

export class TicketWatcher extends Model<TicketWatcherAttributes> implements TicketWatcherAttributes {
  declare ticketId: number;
  declare userId: string;
  declare readonly createdAt: Date;
}

TicketWatcher.init(
  {
    ticketId: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
  },
  {
    sequelize,
    modelName: 'TicketWatcher',
    tableName: 'ticket_watchers',
    timestamps: true,
    updatedAt: false,
  }
);
