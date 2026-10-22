import ldap, { Client, SearchEntry } from 'ldapjs';
import { env } from '../../config/env';
import { logger } from '../../common/logger';
import { AuthProvider, AuthResult } from './AuthProvider';

function bindAsync(client: Client, dn: string, password: string): Promise<void> {
  return new Promise((resolve, reject) => {
    client.bind(dn, password, (err) => (err ? reject(err) : resolve()));
  });
}

function searchAsync(client: Client, base: string, filter: string): Promise<SearchEntry | null> {
  return new Promise((resolve, reject) => {
    client.search(base, { filter, scope: 'sub' }, (err, res) => {
      if (err) {
        reject(err);
        return;
      }
      let found: SearchEntry | null = null;
      res.on('searchEntry', (entry) => {
        found = entry;
      });
      res.on('error', reject);
      res.on('end', () => resolve(found));
    });
  });
}

function unbindAsync(client: Client): Promise<void> {
  return new Promise((resolve) => client.unbind(() => resolve()));
}

// RFC 4515 escaping for a value placed inside a search filter. Without it, a username like
// `*` or `x)(uid=*` rewrites the filter itself - e.g. `*` matches every account in the base.
export function escapeLdapFilterValue(value: string): string {
  return value.replace(/[\\*()\0]/g, (ch) => `\\${ch.charCodeAt(0).toString(16).padStart(2, '0')}`);
}

function attr(entry: SearchEntry, name: string): string | undefined {
  const found = entry.attributes.find((a) => a.type === name);
  return found?.values?.[0] as string | undefined;
}

function attrValues(entry: SearchEntry, name: string): string[] {
  const found = entry.attributes.find((a) => a.type === name);
  return (found?.values as string[]) ?? [];
}

// Binds against on-prem Active Directory or OpenLDAP. Verification is a two-step bind:
// first a service account looks up the user's DN, then we attempt to bind AS that DN
// with the supplied password - a failed second bind means bad credentials.
export class LdapAuthProvider implements AuthProvider {
  async verifyCredentials(username: string, password: string): Promise<AuthResult | null> {
    if (!env.LDAP_URL || !env.LDAP_BIND_DN || !env.LDAP_BIND_PASSWORD || !env.LDAP_SEARCH_BASE) {
      logger.error('LDAP auth is not fully configured (LDAP_URL/LDAP_BIND_DN/LDAP_BIND_PASSWORD/LDAP_SEARCH_BASE)');
      return null;
    }

    const searchClient = ldap.createClient({ url: env.LDAP_URL });
    let entry: SearchEntry | null;
    try {
      await bindAsync(searchClient, env.LDAP_BIND_DN, env.LDAP_BIND_PASSWORD);
      const filter = env.LDAP_SEARCH_FILTER.replace(/\{\{username\}\}/g, () => escapeLdapFilterValue(username));
      entry = await searchAsync(searchClient, env.LDAP_SEARCH_BASE, filter);
    } catch (err) {
      logger.error('LDAP directory search failed', { err });
      return null;
    } finally {
      await unbindAsync(searchClient);
    }

    if (!entry) {
      return null;
    }

    const userClient = ldap.createClient({ url: env.LDAP_URL });
    try {
      await bindAsync(userClient, entry.dn.toString(), password);
    } catch {
      return null; // bad credentials
    } finally {
      await unbindAsync(userClient);
    }

    const email = attr(entry, 'mail') ?? `${username}@ldap.local`;
    const displayName = attr(entry, 'displayName') ?? attr(entry, 'cn') ?? username;
    const groups = attrValues(entry, 'memberOf');

    return {
      externalId: entry.dn.toString(),
      email,
      displayName,
      groups,
    };
  }
}
