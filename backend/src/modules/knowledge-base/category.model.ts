import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export interface KnowledgeBaseCategoryAttributes {
  id: string;
  name: string;
  parentId: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type KnowledgeBaseCategoryCreationAttributes = Optional<
  KnowledgeBaseCategoryAttributes,
  'id' | 'parentId' | 'createdAt' | 'updatedAt'
>;

export class KnowledgeBaseCategory
  extends Model<KnowledgeBaseCategoryAttributes, KnowledgeBaseCategoryCreationAttributes>
  implements KnowledgeBaseCategoryAttributes
{
  declare id: string;
  declare name: string;
  declare parentId: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

KnowledgeBaseCategory.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(150), allowNull: false },
    // Simple self-referencing tree; null = top-level category.
    parentId: { type: DataTypes.UUID, allowNull: true },
  },
  {
    sequelize,
    modelName: 'KnowledgeBaseCategory',
    tableName: 'knowledge_base_categories',
    timestamps: true,
  }
);
