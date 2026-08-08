import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export interface KnowledgeBaseArticleAttachmentAttributes {
  id: string;
  articleId: string;
  uploadedById: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  createdAt?: Date;
  updatedAt?: Date;
}

type KnowledgeBaseArticleAttachmentCreationAttributes = Optional<
  KnowledgeBaseArticleAttachmentAttributes,
  'id' | 'createdAt' | 'updatedAt'
>;

// Same shape as TicketAttachment (backend/src/modules/tickets/ticketAttachment.model.ts) and
// reuses the same StorageProvider - embedded article images/files are stored identically to
// ticket attachments, just under a different owning entity.
export class KnowledgeBaseArticleAttachment
  extends Model<KnowledgeBaseArticleAttachmentAttributes, KnowledgeBaseArticleAttachmentCreationAttributes>
  implements KnowledgeBaseArticleAttachmentAttributes
{
  declare id: string;
  declare articleId: string;
  declare uploadedById: string;
  declare fileName: string;
  declare mimeType: string;
  declare sizeBytes: number;
  declare storageKey: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

KnowledgeBaseArticleAttachment.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    articleId: { type: DataTypes.UUID, allowNull: false },
    uploadedById: { type: DataTypes.UUID, allowNull: false },
    fileName: { type: DataTypes.STRING(255), allowNull: false },
    mimeType: { type: DataTypes.STRING(150), allowNull: false },
    sizeBytes: { type: DataTypes.INTEGER, allowNull: false },
    storageKey: { type: DataTypes.STRING(512), allowNull: false },
  },
  {
    sequelize,
    modelName: 'KnowledgeBaseArticleAttachment',
    tableName: 'knowledge_base_article_attachments',
    timestamps: true,
  }
);
