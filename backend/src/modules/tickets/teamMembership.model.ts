import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../db/sequelize';

export interface TeamMembershipAttributes {
  teamId: string;
  userId: string;
  createdAt?: Date;
}

export class TeamMembership extends Model<TeamMembershipAttributes> implements TeamMembershipAttributes {
  declare teamId: string;
  declare userId: string;
  declare readonly createdAt: Date;
}

TeamMembership.init(
  {
    teamId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
  },
  {
    sequelize,
    modelName: 'TeamMembership',
    tableName: 'team_memberships',
    timestamps: true,
    updatedAt: false,
  }
);
