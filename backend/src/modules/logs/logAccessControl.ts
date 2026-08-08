import { Op } from 'sequelize';
import { AccessTokenPayload } from '../auth/authService';
import { TeamMembership } from '../tickets/teamMembership.model';
import { LogSource } from './logSource.model';

export type VisibleSources = 'all' | string[];

// A source is visible if it's unrestricted (restrictedToTeamId is null) or the actor belongs to
// the restricting team - reuses the Team/TeamMembership models already built for Ticketing P1
// rather than inventing a new RBAC primitive. logs.view_all_sources bypasses this entirely, for
// admins/security roles that need full cross-team visibility.
export async function getVisibleSourceIds(actor: AccessTokenPayload): Promise<VisibleSources> {
  if (actor.permissions.includes('logs.view_all_sources')) return 'all';

  const memberships = await TeamMembership.findAll({ where: { userId: actor.sub } });
  const teamIds = memberships.map((m) => m.teamId);

  const visible = await LogSource.findAll({
    where:
      teamIds.length > 0
        ? { [Op.or]: [{ restrictedToTeamId: null }, { restrictedToTeamId: { [Op.in]: teamIds } }] }
        : { restrictedToTeamId: null },
    attributes: ['id'],
  });
  return visible.map((s) => s.id);
}
