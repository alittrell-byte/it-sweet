import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export type LogSourceType = 'syslog' | 'http' | 'internal';

export interface LogSourceAttributes {
  id: string;
  name: string;
  type: LogSourceType;
  /** SHA-256 of the ingest API key (see common/apiKeys.ts). The key itself is never stored. */
  apiKeyHash: string;
  /** Null falls back to the global LogRetentionSetting default. */
  retentionDays: number | null;
  /** Null = visible to anyone with logs.view (today's default). Set = additionally requires
   *  membership on this Team, or the logs.view_all_sources bypass permission. */
  restrictedToTeamId: string | null;
  /** Optional correlation to the asset this source is running on/monitoring. */
  assetId: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type LogSourceCreationAttributes = Optional<
  LogSourceAttributes,
  'id' | 'retentionDays' | 'restrictedToTeamId' | 'assetId' | 'createdAt' | 'updatedAt'
>;

export class LogSource extends Model<LogSourceAttributes, LogSourceCreationAttributes> implements LogSourceAttributes {
  declare id: string;
  declare name: string;
  declare type: LogSourceType;
  declare apiKeyHash: string;
  declare retentionDays: number | null;
  declare restrictedToTeamId: string | null;
  declare assetId: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  // Sources are returned straight from routes via res.json(); keep the hash out of every response.
  toJSON(): Omit<LogSourceAttributes, 'apiKeyHash'> {
    const { apiKeyHash: _omitted, ...rest } = this.get() as LogSourceAttributes;
    return rest;
  }
}

LogSource.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(150), allowNull: false, unique: true },
    type: {
      type: DataTypes.ENUM('syslog', 'http', 'internal'),
      allowNull: false,
      defaultValue: 'http',
    },
    apiKeyHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    retentionDays: { type: DataTypes.INTEGER, allowNull: true },
    restrictedToTeamId: { type: DataTypes.UUID, allowNull: true },
    assetId: { type: DataTypes.UUID, allowNull: true },
  },
  {
    sequelize,
    modelName: 'LogSource',
    tableName: 'log_sources',
    timestamps: true,
  }
);
