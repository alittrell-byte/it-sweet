import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export interface TicketCommentAttributes {
  id: string;
  ticketId: number;
  authorId: string;
  body: string;
  isInternal: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

type TicketCommentCreationAttributes = Optional<TicketCommentAttributes, 'id' | 'isInternal' | 'createdAt' | 'updatedAt'>;

export class TicketComment
  extends Model<TicketCommentAttributes, TicketCommentCreationAttributes>
  implements TicketCommentAttributes
{
  declare id: string;
  declare ticketId: number;
  declare authorId: string;
  declare body: string;
  declare isInternal: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

TicketComment.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    ticketId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    authorId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    // Strict separation between public replies (false) and technician-only notes (true).
    // Every read path MUST filter this server-side for customer-role requests.
    isInternal: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    modelName: 'TicketComment',
    tableName: 'ticket_comments',
    timestamps: true,
  }
);
