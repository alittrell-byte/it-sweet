import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';
import { KnowledgeBaseSpace } from './article.model';

export interface KbArticleTemplateAttributes {
  id: string;
  name: string;
  titleTemplate: string;
  bodyTemplate: string;
  suggestedSpace: KnowledgeBaseSpace | null;
  suggestedCategoryId: string | null;
  isActive: boolean;
  createdById: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type KbArticleTemplateCreationAttributes = Optional<
  KbArticleTemplateAttributes,
  'id' | 'suggestedSpace' | 'suggestedCategoryId' | 'isActive' | 'createdById' | 'createdAt' | 'updatedAt'
>;

export class KbArticleTemplate
  extends Model<KbArticleTemplateAttributes, KbArticleTemplateCreationAttributes>
  implements KbArticleTemplateAttributes
{
  declare id: string;
  declare name: string;
  declare titleTemplate: string;
  declare bodyTemplate: string;
  declare suggestedSpace: KnowledgeBaseSpace | null;
  declare suggestedCategoryId: string | null;
  declare isActive: boolean;
  declare createdById: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

KbArticleTemplate.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(150), allowNull: false },
    titleTemplate: { type: DataTypes.STRING(255), allowNull: false },
    bodyTemplate: { type: DataTypes.TEXT, allowNull: false },
    suggestedSpace: { type: DataTypes.ENUM('internal', 'external'), allowNull: true },
    suggestedCategoryId: { type: DataTypes.UUID, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdById: { type: DataTypes.UUID, allowNull: true },
  },
  {
    sequelize,
    modelName: 'KbArticleTemplate',
    tableName: 'kb_article_templates',
    timestamps: true,
  }
);
