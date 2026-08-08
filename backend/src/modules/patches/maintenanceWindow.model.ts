import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export type MaintenanceWindowRecurrence = 'once' | 'weekly' | 'monthly';

export interface MaintenanceWindowAttributes {
  id: string;
  name: string;
  /** Loose display/filter tag ("which team owns this window") - not a strict device-membership
   *  mechanism. This app has no device-group primitive yet; scoping precision is a known
   *  simplification since nothing here actually enforces install timing anyway. */
  teamId: string | null;
  startsAt: Date;
  endsAt: Date;
  recurrence: MaintenanceWindowRecurrence;
  notes: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type MaintenanceWindowCreationAttributes = Optional<
  MaintenanceWindowAttributes,
  'id' | 'teamId' | 'recurrence' | 'notes' | 'createdAt' | 'updatedAt'
>;

export class MaintenanceWindow
  extends Model<MaintenanceWindowAttributes, MaintenanceWindowCreationAttributes>
  implements MaintenanceWindowAttributes
{
  declare id: string;
  declare name: string;
  declare teamId: string | null;
  declare startsAt: Date;
  declare endsAt: Date;
  declare recurrence: MaintenanceWindowRecurrence;
  declare notes: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

MaintenanceWindow.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(150), allowNull: false },
    teamId: { type: DataTypes.UUID, allowNull: true },
    startsAt: { type: DataTypes.DATE, allowNull: false },
    endsAt: { type: DataTypes.DATE, allowNull: false },
    recurrence: {
      type: DataTypes.ENUM('once', 'weekly', 'monthly'),
      allowNull: false,
      defaultValue: 'once',
    },
    notes: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'MaintenanceWindow',
    tableName: 'maintenance_windows',
    timestamps: true,
  }
);
