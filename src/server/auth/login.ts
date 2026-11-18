import { z } from 'zod';
import { prisma } from '@/server/db/prisma';
import { hashPassword, verifyPassword } from './password';
import { createSession } from './session';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

let dummy: Promise<string> | undefined;
const dummyHash = () => (dummy ??= hashPassword('dummy-password-for-timing'));

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  // Always verify a hash, so unknown emails cost about the same as wrong passwords.
  const ok = await verifyPassword(user?.passwordHash ?? (await dummyHash()), input.password);
  if (!user || !ok || !user.isActive) return null;
  const session = await createSession(user.id);
  return { ...session, role: user.role };
}
