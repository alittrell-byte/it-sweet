import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export type AssetType = 'hardware' | 'software_license' | 'peripheral';
export type AssetStatus = 'available' | 'in_use' | 'retired' | 'lost' | 'under_repair' | 'ordered';
export type DepreciationMethod = 'none' | 'straight_line';

export interface AssetAttributes {
  id: string;
  name: string;
  type: AssetType;
  status: AssetStatus;
  serialNumber: string | null;
  vendorId: string | null;
  purchaseDate: string | null;
  warrantyExpiry: string | null;
  /** Only meaningful for type=software_license; deployed count is derived from active assignments. */
  licenseSeatsPurchased: number | null;
  /** Original purchase price - used by depreciationMethod to compute current book value. */
  purchaseCost: number | null;
  depreciationMethod: DepreciationMethod;
  /** Straight-line write-off period. Only meaningful when depreciationMethod is not 'none'. */
  usefulLifeMonths: number | null;
  /** Edge-trigger state for the license-overage sweep - null once utilization is back at/under 100%. */
  licenseOverageAlertedAt: Date | null;
  /** Admin-defined key/value pairs beyond the common columns above - see AssetCustomFieldDefinition. */
  customFields: Record<string, string | number | boolean | null>;
  notes: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type AssetCreationAttributes = Optional<
  AssetAttributes,
  | 'id'
  | 'status'
  | 'serialNumber'
  | 'vendorId'
  | 'purchaseDate'
  | 'warrantyExpiry'
  | 'licenseSeatsPurchased'
  | 'purchaseCost'
  | 'depreciationMethod'
  | 'usefulLifeMonths'
  | 'licenseOverageAlertedAt'
  | 'customFields'
  | 'notes'
  | 'createdAt'
  | 'updatedAt'
>;

export class Asset extends Model<AssetAttributes, AssetCreationAttributes> implements AssetAttributes {
  declare id: string;
  declare name: string;
  declare type: AssetType;
  declare status: AssetStatus;
  declare serialNumber: string | null;
  declare vendorId: string | null;
  declare purchaseDate: string | null;
  declare warrantyExpiry: string | null;
  declare licenseSeatsPurchased: number | null;
  declare purchaseCost: number | null;
  declare depreciationMethod: DepreciationMethod;
  declare usefulLifeMonths: number | null;
  declare licenseOverageAlertedAt: Date | null;
  declare customFields: Record<string, string | number | boolean | null>;
  declare notes: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Asset.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(255), allowNull: false },
    type: {
      type: DataTypes.ENUM('hardware', 'software_license', 'peripheral'),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('available', 'in_use', 'retired', 'lost', 'under_repair', 'ordered'),
      allowNull: false,
      defaultValue: 'available',
    },
    serialNumber: { type: DataTypes.STRING(255), allowNull: true },
    vendorId: { type: DataTypes.UUID, allowNull: true },
    purchaseDate: { type: DataTypes.DATEONLY, allowNull: true },
    warrantyExpiry: { type: DataTypes.DATEONLY, allowNull: true },
    licenseSeatsPurchased: { type: DataTypes.INTEGER, allowNull: true },
    purchaseCost: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    depreciationMethod: {
      type: DataTypes.ENUM('none', 'straight_line'),
      allowNull: false,
      defaultValue: 'none',
    },
    usefulLifeMonths: { type: DataTypes.INTEGER, allowNull: true },
    licenseOverageAlertedAt: { type: DataTypes.DATE, allowNull: true },
    // DataTypes.JSON (not JSONB) so this works identically on Postgres and MySQL.
    customFields: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
    notes: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'Asset',
    tableName: 'assets',
    timestamps: true,
  }
);
