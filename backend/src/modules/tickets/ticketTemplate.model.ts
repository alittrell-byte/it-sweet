import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';
import { TicketPriority } from './ticket.model';

export interface TicketTemplateAttributes {
  id: string;
  name: string;
  subjectTemplate: string;
  descriptionTemplate: string;
  category: string | null;
  priority: TicketPriority;
  isActive: boolean;
  createdById: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type TicketTemplateCreationAttributes = Optional<
  TicketTemplateAttributes,
  'id' | 'category' | 'priority' | 'isActive' | 'createdById' | 'createdAt' | 'updatedAt'
>;

export class TicketTemplate
  extends Model<TicketTemplateAttributes, TicketTemplateCreationAttributes>
  implements TicketTemplateAttributes
{
  declare id: string;
  declare name: string;
  declare subjectTemplate: string;
  declare descriptionTemplate: string;
  declare category: string | null;
  declare priority: TicketPriority;
  declare isActive: boolean;
  declare createdById: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

TicketTemplate.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(150), allowNull: false },
    subjectTemplate: { type: DataTypes.STRING(255), allowNull: false },
    descriptionTemplate: { type: DataTypes.TEXT, allowNull: false },
    category: { type: DataTypes.STRING(100), allowNull: true },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      allowNull: false,
      defaultValue: 'medium',
    },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdById: { type: DataTypes.UUID, allowNull: true },
  },
  {
    sequelize,
    modelName: 'TicketTemplate',
    tableName: 'ticket_templates',
    timestamps: true,
  }
);
