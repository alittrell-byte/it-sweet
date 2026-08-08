import { BadRequestError, NotFoundError } from '../../common/errors';
import { PUBLIC_USER_ATTRIBUTES, User } from '../auth/user.model';
import { Team } from './team.model';
import { TeamMembership } from './teamMembership.model';

const TEAM_INCLUDES = [
  { model: Team, as: 'escalatesTo' },
  { model: User, as: 'members', attributes: [...PUBLIC_USER_ATTRIBUTES], through: { attributes: [] } },
];

export function listTeams(): Promise<Team[]> {
  return Team.findAll({ order: [['tier', 'ASC'], ['name', 'ASC']], include: TEAM_INCLUDES });
}

export async function getTeam(teamId: string): Promise<Team> {
  const team = await Team.findByPk(teamId, { include: TEAM_INCLUDES });
  if (!team) throw new NotFoundError('Team not found');
  return team;
}

export interface TeamInput {
  name: string;
  description?: string;
  tier?: number;
  escalatesToTeamId?: string | null;
}

export async function createTeam(input: TeamInput): Promise<Team> {
  if (input.escalatesToTeamId && !(await Team.findByPk(input.escalatesToTeamId))) {
    throw new BadRequestError('Escalation target team not found');
  }
  const team = await Team.create({
    name: input.name,
    description: input.description ?? null,
    tier: input.tier ?? 1,
    escalatesToTeamId: input.escalatesToTeamId ?? null,
  });
  return getTeam(team.id);
}

export async function updateTeam(teamId: string, input: Partial<TeamInput>): Promise<Team> {
  const team = await Team.findByPk(teamId);
  if (!team) throw new NotFoundError('Team not found');
  if (input.escalatesToTeamId) {
    if (input.escalatesToTeamId === teamId) throw new BadRequestError('A team cannot escalate to itself');
    if (!(await Team.findByPk(input.escalatesToTeamId))) throw new BadRequestError('Escalation target team not found');
  }
  await team.update(input);
  return getTeam(teamId);
}

export async function deleteTeam(teamId: string): Promise<void> {
  const team = await Team.findByPk(teamId);
  if (!team) throw new NotFoundError('Team not found');
  await team.destroy();
}

export async function addMember(teamId: string, userId: string): Promise<void> {
  if (!(await Team.findByPk(teamId))) throw new NotFoundError('Team not found');
  const user = await User.findByPk(userId);
  if (!user || user.role === 'customer') throw new BadRequestError('Member must be an active technician or admin');
  await TeamMembership.findOrCreate({ where: { teamId, userId } });
}

export async function removeMember(teamId: string, userId: string): Promise<void> {
  await TeamMembership.destroy({ where: { teamId, userId } });
}
