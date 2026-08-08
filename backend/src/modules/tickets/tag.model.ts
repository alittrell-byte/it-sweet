import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export interface TagAttributes {
  id: string;
  name: string;
  createdAt?: Date;
}

type TagCreationAttributes = Optional<TagAttributes, 'id' | 'createdAt'>;

export class Tag extends Model<TagAttributes, TagCreationAttributes> implements TagAttributes {
  declare id: string;
  declare name: string;
  declare readonly createdAt: Date;
}

Tag.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // Stored lowercase/trimmed at write time (see setTags in ticketService) so the unique
    // index prevents case-variant duplicates ("VPN" vs "vpn") from splitting a tag in two.
    name: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  },
  {
    sequelize,
    modelName: 'Tag',
    tableName: 'tags',
    timestamps: true,
    updatedAt: false,
  }
);
