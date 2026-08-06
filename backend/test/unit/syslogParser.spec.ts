import { parseSyslogLine } from '../../src/modules/logs/syslogParser';

describe('parseSyslogLine', () => {
  it('parses a classic BSD syslog line with PRI, timestamp, and hostname', () => {
    const result = parseSyslogLine("<34>Oct 11 22:14:15 mymachine su: 'su root' failed for lonvick on /dev/pts/8");
    expect(result.severity).toBe('critical'); // PRI 34 = facility 4 * 8 + severity 2 (critical)
    expect(result.host).toBe('mymachine');
    expect(result.message).toBe("su: 'su root' failed for lonvick on /dev/pts/8");
  });

  it('maps every PRI severity code to the matching severity name', () => {
    const cases: Array<[number, string]> = [
      [0, 'emergency'],
      [1, 'alert'],
      [2, 'critical'],
      [3, 'error'],
      [4, 'warning'],
      [5, 'notice'],
      [6, 'info'],
      [7, 'debug'],
    ];
    for (const [code, expected] of cases) {
      const result = parseSyslogLine(`<${code}>Oct 11 22:14:15 host message ${code}`);
      expect(result.severity).toBe(expected);
    }
  });

  it('defaults to info severity and no host when there is no PRI/BSD header at all', () => {
    const result = parseSyslogLine('just a plain line with no syslog structure');
    expect(result.severity).toBe('info');
    expect(result.host).toBeNull();
    expect(result.message).toBe('just a plain line with no syslog structure');
  });

  it('still extracts severity from PRI even when the BSD header does not match', () => {
    const result = parseSyslogLine('<11>not a bsd formatted header at all');
    expect(result.severity).toBe('error'); // 11 % 8 = 3 -> error
    expect(result.host).toBeNull();
    expect(result.message).toBe('not a bsd formatted header at all');
  });
});
