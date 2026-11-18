import { hash, verify } from '@node-rs/argon2'; // Argon2id is the default algorithm

export const hashPassword = (password: string) => hash(password);

export async function verifyPassword(hashed: string, password: string): Promise<boolean> {
  try {
    return await verify(hashed, password);
  } catch {
    return false;
  }
}
