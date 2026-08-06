import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export interface TicketAssetAttributes {
  ticketId: number;
  assetId: string;
  createdAt?: Date;
}

export class TicketAsset extends Model<TicketAssetAttributes> implements TicketAssetAttributes {
  declare ticketId: number;
  declare assetId: string;
  declare readonly createdAt: Date;
}

TicketAsset.init(
  {
    ticketId: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
    assetId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
  },
  {
    sequelize,
    modelName: 'TicketAsset',
    tableName: 'ticket_assets',
    timestamps: true,
    updatedAt: false,
  }
);
