import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export type ContractType = 'support' | 'maintenance' | 'license' | 'other';

export interface ContractAttributes {
  id: string;
  vendorId: string;
  /** Optional - a contract can cover one specific asset, or be vendor-level/general. */
  assetId: string | null;
  type: ContractType;
  startDate: string | null;
  endDate: string | null;
  cost: number | null;
  autoRenew: boolean;
  notes: string | null;
  /** Edge-trigger state for the renewal-reminder sweep - null once endDate is no longer within the reminder window. */
  renewalAlertedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type ContractCreationAttributes = Optional<
  ContractAttributes,
  'id' | 'assetId' | 'startDate' | 'endDate' | 'cost' | 'autoRenew' | 'notes' | 'renewalAlertedAt' | 'createdAt' | 'updatedAt'
>;

export class Contract extends Model<ContractAttributes, ContractCreationAttributes> implements ContractAttributes {
  declare id: string;
  declare vendorId: string;
  declare assetId: string | null;
  declare type: ContractType;
  declare startDate: string | null;
  declare endDate: string | null;
  declare cost: number | null;
  declare autoRenew: boolean;
  declare notes: string | null;
  declare renewalAlertedAt: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Contract.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    vendorId: { type: DataTypes.UUID, allowNull: false },
    assetId: { type: DataTypes.UUID, allowNull: true },
    type: {
      type: DataTypes.ENUM('support', 'maintenance', 'license', 'other'),
      allowNull: false,
      defaultValue: 'other',
    },
    startDate: { type: DataTypes.DATEONLY, allowNull: true },
    endDate: { type: DataTypes.DATEONLY, allowNull: true },
    cost: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    autoRenew: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    notes: { type: DataTypes.TEXT, allowNull: true },
    renewalAlertedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: 'Contract',
    tableName: 'contracts',
    timestamps: true,
  }
);
