import { LogSeverity } from './logEntry.model';

const SEVERITY_BY_CODE: LogSeverity[] = [
  'emergency',
  'alert',
  'critical',
  'error',
  'warning',
  'notice',
  'info',
  'debug',
];

export interface ParsedSyslogLine {
  severity: LogSeverity;
  host: string | null;
  message: string;
}

const PRI_RE = /^<(\d{1,3})>/;
// Classic BSD syslog (RFC3164) header: "Mon D HH:MM:SS HOSTNAME rest..."
const BSD_HEADER_RE = /^([A-Z][a-z]{2}\s+\d{1,2}\s\d{2}:\d{2}:\d{2})\s+(\S+)\s+(.*)$/;

// Deliberately lenient: this only needs to pull out severity/host on a best-effort basis
// for common network gear/server output. The raw line is always preserved unparsed
// alongside whatever this extracts, so nothing is lost if the format doesn't match.
export function parseSyslogLine(raw: string): ParsedSyslogLine {
  let rest = raw.trim();
  let severity: LogSeverity = 'info';

  const priMatch = rest.match(PRI_RE);
  if (priMatch) {
    const pri = Number(priMatch[1]);
    severity = SEVERITY_BY_CODE[pri % 8] ?? 'info';
    rest = rest.slice(priMatch[0].length);
  }

  const bsdMatch = rest.match(BSD_HEADER_RE);
  if (bsdMatch) {
    return { severity, host: bsdMatch[2], message: bsdMatch[3] };
  }

  return { severity, host: null, message: rest };
}
