import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { env } from '../../config/env';
import { logger } from '../logger';

export interface InboundEmail {
  fromAddress: string;
  fromName: string | null;
  subject: string;
  text: string;
  /** Ticket number parsed out of a `[Ticket #123]` token in the subject, if present. */
  ticketId: number | null;
  /**
   * True only when our receiving mail server recorded `dmarc=pass` for this message. The From
   * header itself is trivially forged, so anything that trusts the sender's identity beyond
   * customer level must check this first.
   */
  senderVerified: boolean;
}

export type InboundEmailHandler = (email: InboundEmail) => Promise<void>;

const TICKET_TOKEN_RE = /\[Ticket #(\d+)\]/i;

// Only the topmost Authentication-Results header is trustworthy: it's the one our own receiving
// server prepended. Lower ones arrived with the message and could have been written by the sender.
function dmarcPassed(header: unknown): boolean {
  const top = Array.isArray(header) ? header[0] : header;
  return typeof top === 'string' && /\bdmarc=pass\b/i.test(top);
}

// Entirely optional email-to-ticket gateway. Disabled unless EMAIL_INBOUND_ENABLED=true,
// so a deployment that only needs outbound SMTP notifications never has to touch this.
export class ImapWatcherService {
  private client: ImapFlow | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly onEmail: InboundEmailHandler) {}

  start(): void {
    if (!env.EMAIL_INBOUND_ENABLED) {
      return;
    }
    if (!env.IMAP_HOST || !env.IMAP_USER || !env.IMAP_PASSWORD) {
      logger.warn('EMAIL_INBOUND_ENABLED is true but IMAP_HOST/IMAP_USER/IMAP_PASSWORD are not fully configured');
      return;
    }
    this.pollTimer = setInterval(() => {
      this.pollOnce().catch((err) => logger.error('IMAP poll failed', { err }));
    }, env.IMAP_POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  async pollOnce(): Promise<void> {
    const client = new ImapFlow({
      host: env.IMAP_HOST as string,
      port: env.IMAP_PORT,
      secure: env.IMAP_SECURE,
      auth: { user: env.IMAP_USER as string, pass: env.IMAP_PASSWORD as string },
      logger: false,
    });
    this.client = client;
    await client.connect();
    try {
      const lock = await client.getMailboxLock(env.IMAP_MAILBOX);
      try {
        for await (const message of client.fetch({ seen: false }, { source: true })) {
          const parsed = await simpleParser(message.source as Buffer);
          const subject = parsed.subject ?? '(no subject)';
          const tokenMatch = subject.match(TICKET_TOKEN_RE);
          await this.onEmail({
            fromAddress: parsed.from?.value[0]?.address ?? 'unknown@unknown',
            fromName: parsed.from?.value[0]?.name ?? null,
            subject,
            text: parsed.text ?? '',
            ticketId: tokenMatch ? Number(tokenMatch[1]) : null,
            senderVerified: dmarcPassed(parsed.headers.get('authentication-results')),
          });
          await client.messageFlagsAdd(message.uid, ['\\Seen'], { uid: true });
        }
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }
}
