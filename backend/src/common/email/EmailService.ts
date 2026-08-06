import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../../config/env';
import { logger } from '../logger';

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

// Thin wrapper over SMTP. Works with any relay - a real mailbox, a provider's
// SMTP endpoint (SES/SendGrid/etc.), or an internal relay that sends "from" an
// address it doesn't own (the common no-reply notification setup). EMAIL_FROM
// is just a configured header, nothing about this assumes a specific provider.
export class EmailService {
  private readonly transporter: Transporter;

  constructor() {
    // In tests, use nodemailer's in-process JSON transport so the suite never depends
    // on a real SMTP relay (e.g. the Mailhog container) being reachable.
    this.transporter =
      env.NODE_ENV === 'test'
        ? nodemailer.createTransport({ jsonTransport: true })
        : nodemailer.createTransport({
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            secure: env.SMTP_SECURE,
            auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
          });
  }

  async send(input: SendEmailInput): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: env.EMAIL_FROM,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      });
    } catch (err) {
      // Notification delivery failures should never block the underlying ticket action.
      logger.error('Failed to send email', { err, subject: input.subject, to: input.to });
    }
  }
}

export const emailService = new EmailService();
