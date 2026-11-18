import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/server/db/prisma';
import { login } from '@/server/auth/login';
import { resolveActor, destroySession } from '@/server/auth/session';
import { PASSWORD, resetDb, createParent, createTeacher } from './helpers';

describe('authentication', () => {
  beforeEach(resetDb);

  it('logs in with valid credentials and stores only a hash of the token', async () => {
    await createTeacher('t@example.com');
    const result = await login({ email: 't@example.com', password: PASSWORD });
    expect(result?.role).toBe('TEACHER');
    const rows = await prisma.authSession.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).not.toBe(result!.token);
    expect(JSON.stringify(rows)).not.toContain(result!.token);
  });

  it('rejects a wrong password, an unknown email and a deactivated user', async () => {
    const t = await createTeacher('t@example.com');
    expect(await login({ email: 't@example.com', password: 'nope' })).toBeNull();
    expect(await login({ email: 'ghost@example.com', password: PASSWORD })).toBeNull();
    await prisma.user.update({ where: { id: t.id }, data: { isActive: false } });
    expect(await login({ email: 't@example.com', password: PASSWORD })).toBeNull();
    expect(await prisma.authSession.count()).toBe(0);
  });

  it('resolves a session to an actor, including parentId', async () => {
    const { parent } = await createParent('p@example.com');
    const result = await login({ email: 'p@example.com', password: PASSWORD });
    const actor = await resolveActor(result!.token);
    expect(actor).toMatchObject({ role: 'PARENT', parentId: parent.id });
  });

  it('rejects an expired session and a destroyed session', async () => {
    await createTeacher('t@example.com');
    const result = await login({ email: 't@example.com', password: PASSWORD });
    await prisma.authSession.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await resolveActor(result!.token)).toBeNull();

    const again = await login({ email: 't@example.com', password: PASSWORD });
    await destroySession(again!.token);
    expect(await resolveActor(again!.token)).toBeNull();
  });

  it('rejects an unknown token', async () => {
    expect(await resolveActor('made-up-token')).toBeNull();
  });
});
