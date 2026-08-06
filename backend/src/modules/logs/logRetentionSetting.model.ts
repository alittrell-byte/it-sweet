import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export interface LogRetentionSettingAttributes {
  id: number;
  defaultRetentionDays: number;
  updatedAt?: Date;
}

// Single-row table (id is always 1) holding the global default retention. Per-source
// overrides live on LogSource.retentionDays; this is the fallback when a source doesn't
// set one. Kept editable via API/UI rather than an env var, since trimming needs to be
// an admin-configurable knob, not a deploy-time constant.
export class LogRetentionSetting extends Model<LogRetentionSettingAttributes> implements LogRetentionSettingAttributes {
  declare id: number;
  declare defaultRetentionDays: number;
  declare readonly updatedAt: Date;
}

LogRetentionSetting.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    defaultRetentionDays: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30 },
  },
  {
    sequelize,
    modelName: 'LogRetentionSetting',
    tableName: 'log_retention_settings',
    timestamps: true,
    createdAt: false,
  }
);
