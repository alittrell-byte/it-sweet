import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export interface KbArticleFeedbackAttributes {
  id: string;
  articleId: string;
  userId: string;
  helpful: boolean;
  comment: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type KbArticleFeedbackCreationAttributes = Optional<KbArticleFeedbackAttributes, 'id' | 'comment' | 'createdAt' | 'updatedAt'>;

export class KbArticleFeedback
  extends Model<KbArticleFeedbackAttributes, KbArticleFeedbackCreationAttributes>
  implements KbArticleFeedbackAttributes
{
  declare id: string;
  declare articleId: string;
  declare userId: string;
  declare helpful: boolean;
  declare comment: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

KbArticleFeedback.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    articleId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    helpful: { type: DataTypes.BOOLEAN, allowNull: false },
    comment: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'KbArticleFeedback',
    tableName: 'kb_article_feedback',
    timestamps: true,
    indexes: [{ unique: true, fields: ['article_id', 'user_id'] }],
  }
);
