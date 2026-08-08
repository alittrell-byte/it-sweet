import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/sequelize';
import { TicketPriority } from './ticket.model';

export type RecurrenceType = 'daily' | 'weekly' | 'monthly';

export interface RecurrenceRule {
  type: RecurrenceType;
  /** 0 (Sunday) - 6 (Saturday). Required and only meaningful when type === 'weekly'. */
  dayOfWeek?: number;
  /** 1-31. Required and only meaningful when type === 'monthly'. Clamped to the month's last day. */
  dayOfMonth?: number;
}

export interface RecurringTicketTemplateAttributes {
  id: string;
  name: string;
  subjectTemplate: string;
  descriptionTemplate: string;
  category: string | null;
  priority: TicketPriority;
  assigneeId: string | null;
  recurrenceRule: RecurrenceRule;
  isActive: boolean;
  nextRunAt: Date;
  lastRunAt: Date | null;
  createdById: string;
  createdAt?: Date;
  updatedAt?: Date;
}

type RecurringTicketTemplateCreationAttributes = Optional<
  RecurringTicketTemplateAttributes,
  'id' | 'category' | 'priority' | 'assigneeId' | 'isActive' | 'lastRunAt' | 'createdAt' | 'updatedAt'
>;

export class RecurringTicketTemplate
  extends Model<RecurringTicketTemplateAttributes, RecurringTicketTemplateCreationAttributes>
  implements RecurringTicketTemplateAttributes
{
  declare id: string;
  declare name: string;
  declare subjectTemplate: string;
  declare descriptionTemplate: string;
  declare category: string | null;
  declare priority: TicketPriority;
  declare assigneeId: string | null;
  declare recurrenceRule: RecurrenceRule;
  declare isActive: boolean;
  declare nextRunAt: Date;
  declare lastRunAt: Date | null;
  declare createdById: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

RecurringTicketTemplate.init(
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
    assigneeId: { type: DataTypes.UUID, allowNull: true },
    recurrenceRule: { type: DataTypes.JSON, allowNull: false },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    nextRunAt: { type: DataTypes.DATE, allowNull: false },
    lastRunAt: { type: DataTypes.DATE, allowNull: true },
    createdById: { type: DataTypes.UUID, allowNull: false },
  },
  {
    sequelize,
    modelName: 'RecurringTicketTemplate',
    tableName: 'recurring_ticket_templates',
    timestamps: true,
  }
);
