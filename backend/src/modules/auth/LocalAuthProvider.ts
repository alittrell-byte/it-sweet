import bcrypt from 'bcrypt';
import { AuthProvider, AuthResult } from './AuthProvider';
import { User } from './user.model';

export class LocalAuthProvider implements AuthProvider {
  async verifyCredentials(username: string, password: string): Promise<AuthResult | null> {
    const user = await User.findOne({ where: { email: username.toLowerCase(), authSource: 'local' } });
    if (!user || !user.passwordHash || !user.isActive) {
      return null;
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return null;
    }
    return {
      externalId: user.id,
      email: user.email,
      displayName: user.displayName,
      groups: [],
    };
  }
}
