import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export type TicketStatus = 'new' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TicketAttributes {
  id: number;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string | null;
  requesterId: string;
  assigneeId: string | null;
  responseDueAt: Date | null;
  resolutionDueAt: Date | null;
  firstRespondedAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type TicketCreationAttributes = Optional<
  TicketAttributes,
  | 'id'
  | 'status'
  | 'category'
  | 'assigneeId'
  | 'responseDueAt'
  | 'resolutionDueAt'
  | 'firstRespondedAt'
  | 'resolvedAt'
  | 'closedAt'
  | 'createdAt'
  | 'updatedAt'
>;

export class Ticket extends Model<TicketAttributes, TicketCreationAttributes> implements TicketAttributes {
  declare id: number;
  declare subject: string;
  declare description: string;
  declare status: TicketStatus;
  declare priority: TicketPriority;
  declare category: string | null;
  declare requesterId: string;
  declare assigneeId: string | null;
  declare responseDueAt: Date | null;
  declare resolutionDueAt: Date | null;
  declare firstRespondedAt: Date | null;
  declare resolvedAt: Date | null;
  declare closedAt: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Ticket.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    subject: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('new', 'in_progress', 'waiting', 'resolved', 'closed'),
      allowNull: false,
      defaultValue: 'new',
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      allowNull: false,
      defaultValue: 'medium',
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    requesterId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    assigneeId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    responseDueAt: { type: DataTypes.DATE, allowNull: true },
    resolutionDueAt: { type: DataTypes.DATE, allowNull: true },
    firstRespondedAt: { type: DataTypes.DATE, allowNull: true },
    resolvedAt: { type: DataTypes.DATE, allowNull: true },
    closedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: 'Ticket',
    tableName: 'tickets',
    timestamps: true,
  }
);
