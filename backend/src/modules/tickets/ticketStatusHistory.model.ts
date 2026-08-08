import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';
import { TicketStatus } from './ticket.model';

export interface TicketStatusHistoryAttributes {
  id: string;
  ticketId: number;
  fromStatus: TicketStatus | null;
  toStatus: TicketStatus;
  changedById: string;
  createdAt?: Date;
}

type TicketStatusHistoryCreationAttributes = Optional<TicketStatusHistoryAttributes, 'id' | 'fromStatus' | 'createdAt'>;

export class TicketStatusHistory
  extends Model<TicketStatusHistoryAttributes, TicketStatusHistoryCreationAttributes>
  implements TicketStatusHistoryAttributes
{
  declare id: string;
  declare ticketId: number;
  declare fromStatus: TicketStatus | null;
  declare toStatus: TicketStatus;
  declare changedById: string;
  declare readonly createdAt: Date;
}

TicketStatusHistory.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    ticketId: { type: DataTypes.INTEGER, allowNull: false },
    fromStatus: {
      type: DataTypes.ENUM('new', 'in_progress', 'waiting', 'pending_approval', 'resolved', 'closed'),
      allowNull: true,
    },
    toStatus: {
      type: DataTypes.ENUM('new', 'in_progress', 'waiting', 'pending_approval', 'resolved', 'closed'),
      allowNull: false,
    },
    changedById: { type: DataTypes.UUID, allowNull: false },
  },
  {
    sequelize,
    modelName: 'TicketStatusHistory',
    tableName: 'ticket_status_history',
    timestamps: true,
    updatedAt: false,
  }
);
