import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export type AssignedToType = 'user' | 'location' | 'department';

export interface AssetAssignmentAttributes {
  id: string;
  assetId: string;
  assignedToType: AssignedToType;
  assignedToUserId: string | null;
  assignedToLabel: string | null;
  assignedAt: Date;
  /** Null means this is the currently-active assignment for the asset. */
  unassignedAt: Date | null;
  /** Set for loaner check-outs; drives "overdue" reporting. */
  dueBackAt: Date | null;
  assignedById: string;
  notes: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type AssetAssignmentCreationAttributes = Optional<
  AssetAssignmentAttributes,
  'id' | 'assignedAt' | 'unassignedAt' | 'dueBackAt' | 'assignedToUserId' | 'assignedToLabel' | 'notes' | 'createdAt' | 'updatedAt'
>;

export class AssetAssignment
  extends Model<AssetAssignmentAttributes, AssetAssignmentCreationAttributes>
  implements AssetAssignmentAttributes
{
  declare id: string;
  declare assetId: string;
  declare assignedToType: AssignedToType;
  declare assignedToUserId: string | null;
  declare assignedToLabel: string | null;
  declare assignedAt: Date;
  declare unassignedAt: Date | null;
  declare dueBackAt: Date | null;
  declare assignedById: string;
  declare notes: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

AssetAssignment.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    assetId: { type: DataTypes.UUID, allowNull: false },
    assignedToType: {
      type: DataTypes.ENUM('user', 'location', 'department'),
      allowNull: false,
    },
    assignedToUserId: { type: DataTypes.UUID, allowNull: true },
    assignedToLabel: { type: DataTypes.STRING(255), allowNull: true },
    assignedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    unassignedAt: { type: DataTypes.DATE, allowNull: true },
    dueBackAt: { type: DataTypes.DATE, allowNull: true },
    assignedById: { type: DataTypes.UUID, allowNull: false },
    notes: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'AssetAssignment',
    tableName: 'asset_assignments',
    timestamps: true,
  }
);
