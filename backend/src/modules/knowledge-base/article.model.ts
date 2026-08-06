import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

// Minimal KB model to support "suggest articles while creating a ticket" in Module 1.
// Full authoring/versioning/permission-scoping lands with Module 5 (IT Documentation / KB).
export interface KnowledgeBaseArticleAttributes {
  id: string;
  title: string;
  body: string;
  tags: string | null;
  createdById: string | null;
  isPublished: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

type KnowledgeBaseArticleCreationAttributes = Optional<
  KnowledgeBaseArticleAttributes,
  'id' | 'tags' | 'createdById' | 'isPublished' | 'createdAt' | 'updatedAt'
>;

export class KnowledgeBaseArticle
  extends Model<KnowledgeBaseArticleAttributes, KnowledgeBaseArticleCreationAttributes>
  implements KnowledgeBaseArticleAttributes
{
  declare id: string;
  declare title: string;
  declare body: string;
  declare tags: string | null;
  declare createdById: string | null;
  declare isPublished: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

KnowledgeBaseArticle.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: { type: DataTypes.STRING(255), allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: false },
    tags: { type: DataTypes.STRING(500), allowNull: true },
    createdById: { type: DataTypes.UUID, allowNull: true },
    isPublished: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    sequelize,
    modelName: 'KnowledgeBaseArticle',
    tableName: 'knowledge_base_articles',
    timestamps: true,
  }
);
