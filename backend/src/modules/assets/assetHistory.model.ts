import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export type AssetHistoryAction = 'created' | 'updated' | 'deleted' | 'received';

export interface AssetFieldChange {
  from: unknown;
  to: unknown;
}

export interface AssetHistoryAttributes {
  id: string;
  /**
   * Deliberately a plain UUID column with no FK constraint (same pattern as
   * AssetAssignment.assetId) so the audit trail survives deletion of the asset it describes -
   * an audit log that vanishes along with the thing it audited defeats its own purpose.
   */
  assetId: string;
  changedById: string;
  action: AssetHistoryAction;
  /** Null for 'created'/'deleted'/'received'; {field: {from, to}} for 'updated'. */
  changes: Record<string, AssetFieldChange> | null;
  createdAt?: Date;
}

type AssetHistoryCreationAttributes = Optional<AssetHistoryAttributes, 'id' | 'changes' | 'createdAt'>;

export class AssetHistory extends Model<AssetHistoryAttributes, AssetHistoryCreationAttributes> implements AssetHistoryAttributes {
  declare id: string;
  declare assetId: string;
  declare changedById: string;
  declare action: AssetHistoryAction;
  declare changes: Record<string, AssetFieldChange> | null;
  declare readonly createdAt: Date;
}

AssetHistory.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    assetId: { type: DataTypes.UUID, allowNull: false },
    changedById: { type: DataTypes.UUID, allowNull: false },
    action: {
      type: DataTypes.ENUM('created', 'updated', 'deleted', 'received'),
      allowNull: false,
    },
    changes: { type: DataTypes.JSON, allowNull: true },
  },
  {
    sequelize,
    modelName: 'AssetHistory',
    tableName: 'asset_history',
    timestamps: true,
    updatedAt: false,
  }
);
