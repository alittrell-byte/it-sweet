import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export interface CannedResponseAttributes {
  id: string;
  title: string;
  body: string;
  createdById: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type CannedResponseCreationAttributes = Optional<CannedResponseAttributes, 'id' | 'createdById' | 'createdAt' | 'updatedAt'>;

export class CannedResponse
  extends Model<CannedResponseAttributes, CannedResponseCreationAttributes>
  implements CannedResponseAttributes
{
  declare id: string;
  declare title: string;
  declare body: string;
  declare createdById: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

CannedResponse.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: { type: DataTypes.STRING(150), allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: false },
    createdById: { type: DataTypes.UUID, allowNull: true },
  },
  {
    sequelize,
    modelName: 'CannedResponse',
    tableName: 'canned_responses',
    timestamps: true,
  }
);
