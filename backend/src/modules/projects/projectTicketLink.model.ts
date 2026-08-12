import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../db/sequelize';

/** Single source of truth for "which tickets does this project touch" - task-spawned/linked
 * tickets are upserted here too, so project-level rollups never need to UNION across sources. */
export interface ProjectTicketLinkAttributes {
  projectId: string;
  ticketId: number;
  createdAt?: Date;
}

export class ProjectTicketLink extends Model<ProjectTicketLinkAttributes> implements ProjectTicketLinkAttributes {
  declare projectId: string;
  declare ticketId: number;
  declare readonly createdAt: Date;
}

ProjectTicketLink.init(
  {
    projectId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    ticketId: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
  },
  {
    sequelize,
    modelName: 'ProjectTicketLink',
    tableName: 'project_tickets',
    timestamps: true,
    updatedAt: false,
  }
);
