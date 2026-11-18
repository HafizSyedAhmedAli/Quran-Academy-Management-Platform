import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('uses argon2id and verifies the right password', async () => {
    const h = await hashPassword('Correct#Horse1');
    expect(h.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(h, 'Correct#Horse1')).toBe(true);
    expect(await verifyPassword(h, 'wrong')).toBe(false);
  });
  it('returns false for a malformed hash instead of throwing', async () => {
    expect(await verifyPassword('not-a-hash', 'x')).toBe(false);
  });
});
