// Log parsing/normalization: best-effort extraction of a handful of common fields out of a raw
// message body so they become queryable (search filter, alert-rule grouping) instead of buried
// in free text. Deliberately bounded to four concrete formats rather than a full pluggable
// Grok-style engine - if a shape isn't recognized, the message is stored as-is with no metadata.

const IPV4_PATTERN = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/;

// Common firewall/app "key=value" or "key="quoted value"" pairs (Cisco ASA, pfSense, and
// similar). Capped at 20 pairs so a pathological line can't blow up metadata size.
const KEY_VALUE_PATTERN = /\b([a-zA-Z_][a-zA-Z0-9_]{0,30})=("([^"]*)"|(\S+))/g;
const MAX_KEY_VALUE_PAIRS = 20;

function parseKeyValuePairs(message: string): Record<string, string> {
  const fields: Record<string, string> = {};
  let match: RegExpExecArray | null;
  let count = 0;
  KEY_VALUE_PATTERN.lastIndex = 0;
  while (count < MAX_KEY_VALUE_PAIRS && (match = KEY_VALUE_PATTERN.exec(message)) !== null) {
    const [, key, , quoted, bare] = match;
    fields[key] = quoted ?? bare;
    count += 1;
  }
  return fields;
}

const IP_KEY_PRIORITY = ['srcip', 'src_ip', 'source_ip', 'clientip', 'client_ip', 'src', 'ip'];

function sourceIpFromKeyValues(kv: Record<string, string>): string | null {
  for (const key of IP_KEY_PRIORITY) {
    const value = kv[key];
    if (value && IPV4_PATTERN.test(value)) return value.match(IPV4_PATTERN)![0];
  }
  return null;
}

// A small, deliberately non-exhaustive map of well-known Windows Security log event IDs -
// enough to make "failed logon" / "account locked out" style alerting useful without trying to
// replicate the full Microsoft event ID reference.
const WINDOWS_SECURITY_EVENT_IDS: Record<number, string> = {
  4624: 'Successful logon',
  4625: 'Failed logon',
  4634: 'Logoff',
  4720: 'User account created',
  4722: 'User account enabled',
  4725: 'User account disabled',
  4726: 'User account deleted',
  4732: 'Member added to security-enabled group',
  4740: 'Account locked out',
};

const WINDOWS_EVENT_ID_PATTERN = /\bEvent\s*ID[:=]?\s*(\d{3,5})\b/i;

function parseWindowsEventId(message: string): { windowsEventId: number; eventLabel?: string } | null {
  const match = message.match(WINDOWS_EVENT_ID_PATTERN);
  if (!match) return null;
  const windowsEventId = Number(match[1]);
  const eventLabel = WINDOWS_SECURITY_EVENT_IDS[windowsEventId];
  return eventLabel ? { windowsEventId, eventLabel } : { windowsEventId };
}

// nginx/Apache "combined log format":
// $remote_addr - $remote_user [$time_local] "$request" $status $bytes_sent "$referer" "$agent"
// Only the prefix through status/bytes is required to match - referer/user-agent are ignored.
const COMBINED_LOG_PATTERN = /^(\S+) \S+ \S+ \[[^\]]+\] "(\S+) (\S+)[^"]*" (\d{3}) (\S+)/;

function parseCombinedLogFormat(
  message: string
): { sourceIp: string; httpMethod: string; httpPath: string; httpStatus: number } | null {
  const match = message.match(COMBINED_LOG_PATTERN);
  if (!match) return null;
  const [, ip, method, path, status] = match;
  if (!IPV4_PATTERN.test(ip)) return null;
  return { sourceIp: ip, httpMethod: method, httpPath: path, httpStatus: Number(status) };
}

export function parseLogFields(message: string): Record<string, string | number> {
  const fields: Record<string, string | number> = {};

  // Precedence, most-to-least specific/reliable: a full combined-log-format match, then
  // explicit key=value pairs, then a bare fallback scan for any IPv4-looking token. Each stage
  // only fills keys not already set by a higher-precedence stage.
  const combined = parseCombinedLogFormat(message);
  if (combined) Object.assign(fields, combined);

  const kv = parseKeyValuePairs(message);
  for (const [key, value] of Object.entries(kv)) {
    if (!(key in fields)) fields[key] = value;
  }
  if (!('sourceIp' in fields)) {
    const kvIp = sourceIpFromKeyValues(kv);
    if (kvIp) fields.sourceIp = kvIp;
  }
  if (!('sourceIp' in fields)) {
    const bareIp = message.match(IPV4_PATTERN);
    if (bareIp) fields.sourceIp = bareIp[0];
  }

  const windowsEvent = parseWindowsEventId(message);
  if (windowsEvent) Object.assign(fields, windowsEvent);

  return fields;
}
