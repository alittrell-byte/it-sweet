import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export interface TicketSatisfactionSurveyAttributes {
  id: string;
  ticketId: number;
  rating: number | null;
  comment: string | null;
  submittedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type TicketSatisfactionSurveyCreationAttributes = Optional<
  TicketSatisfactionSurveyAttributes,
  'id' | 'rating' | 'comment' | 'submittedAt' | 'createdAt' | 'updatedAt'
>;

export class TicketSatisfactionSurvey
  extends Model<TicketSatisfactionSurveyAttributes, TicketSatisfactionSurveyCreationAttributes>
  implements TicketSatisfactionSurveyAttributes
{
  declare id: string;
  declare ticketId: number;
  declare rating: number | null;
  declare comment: string | null;
  declare submittedAt: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

TicketSatisfactionSurvey.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    ticketId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    rating: { type: DataTypes.INTEGER, allowNull: true },
    comment: { type: DataTypes.TEXT, allowNull: true },
    submittedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: 'TicketSatisfactionSurvey',
    tableName: 'ticket_satisfaction_surveys',
    timestamps: true,
  }
);
