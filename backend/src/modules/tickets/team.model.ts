import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export interface TeamAttributes {
  id: string;
  name: string;
  description: string | null;
  /** Support tier this queue represents (e.g. 1 = frontline, 2 = specialist, 3 = engineering). */
  tier: number;
  /** Default target for the one-click "Escalate" action - typically the next tier up. */
  escalatesToTeamId: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type TeamCreationAttributes = Optional<TeamAttributes, 'id' | 'description' | 'tier' | 'escalatesToTeamId' | 'createdAt' | 'updatedAt'>;

export class Team extends Model<TeamAttributes, TeamCreationAttributes> implements TeamAttributes {
  declare id: string;
  declare name: string;
  declare description: string | null;
  declare tier: number;
  declare escalatesToTeamId: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Team.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(150), allowNull: false, unique: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    tier: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    escalatesToTeamId: { type: DataTypes.UUID, allowNull: true },
  },
  {
    sequelize,
    modelName: 'Team',
    tableName: 'teams',
    timestamps: true,
  }
);
