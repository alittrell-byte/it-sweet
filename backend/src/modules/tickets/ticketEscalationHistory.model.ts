import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export interface TicketEscalationHistoryAttributes {
  id: string;
  ticketId: number;
  fromTeamId: string | null;
  toTeamId: string;
  escalatedById: string;
  reason: string | null;
  createdAt?: Date;
}

type TicketEscalationHistoryCreationAttributes = Optional<TicketEscalationHistoryAttributes, 'id' | 'fromTeamId' | 'reason' | 'createdAt'>;

export class TicketEscalationHistory
  extends Model<TicketEscalationHistoryAttributes, TicketEscalationHistoryCreationAttributes>
  implements TicketEscalationHistoryAttributes
{
  declare id: string;
  declare ticketId: number;
  declare fromTeamId: string | null;
  declare toTeamId: string;
  declare escalatedById: string;
  declare reason: string | null;
  declare readonly createdAt: Date;
}

TicketEscalationHistory.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    ticketId: { type: DataTypes.INTEGER, allowNull: false },
    fromTeamId: { type: DataTypes.UUID, allowNull: true },
    toTeamId: { type: DataTypes.UUID, allowNull: false },
    escalatedById: { type: DataTypes.UUID, allowNull: false },
    reason: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'TicketEscalationHistory',
    tableName: 'ticket_escalation_history',
    timestamps: true,
    updatedAt: false,
  }
);
