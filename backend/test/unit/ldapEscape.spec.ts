import { escapeLdapFilterValue } from '../../src/modules/auth/LdapAuthProvider';

describe('escapeLdapFilterValue', () => {
  it('leaves ordinary usernames alone', () => {
    expect(escapeLdapFilterValue('jdoe')).toBe('jdoe');
    expect(escapeLdapFilterValue('j.doe@example.com')).toBe('j.doe@example.com');
  });

  it('escapes filter metacharacters so input cannot change the filter', () => {
    expect(escapeLdapFilterValue('*')).toBe('\\2a');
    expect(escapeLdapFilterValue('x)(uid=*')).toBe('x\\29\\28uid=\\2a');
    expect(escapeLdapFilterValue('a\\b')).toBe('a\\5cb');
    expect(escapeLdapFilterValue('a\0b')).toBe('a\\00b');
  });
});
