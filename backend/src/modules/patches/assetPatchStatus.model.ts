import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export type AssetPatchStatusValue = 'missing' | 'installed' | 'failed' | 'pending_reboot';

export interface AssetPatchStatusAttributes {
  id: string;
  assetId: string;
  patchId: string;
  status: AssetPatchStatusValue;
  /** Stamped on every agent scan regardless of status - "when did we last hear from this
   *  device", not "how long has this patch been missing". Use missingSinceAt for the latter. */
  lastCheckedAt: Date;
  installedAt: Date | null;
  failureReason: string | null;
  /** Set once when status first transitions to 'missing', left alone on subsequent scans that
   *  still report 'missing' (unlike lastCheckedAt), cleared once no longer missing. This is what
   *  the overdue-SLA sweep actually measures against. */
  missingSinceAt: Date | null;
  /** Edge-trigger state for the overdue-patch sweep - null once no longer missing (installed, or
   *  the patch is declined) so a future re-breach can alert again. */
  overdueAlertedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type AssetPatchStatusCreationAttributes = Optional<
  AssetPatchStatusAttributes,
  'id' | 'installedAt' | 'failureReason' | 'missingSinceAt' | 'overdueAlertedAt' | 'createdAt' | 'updatedAt'
>;

// Current state only (one row per asset+patch, upserted on every agent scan) - not an audit
// trail. A history/event log is a reasonable future addition, not a day-one requirement (mirrors
// how AssetHistory itself was added to Assets in a later P1 pass, not the initial build).
export class AssetPatchStatus
  extends Model<AssetPatchStatusAttributes, AssetPatchStatusCreationAttributes>
  implements AssetPatchStatusAttributes
{
  declare id: string;
  declare assetId: string;
  declare patchId: string;
  declare status: AssetPatchStatusValue;
  declare lastCheckedAt: Date;
  declare installedAt: Date | null;
  declare failureReason: string | null;
  declare missingSinceAt: Date | null;
  declare overdueAlertedAt: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

AssetPatchStatus.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    assetId: { type: DataTypes.UUID, allowNull: false },
    patchId: { type: DataTypes.UUID, allowNull: false },
    status: {
      type: DataTypes.ENUM('missing', 'installed', 'failed', 'pending_reboot'),
      allowNull: false,
    },
    lastCheckedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    installedAt: { type: DataTypes.DATE, allowNull: true },
    failureReason: { type: DataTypes.TEXT, allowNull: true },
    missingSinceAt: { type: DataTypes.DATE, allowNull: true },
    overdueAlertedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: 'AssetPatchStatus',
    tableName: 'asset_patch_statuses',
    timestamps: true,
  }
);
