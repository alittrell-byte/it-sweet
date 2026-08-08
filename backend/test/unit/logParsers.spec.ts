import { parseLogFields } from '../../src/modules/logs/logParsers';

describe('parseLogFields', () => {
  it('extracts key=value pairs from a firewall-style message', () => {
    const fields = parseLogFields('firewall: action=block src=10.0.0.5 dst=8.8.8.8 proto=tcp');
    expect(fields).toMatchObject({ action: 'block', src: '10.0.0.5', dst: '8.8.8.8', proto: 'tcp' });
  });

  it('extracts quoted key=value pairs', () => {
    const fields = parseLogFields('user="jane doe" action=login');
    expect(fields.user).toBe('jane doe');
    expect(fields.action).toBe('login');
  });

  it('falls back to a bare IPv4 scan for sourceIp when no recognizable ip key is present', () => {
    const fields = parseLogFields('Failed password for admin from 192.168.1.50 port 22 ssh2');
    expect(fields.sourceIp).toBe('192.168.1.50');
  });

  it('prefers an explicit src/srcip key over a bare IP scan for sourceIp', () => {
    const fields = parseLogFields('event: srcip=10.1.1.1 note connecting from 172.16.0.9 as relay');
    expect(fields.sourceIp).toBe('10.1.1.1');
  });

  it('maps well-known Windows Security event IDs to a label', () => {
    const fields = parseLogFields('An account failed to log on. EventID: 4625 details follow');
    expect(fields.windowsEventId).toBe(4625);
    expect(fields.eventLabel).toBe('Failed logon');
  });

  it('reports an unmapped Windows event ID without a label', () => {
    const fields = parseLogFields('EventID: 9999 something obscure happened');
    expect(fields.windowsEventId).toBe(9999);
    expect(fields.eventLabel).toBeUndefined();
  });

  it('parses nginx/Apache combined log format into structured fields', () => {
    const line = '203.0.113.9 - - [10/Aug/2026:13:55:36 +0000] "GET /api/widgets HTTP/1.1" 404 512 "-" "curl/8.0"';
    const fields = parseLogFields(line);
    expect(fields).toMatchObject({
      sourceIp: '203.0.113.9',
      httpMethod: 'GET',
      httpPath: '/api/widgets',
      httpStatus: 404,
    });
  });

  it('lets a combined-log-format match take precedence over a generic bare IP scan for sourceIp', () => {
    const line = '203.0.113.9 - - [10/Aug/2026:13:55:36 +0000] "GET / HTTP/1.1" 200 100 "referrer with 10.0.0.1 in it" "-"';
    const fields = parseLogFields(line);
    expect(fields.sourceIp).toBe('203.0.113.9');
  });

  it('returns an empty object for a message with nothing recognizable', () => {
    expect(parseLogFields('just a plain unstructured log line')).toEqual({});
  });
});
