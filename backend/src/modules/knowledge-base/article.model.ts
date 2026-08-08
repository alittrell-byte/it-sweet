import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export type KnowledgeBaseSpace = 'internal' | 'external';
export type KnowledgeBaseReviewStatus = 'none' | 'pending_review' | 'approved' | 'changes_requested';

export interface KnowledgeBaseArticleAttributes {
  id: string;
  title: string;
  space: KnowledgeBaseSpace;
  categoryId: string | null;
  /** Server-sanitized HTML from the WYSIWYG editor - see sanitizeArticleHtml.ts. */
  body: string;
  tags: string | null;
  isPublished: boolean;
  reviewStatus: KnowledgeBaseReviewStatus;
  submittedForReviewById: string | null;
  submittedForReviewAt: Date | null;
  reviewedById: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  createdById: string | null;
  updatedById: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type KnowledgeBaseArticleCreationAttributes = Optional<
  KnowledgeBaseArticleAttributes,
  | 'id'
  | 'categoryId'
  | 'tags'
  | 'isPublished'
  | 'reviewStatus'
  | 'submittedForReviewById'
  | 'submittedForReviewAt'
  | 'reviewedById'
  | 'reviewedAt'
  | 'reviewNote'
  | 'createdById'
  | 'updatedById'
  | 'createdAt'
  | 'updatedAt'
>;

export class KnowledgeBaseArticle
  extends Model<KnowledgeBaseArticleAttributes, KnowledgeBaseArticleCreationAttributes>
  implements KnowledgeBaseArticleAttributes
{
  declare id: string;
  declare title: string;
  declare space: KnowledgeBaseSpace;
  declare categoryId: string | null;
  declare body: string;
  declare tags: string | null;
  declare isPublished: boolean;
  declare reviewStatus: KnowledgeBaseReviewStatus;
  declare submittedForReviewById: string | null;
  declare submittedForReviewAt: Date | null;
  declare reviewedById: string | null;
  declare reviewedAt: Date | null;
  declare reviewNote: string | null;
  declare createdById: string | null;
  declare updatedById: string | null;
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
    space: {
      type: DataTypes.ENUM('internal', 'external'),
      allowNull: false,
      defaultValue: 'internal',
    },
    categoryId: { type: DataTypes.UUID, allowNull: true },
    body: { type: DataTypes.TEXT, allowNull: false },
    tags: { type: DataTypes.STRING(500), allowNull: true },
    isPublished: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    reviewStatus: {
      type: DataTypes.ENUM('none', 'pending_review', 'approved', 'changes_requested'),
      allowNull: false,
      defaultValue: 'none',
    },
    submittedForReviewById: { type: DataTypes.UUID, allowNull: true },
    submittedForReviewAt: { type: DataTypes.DATE, allowNull: true },
    reviewedById: { type: DataTypes.UUID, allowNull: true },
    reviewedAt: { type: DataTypes.DATE, allowNull: true },
    reviewNote: { type: DataTypes.TEXT, allowNull: true },
    createdById: { type: DataTypes.UUID, allowNull: true },
    updatedById: { type: DataTypes.UUID, allowNull: true },
  },
  {
    sequelize,
    modelName: 'KnowledgeBaseArticle',
    tableName: 'knowledge_base_articles',
    timestamps: true,
  }
);
