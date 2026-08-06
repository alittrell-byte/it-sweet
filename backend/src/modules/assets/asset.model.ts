import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export type AssetType = 'hardware' | 'software_license' | 'peripheral';
export type AssetStatus = 'available' | 'in_use' | 'retired' | 'lost' | 'under_repair';

export interface AssetAttributes {
  id: string;
  name: string;
  type: AssetType;
  status: AssetStatus;
  serialNumber: string | null;
  vendor: string | null;
  purchaseDate: string | null;
  warrantyExpiry: string | null;
  /** Only meaningful for type=software_license; deployed count is derived from active assignments. */
  licenseSeatsPurchased: number | null;
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
  | 'vendor'
  | 'purchaseDate'
  | 'warrantyExpiry'
  | 'licenseSeatsPurchased'
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
  declare vendor: string | null;
  declare purchaseDate: string | null;
  declare warrantyExpiry: string | null;
  declare licenseSeatsPurchased: number | null;
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
      type: DataTypes.ENUM('available', 'in_use', 'retired', 'lost', 'under_repair'),
      allowNull: false,
      defaultValue: 'available',
    },
    serialNumber: { type: DataTypes.STRING(255), allowNull: true },
    vendor: { type: DataTypes.STRING(255), allowNull: true },
    purchaseDate: { type: DataTypes.DATEONLY, allowNull: true },
    warrantyExpiry: { type: DataTypes.DATEONLY, allowNull: true },
    licenseSeatsPurchased: { type: DataTypes.INTEGER, allowNull: true },
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
