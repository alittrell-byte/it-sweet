import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export interface TicketTimeEntryAttributes {
  id: string;
  ticketId: number;
  technicianId: string;
  minutes: number;
  note: string | null;
  workDate: string;
  createdAt?: Date;
  updatedAt?: Date;
}

type TicketTimeEntryCreationAttributes = Optional<TicketTimeEntryAttributes, 'id' | 'note' | 'workDate' | 'createdAt' | 'updatedAt'>;

export class TicketTimeEntry
  extends Model<TicketTimeEntryAttributes, TicketTimeEntryCreationAttributes>
  implements TicketTimeEntryAttributes
{
  declare id: string;
  declare ticketId: number;
  declare technicianId: string;
  declare minutes: number;
  declare note: string | null;
  declare workDate: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

TicketTimeEntry.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    ticketId: { type: DataTypes.INTEGER, allowNull: false },
    technicianId: { type: DataTypes.UUID, allowNull: false },
    minutes: { type: DataTypes.INTEGER, allowNull: false },
    note: { type: DataTypes.TEXT, allowNull: true },
    workDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'TicketTimeEntry',
    tableName: 'ticket_time_entries',
    timestamps: true,
  }
);
