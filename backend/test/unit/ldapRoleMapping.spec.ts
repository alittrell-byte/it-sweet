process.env.LDAP_GROUP_ROLE_MAP = JSON.stringify({
  'CN=Helpdesk Admins,OU=Groups,DC=corp,DC=local': 'admin',
  'CN=IT Techs,OU=Groups,DC=corp,DC=local': 'technician',
});
process.env.LDAP_DEFAULT_ROLE = 'customer';

// eslint-disable-next-line import/first
import { resolveRoleFromGroups } from '../../src/modules/auth/authService';

describe('resolveRoleFromGroups (LDAP group -> app role mapping)', () => {
  it('maps a known admin group to the admin role', () => {
    expect(resolveRoleFromGroups(['CN=Helpdesk Admins,OU=Groups,DC=corp,DC=local'])).toBe('admin');
  });

  it('maps a known technician group to the technician role', () => {
    expect(resolveRoleFromGroups(['CN=IT Techs,OU=Groups,DC=corp,DC=local'])).toBe('technician');
  });

  it('falls back to the configured default role when no group matches', () => {
    expect(resolveRoleFromGroups(['CN=Everyone,OU=Groups,DC=corp,DC=local'])).toBe('customer');
  });

  it('falls back to the default role when the user has no groups at all', () => {
    expect(resolveRoleFromGroups([])).toBe('customer');
  });

  it('picks the first matching group when a user belongs to multiple mapped groups', () => {
    expect(
      resolveRoleFromGroups([
        'CN=Helpdesk Admins,OU=Groups,DC=corp,DC=local',
        'CN=IT Techs,OU=Groups,DC=corp,DC=local',
      ])
    ).toBe('admin');
  });
});
