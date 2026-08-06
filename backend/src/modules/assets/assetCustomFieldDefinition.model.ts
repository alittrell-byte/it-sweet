import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export type CustomFieldType = 'text' | 'number' | 'date' | 'boolean';

export interface AssetCustomFieldDefinitionAttributes {
  id: string;
  key: string;
  label: string;
  fieldType: CustomFieldType;
  createdAt?: Date;
  updatedAt?: Date;
}

type AssetCustomFieldDefinitionCreationAttributes = Optional<
  AssetCustomFieldDefinitionAttributes,
  'id' | 'createdAt' | 'updatedAt'
>;

export class AssetCustomFieldDefinition
  extends Model<AssetCustomFieldDefinitionAttributes, AssetCustomFieldDefinitionCreationAttributes>
  implements AssetCustomFieldDefinitionAttributes
{
  declare id: string;
  declare key: string;
  declare label: string;
  declare fieldType: CustomFieldType;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

AssetCustomFieldDefinition.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // Machine key used inside Asset.customFields, e.g. "cost_center".
    key: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    label: { type: DataTypes.STRING(150), allowNull: false },
    fieldType: {
      type: DataTypes.ENUM('text', 'number', 'date', 'boolean'),
      allowNull: false,
      defaultValue: 'text',
    },
  },
  {
    sequelize,
    modelName: 'AssetCustomFieldDefinition',
    tableName: 'asset_custom_field_definitions',
    timestamps: true,
  }
);
