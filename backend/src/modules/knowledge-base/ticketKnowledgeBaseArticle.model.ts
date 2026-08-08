import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export interface TicketKnowledgeBaseArticleAttributes {
  ticketId: number;
  articleId: string;
  createdAt?: Date;
}

// Join table for "attach this article as a canned solution" - same shape as TicketAsset
// (backend/src/modules/assets/ticketAsset.model.ts).
export class TicketKnowledgeBaseArticle
  extends Model<TicketKnowledgeBaseArticleAttributes>
  implements TicketKnowledgeBaseArticleAttributes
{
  declare ticketId: number;
  declare articleId: string;
  declare readonly createdAt: Date;
}

TicketKnowledgeBaseArticle.init(
  {
    ticketId: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
    articleId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
  },
  {
    sequelize,
    modelName: 'TicketKnowledgeBaseArticle',
    tableName: 'ticket_kb_articles',
    timestamps: true,
    updatedAt: false,
  }
);
