import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export interface PatchAgentKeyAttributes {
  id: string;
  /** One key per asset - the agent script authenticates as "this specific device". */
  assetId: string;
  apiKey: string;
  createdAt?: Date;
  updatedAt?: Date;
}

type PatchAgentKeyCreationAttributes = Optional<PatchAgentKeyAttributes, 'id' | 'createdAt' | 'updatedAt'>;

// Mirrors LogSource.apiKey / logIngestService.generateApiKey exactly - a lightweight per-device
// script (PowerShell Get-HotFix, apt list --upgradable, etc.) authenticates with this key
// instead of a user session.
export class PatchAgentKey
  extends Model<PatchAgentKeyAttributes, PatchAgentKeyCreationAttributes>
  implements PatchAgentKeyAttributes
{
  declare id: string;
  declare assetId: string;
  declare apiKey: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

PatchAgentKey.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    assetId: { type: DataTypes.UUID, allowNull: false, unique: true },
    apiKey: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  },
  {
    sequelize,
    modelName: 'PatchAgentKey',
    tableName: 'patch_agent_keys',
    timestamps: true,
  }
);
