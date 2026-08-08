import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export interface VendorAttributes {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type VendorCreationAttributes = Optional<
  VendorAttributes,
  'id' | 'contactName' | 'contactEmail' | 'contactPhone' | 'notes' | 'createdAt' | 'updatedAt'
>;

export class Vendor extends Model<VendorAttributes, VendorCreationAttributes> implements VendorAttributes {
  declare id: string;
  declare name: string;
  declare contactName: string | null;
  declare contactEmail: string | null;
  declare contactPhone: string | null;
  declare notes: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Vendor.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    contactName: { type: DataTypes.STRING(255), allowNull: true },
    contactEmail: { type: DataTypes.STRING(255), allowNull: true },
    contactPhone: { type: DataTypes.STRING(50), allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'Vendor',
    tableName: 'vendors',
    timestamps: true,
  }
);
