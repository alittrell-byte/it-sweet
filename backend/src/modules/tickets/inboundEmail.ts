import { InboundEmail } from '../../common/email/ImapWatcherService';
import { logger } from '../../common/logger';
import { AccessTokenPayload } from '../auth/authService';
import { User } from '../auth/user.model';
import * as ticketService from './ticketService';

async function findOrCreateRequester(email: string, displayName: string | null): Promise<User> {
  const existing = await User.findOne({ where: { email: email.toLowerCase() } });
  if (existing) return existing;
  // Unknown senders are provisioned as customers so the email gateway can create
  // tickets for people who have never logged into the portal.
  return User.create({
    email: email.toLowerCase(),
    displayName: displayName ?? email,
    role: 'customer',
    authSource: 'local',
    passwordHash: null,
  });
}

function actorFor(user: User): AccessTokenPayload {
  return { sub: user.id, role: user.role, email: user.email, rank: user.rank, isSuperAdmin: user.isSuperAdmin, permissions: [] };
}

// Wired up as the callback for ImapWatcherService; only ever invoked when
// EMAIL_INBOUND_ENABLED=true and the watcher successfully polls a mailbox.
export async function handleInboundEmail(email: InboundEmail): Promise<void> {
  try {
    const requester = await findOrCreateRequester(email.fromAddress, email.fromName);
    const actor = actorFor(requester);

    if (email.ticketId) {
      await ticketService.addComment(email.ticketId, { body: email.text, isInternal: false }, actor);
      return;
    }

    await ticketService.createTicket(
      { subject: email.subject, description: email.text, priority: 'medium' },
      actor
    );
  } catch (err) {
    logger.error('Failed to process inbound email into a ticket', { err, from: email.fromAddress });
  }
}
