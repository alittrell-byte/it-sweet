import { ForbiddenError, NotFoundError } from '../../common/errors';
import { AccessTokenPayload } from '../auth/authService';
import { TicketSavedView, TicketSavedViewFilters } from './ticketSavedView.model';

export function listSavedViews(actor: AccessTokenPayload): Promise<TicketSavedView[]> {
  return TicketSavedView.findAll({ where: { userId: actor.sub }, order: [['name', 'ASC']] });
}

export function createSavedView(name: string, filters: TicketSavedViewFilters, actor: AccessTokenPayload): Promise<TicketSavedView> {
  return TicketSavedView.create({ userId: actor.sub, name, filters });
}

export async function deleteSavedView(viewId: string, actor: AccessTokenPayload): Promise<void> {
  const view = await TicketSavedView.findByPk(viewId);
  if (!view) throw new NotFoundError('Saved view not found');
  if (view.userId !== actor.sub) throw new ForbiddenError('You can only delete your own saved views');
  await view.destroy();
}
