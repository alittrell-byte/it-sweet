import { createHash, randomBytes } from 'crypto';

// Agent API keys (log sources, patch agents) are stored hashed, like passwords: a leaked
// database dump then can't be used to impersonate every agent. Unlike passwords the keys are
// 192 bits of randomness, so a plain SHA-256 is enough - there's nothing to brute-force, and
// the hash doubles as the lookup column, which a salted/slow hash couldn't.
export function generateApiKey(): string {
  return randomBytes(24).toString('hex');
}

export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}
