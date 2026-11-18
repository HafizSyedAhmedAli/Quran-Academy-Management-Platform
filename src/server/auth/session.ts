import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@/server/db/prisma';
import type { Actor } from '@/server/domain/access-policy';

const SESSION_DAYS = 7;
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.authSession.create({ data: { userId, tokenHash: sha256(token), expiresAt } });
  return { token, expiresAt };
}

export async function resolveActor(token: string): Promise<Actor | null> {
  const session = await prisma.authSession.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { include: { parent: { select: { id: true } } } } },
  });
  if (!session || session.expiresAt <= new Date() || !session.user.isActive) return null;
  return {
    userId: session.user.id,
    role: session.user.role,
    parentId: session.user.parent?.id,
  };
}

export async function destroySession(token: string) {
  await prisma.authSession.deleteMany({ where: { tokenHash: sha256(token) } });
}
