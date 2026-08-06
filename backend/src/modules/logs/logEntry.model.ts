import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export type LogSeverity = 'emergency' | 'alert' | 'critical' | 'error' | 'warning' | 'notice' | 'info' | 'debug';

export interface LogEntryAttributes {
  id: string;
  sourceId: string | null;
  host: string | null;
  severity: LogSeverity;
  message: string;
  raw: string | null;
  receivedAt: Date;
  metadata: Record<string, unknown>;
  createdAt?: Date;
}

type LogEntryCreationAttributes = Optional<
  LogEntryAttributes,
  'id' | 'sourceId' | 'host' | 'raw' | 'receivedAt' | 'metadata' | 'createdAt'
>;

export class LogEntry extends Model<LogEntryAttributes, LogEntryCreationAttributes> implements LogEntryAttributes {
  declare id: string;
  declare sourceId: string | null;
  declare host: string | null;
  declare severity: LogSeverity;
  declare message: string;
  declare raw: string | null;
  declare receivedAt: Date;
  declare metadata: Record<string, unknown>;
  declare readonly createdAt: Date;
}

LogEntry.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    sourceId: { type: DataTypes.UUID, allowNull: true },
    host: { type: DataTypes.STRING(255), allowNull: true },
    severity: {
      type: DataTypes.ENUM('emergency', 'alert', 'critical', 'error', 'warning', 'notice', 'info', 'debug'),
      allowNull: false,
      defaultValue: 'info',
    },
    message: { type: DataTypes.TEXT, allowNull: false },
    raw: { type: DataTypes.TEXT, allowNull: true },
    receivedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    metadata: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
  },
  {
    sequelize,
    modelName: 'LogEntry',
    tableName: 'log_entries',
    timestamps: true,
    updatedAt: false,
  }
);
