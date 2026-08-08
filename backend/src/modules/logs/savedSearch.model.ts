import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export interface SavedSearchFilters {
  sourceId?: string;
  severity?: string;
  q?: string;
  from?: string;
  to?: string;
  metadataField?: string;
  metadataValue?: string;
}

export interface SavedSearchAttributes {
  id: string;
  userId: string;
  name: string;
  filters: SavedSearchFilters;
  createdAt?: Date;
}

type SavedSearchCreationAttributes = Optional<SavedSearchAttributes, 'id' | 'createdAt'>;

// Per-user, not shared/team-wide - simplest scope, no new sharing-permission model needed.
export class SavedSearch extends Model<SavedSearchAttributes, SavedSearchCreationAttributes> implements SavedSearchAttributes {
  declare id: string;
  declare userId: string;
  declare name: string;
  declare filters: SavedSearchFilters;
  declare readonly createdAt: Date;
}

SavedSearch.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING(150), allowNull: false },
    filters: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
  },
  {
    sequelize,
    modelName: 'SavedSearch',
    tableName: 'saved_searches',
    timestamps: true,
    updatedAt: false,
  }
);
