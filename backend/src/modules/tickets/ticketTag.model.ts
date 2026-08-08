import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export interface TicketTagAttributes {
  ticketId: number;
  tagId: string;
  createdAt?: Date;
}

export class TicketTag extends Model<TicketTagAttributes> implements TicketTagAttributes {
  declare ticketId: number;
  declare tagId: string;
  declare readonly createdAt: Date;
}

TicketTag.init(
  {
    ticketId: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
    tagId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
  },
  {
    sequelize,
    modelName: 'TicketTag',
    tableName: 'ticket_tags',
    timestamps: true,
    updatedAt: false,
  }
);
