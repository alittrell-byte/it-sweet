import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';
import { LogSeverity } from './logEntry.model';

export interface AlertRuleAttributes {
  id: string;
  name: string;
  sourceId: string | null;
  pattern: string;
  severityFilter: LogSeverity | null;
  thresholdCount: number;
  thresholdWindowMinutes: number;
  /** JSON-encoded string[] of email addresses; kept as a string column for portability. */
  notifyEmails: string | null;
  /** Alternative/additional to notifyEmails - routes through the app's shared NotificationGroup
   *  membership like every other alerting path (assets, tickets), rather than free-typed emails
   *  being the only option. A rule can use either, both, or neither. */
  notifyGroupId: string | null;
  /** When set (a metadata field name, e.g. "sourceIp"), matches within the window are grouped by
   *  that field's value and the rule fires if any single group meets thresholdCount - this is
   *  what makes "N events from the SAME ip/user/etc" expressible, vs. just a raw total count. */
  groupByMetadataField: string | null;
  webhookUrl: string | null;
  createTicket: boolean;
  isActive: boolean;
  createdById: string;
  createdAt?: Date;
  updatedAt?: Date;
}

type AlertRuleCreationAttributes = Optional<
  AlertRuleAttributes,
  | 'id'
  | 'sourceId'
  | 'severityFilter'
  | 'notifyEmails'
  | 'notifyGroupId'
  | 'groupByMetadataField'
  | 'webhookUrl'
  | 'createTicket'
  | 'isActive'
  | 'createdAt'
  | 'updatedAt'
>;

export class AlertRule extends Model<AlertRuleAttributes, AlertRuleCreationAttributes> implements AlertRuleAttributes {
  declare id: string;
  declare name: string;
  declare sourceId: string | null;
  declare pattern: string;
  declare severityFilter: LogSeverity | null;
  declare thresholdCount: number;
  declare thresholdWindowMinutes: number;
  declare notifyEmails: string | null;
  declare notifyGroupId: string | null;
  declare groupByMetadataField: string | null;
  declare webhookUrl: string | null;
  declare createTicket: boolean;
  declare isActive: boolean;
  declare createdById: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

AlertRule.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(150), allowNull: false },
    sourceId: { type: DataTypes.UUID, allowNull: true },
    pattern: { type: DataTypes.STRING(500), allowNull: false },
    severityFilter: {
      type: DataTypes.ENUM('emergency', 'alert', 'critical', 'error', 'warning', 'notice', 'info', 'debug'),
      allowNull: true,
    },
    thresholdCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    thresholdWindowMinutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5 },
    notifyEmails: { type: DataTypes.STRING(1000), allowNull: true },
    notifyGroupId: { type: DataTypes.UUID, allowNull: true },
    groupByMetadataField: { type: DataTypes.STRING(100), allowNull: true },
    webhookUrl: { type: DataTypes.STRING(1000), allowNull: true },
    createTicket: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdById: { type: DataTypes.UUID, allowNull: false },
  },
  {
    sequelize,
    modelName: 'AlertRule',
    tableName: 'alert_rules',
    timestamps: true,
  }
);
