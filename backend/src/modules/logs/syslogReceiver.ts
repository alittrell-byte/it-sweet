import dgram from 'dgram';
import { env } from '../../config/env';
import { logger } from '../../common/logger';
import { parseSyslogLine } from './syslogParser';
import { ingestUnregistered } from './logIngestService';

// Off unless explicitly enabled - same convention as the IMAP inbound gateway
// (backend/src/common/email/ImapWatcherService.ts). Listens on an unprivileged port
// internally; docker-compose.yml maps the standard host port 514/udp onto it.
export class SyslogReceiver {
  private socket: dgram.Socket | null = null;

  start(): void {
    if (!env.LOG_SYSLOG_ENABLED) return;

    const socket = dgram.createSocket('udp4');
    this.socket = socket;

    socket.on('message', (msg, rinfo) => {
      const raw = msg.toString('utf-8');
      const parsed = parseSyslogLine(raw);
      ingestUnregistered({
        host: parsed.host ?? rinfo.address,
        severity: parsed.severity,
        message: parsed.message,
        raw,
      }).catch((err) => logger.error('Failed to ingest syslog UDP message', { err }));
    });

    socket.on('error', (err) => {
      logger.error('Syslog UDP receiver error', { err });
    });

    socket.bind(env.LOG_SYSLOG_UDP_PORT, () => {
      logger.info(`Syslog UDP receiver listening on port ${env.LOG_SYSLOG_UDP_PORT}`);
    });
  }

  stop(): void {
    this.socket?.close();
    this.socket = null;
  }
}
