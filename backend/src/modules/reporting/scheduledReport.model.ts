import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export type ScheduledReportType =
  | 'ticket_dashboard'
  | 'license_compliance'
  | 'depreciation'
  | 'patch_compliance'
  | 'log_dashboard'
  | 'kb_feedback';

export type ScheduledReportCadence = 'daily' | 'weekly' | 'monthly';

export interface ScheduledReportAttributes {
  id: string;
  name: string;
  reportType: ScheduledReportType;
  cadence: ScheduledReportCadence;
  /** Required - a schedule with nowhere to send is pointless, unlike optional per-rule
   *  notification on the log alert rules. */
  notifyGroupId: string;
  lastSentAt: Date | null;
  isActive: boolean;
  createdById: string;
  createdAt?: Date;
  updatedAt?: Date;
}

type ScheduledReportCreationAttributes = Optional<
  ScheduledReportAttributes,
  'id' | 'lastSentAt' | 'isActive' | 'createdAt' | 'updatedAt'
>;

export class ScheduledReport
  extends Model<ScheduledReportAttributes, ScheduledReportCreationAttributes>
  implements ScheduledReportAttributes
{
  declare id: string;
  declare name: string;
  declare reportType: ScheduledReportType;
  declare cadence: ScheduledReportCadence;
  declare notifyGroupId: string;
  declare lastSentAt: Date | null;
  declare isActive: boolean;
  declare createdById: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

ScheduledReport.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(150), allowNull: false },
    reportType: {
      type: DataTypes.ENUM(
        'ticket_dashboard',
        'license_compliance',
        'depreciation',
        'patch_compliance',
        'log_dashboard',
        'kb_feedback'
      ),
      allowNull: false,
    },
    cadence: {
      type: DataTypes.ENUM('daily', 'weekly', 'monthly'),
      allowNull: false,
      defaultValue: 'weekly',
    },
    notifyGroupId: { type: DataTypes.UUID, allowNull: false },
    lastSentAt: { type: DataTypes.DATE, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdById: { type: DataTypes.UUID, allowNull: false },
  },
  {
    sequelize,
    modelName: 'ScheduledReport',
    tableName: 'scheduled_reports',
    timestamps: true,
  }
);
