import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export interface TicketAttachmentAttributes {
  id: string;
  ticketId: number;
  commentId: string | null;
  uploadedById: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  createdAt?: Date;
  updatedAt?: Date;
}

type TicketAttachmentCreationAttributes = Optional<TicketAttachmentAttributes, 'id' | 'commentId' | 'createdAt' | 'updatedAt'>;

export class TicketAttachment
  extends Model<TicketAttachmentAttributes, TicketAttachmentCreationAttributes>
  implements TicketAttachmentAttributes
{
  declare id: string;
  declare ticketId: number;
  declare commentId: string | null;
  declare uploadedById: string;
  declare fileName: string;
  declare mimeType: string;
  declare sizeBytes: number;
  declare storageKey: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

TicketAttachment.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    ticketId: { type: DataTypes.INTEGER, allowNull: false },
    // Nullable: attachments can hang off the ticket itself, or off one specific comment/note.
    commentId: { type: DataTypes.UUID, allowNull: true },
    uploadedById: { type: DataTypes.UUID, allowNull: false },
    fileName: { type: DataTypes.STRING(255), allowNull: false },
    mimeType: { type: DataTypes.STRING(150), allowNull: false },
    sizeBytes: { type: DataTypes.INTEGER, allowNull: false },
    storageKey: { type: DataTypes.STRING(512), allowNull: false },
  },
  {
    sequelize,
    modelName: 'TicketAttachment',
    tableName: 'ticket_attachments',
    timestamps: true,
  }
);
