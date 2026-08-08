import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export interface TicketSavedViewFilters {
  status?: string;
  assigneeId?: string;
  priority?: string;
  category?: string;
  teamId?: string;
  tag?: string;
}

export interface TicketSavedViewAttributes {
  id: string;
  userId: string;
  name: string;
  filters: TicketSavedViewFilters;
  createdAt?: Date;
  updatedAt?: Date;
}

type TicketSavedViewCreationAttributes = Optional<TicketSavedViewAttributes, 'id' | 'createdAt' | 'updatedAt'>;

export class TicketSavedView
  extends Model<TicketSavedViewAttributes, TicketSavedViewCreationAttributes>
  implements TicketSavedViewAttributes
{
  declare id: string;
  declare userId: string;
  declare name: string;
  declare filters: TicketSavedViewFilters;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

TicketSavedView.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false },
    // DataTypes.JSON (not JSONB) so this works identically on Postgres and MySQL.
    filters: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
  },
  {
    sequelize,
    modelName: 'TicketSavedView',
    tableName: 'ticket_saved_views',
    timestamps: true,
  }
);
