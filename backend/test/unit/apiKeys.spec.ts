import { generateApiKey, hashApiKey } from '../../src/common/apiKeys';

describe('apiKeys', () => {
  it('generates 48-hex-char keys that do not repeat', () => {
    const keys = new Set(Array.from({ length: 50 }, generateApiKey));
    expect(keys.size).toBe(50);
    for (const key of keys) expect(key).toMatch(/^[0-9a-f]{48}$/);
  });

  it('hashes deterministically to 64 hex chars and never echoes the key', () => {
    const key = generateApiKey();
    expect(hashApiKey(key)).toBe(hashApiKey(key));
    expect(hashApiKey(key)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashApiKey(key)).not.toContain(key);
    expect(hashApiKey(key)).not.toBe(hashApiKey(key + 'x'));
  });
});
