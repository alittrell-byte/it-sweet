import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export type TicketStatus = 'new' | 'in_progress' | 'waiting' | 'pending_approval' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketApprovalStatus = 'none' | 'pending' | 'approved' | 'rejected';

export interface TicketAttributes {
  id: number;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string | null;
  requesterId: string;
  assigneeId: string | null;
  teamId: string | null;
  sourceTemplateId: string | null;
  requiresApproval: boolean;
  approvalStatus: TicketApprovalStatus;
  approvedById: string | null;
  approvedAt: Date | null;
  rejectedById: string | null;
  rejectedAt: Date | null;
  approvalReason: string | null;
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
  | 'teamId'
  | 'sourceTemplateId'
  | 'requiresApproval'
  | 'approvalStatus'
  | 'approvedById'
  | 'approvedAt'
  | 'rejectedById'
  | 'rejectedAt'
  | 'approvalReason'
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
  declare teamId: string | null;
  declare sourceTemplateId: string | null;
  declare requiresApproval: boolean;
  declare approvalStatus: TicketApprovalStatus;
  declare approvedById: string | null;
  declare approvedAt: Date | null;
  declare rejectedById: string | null;
  declare rejectedAt: Date | null;
  declare approvalReason: string | null;
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
      type: DataTypes.ENUM('new', 'in_progress', 'waiting', 'pending_approval', 'resolved', 'closed'),
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
    teamId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    sourceTemplateId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    requiresApproval: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    approvalStatus: {
      type: DataTypes.ENUM('none', 'pending', 'approved', 'rejected'),
      allowNull: false,
      defaultValue: 'none',
    },
    approvedById: { type: DataTypes.UUID, allowNull: true },
    approvedAt: { type: DataTypes.DATE, allowNull: true },
    rejectedById: { type: DataTypes.UUID, allowNull: true },
    rejectedAt: { type: DataTypes.DATE, allowNull: true },
    approvalReason: { type: DataTypes.TEXT, allowNull: true },
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
