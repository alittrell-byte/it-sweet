import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';
import { KnowledgeBaseSpace } from './article.model';

export interface KnowledgeBaseArticleRevisionAttributes {
  id: string;
  articleId: string;
  title: string;
  body: string;
  space: KnowledgeBaseSpace;
  categoryId: string | null;
  editedById: string;
  createdAt?: Date;
}

type KnowledgeBaseArticleRevisionCreationAttributes = Optional<
  KnowledgeBaseArticleRevisionAttributes,
  'id' | 'categoryId' | 'createdAt'
>;

// Full-snapshot versioning: one row per save (see articleService.updateArticle) rather than a
// diff, since diffing rich HTML cleanly isn't worth the complexity at this scale, and a full
// snapshot makes "restore" trivial and unambiguous.
export class KnowledgeBaseArticleRevision
  extends Model<KnowledgeBaseArticleRevisionAttributes, KnowledgeBaseArticleRevisionCreationAttributes>
  implements KnowledgeBaseArticleRevisionAttributes
{
  declare id: string;
  declare articleId: string;
  declare title: string;
  declare body: string;
  declare space: KnowledgeBaseSpace;
  declare categoryId: string | null;
  declare editedById: string;
  declare readonly createdAt: Date;
}

KnowledgeBaseArticleRevision.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    articleId: { type: DataTypes.UUID, allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: false },
    space: { type: DataTypes.ENUM('internal', 'external'), allowNull: false },
    categoryId: { type: DataTypes.UUID, allowNull: true },
    editedById: { type: DataTypes.UUID, allowNull: false },
  },
  {
    sequelize,
    modelName: 'KnowledgeBaseArticleRevision',
    tableName: 'knowledge_base_article_revisions',
    timestamps: true,
    updatedAt: false,
  }
);
