import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export type PatchPlatform = 'windows' | 'linux' | 'macos' | 'other';
export type PatchClassification = 'security' | 'critical' | 'feature' | 'other';
export type PatchSeverity = 'critical' | 'important' | 'moderate' | 'low';
export type PatchApprovalStatus = 'pending' | 'approved' | 'declined';

export interface PatchAttributes {
  id: string;
  platform: PatchPlatform;
  /** Vendor/package identifier, e.g. a Windows KB number or a Linux package+version string. */
  externalId: string;
  title: string;
  description: string | null;
  classification: PatchClassification;
  severity: PatchSeverity;
  /** JSON-encoded string[] of CVE identifiers, if any. */
  cveIds: string[] | null;
  releaseDate: string | null;
  /** Governance flag only - this app has no push mechanism to enforce it. */
  approvalStatus: PatchApprovalStatus;
  approvedById: string | null;
  approvedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type PatchCreationAttributes = Optional<
  PatchAttributes,
  'id' | 'description' | 'cveIds' | 'releaseDate' | 'approvalStatus' | 'approvedById' | 'approvedAt' | 'createdAt' | 'updatedAt'
>;

export class Patch extends Model<PatchAttributes, PatchCreationAttributes> implements PatchAttributes {
  declare id: string;
  declare platform: PatchPlatform;
  declare externalId: string;
  declare title: string;
  declare description: string | null;
  declare classification: PatchClassification;
  declare severity: PatchSeverity;
  declare cveIds: string[] | null;
  declare releaseDate: string | null;
  declare approvalStatus: PatchApprovalStatus;
  declare approvedById: string | null;
  declare approvedAt: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Patch.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    platform: {
      type: DataTypes.ENUM('windows', 'linux', 'macos', 'other'),
      allowNull: false,
    },
    externalId: { type: DataTypes.STRING(255), allowNull: false },
    title: { type: DataTypes.STRING(500), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    classification: {
      type: DataTypes.ENUM('security', 'critical', 'feature', 'other'),
      allowNull: false,
      defaultValue: 'other',
    },
    severity: {
      type: DataTypes.ENUM('critical', 'important', 'moderate', 'low'),
      allowNull: false,
      defaultValue: 'moderate',
    },
    // DataTypes.JSON (not JSONB) so this works identically on Postgres and MySQL.
    cveIds: { type: DataTypes.JSON, allowNull: true },
    releaseDate: { type: DataTypes.DATEONLY, allowNull: true },
    approvalStatus: {
      type: DataTypes.ENUM('pending', 'approved', 'declined'),
      allowNull: false,
      defaultValue: 'pending',
    },
    approvedById: { type: DataTypes.UUID, allowNull: true },
    approvedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: 'Patch',
    tableName: 'patches',
    timestamps: true,
  }
);
