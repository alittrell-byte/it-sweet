export interface AuthResult {
  externalId: string;
  email: string;
  displayName: string;
  /** Raw group names/DNs from the directory; unused by LocalAuthProvider. */
  groups: string[];
}

// Both the local and LDAP drivers implement this same shape, and any future SSO/OIDC
// driver would too - authService doesn't need to know which one it's talking to.
export interface AuthProvider {
  verifyCredentials(username: string, password: string): Promise<AuthResult | null>;
}
