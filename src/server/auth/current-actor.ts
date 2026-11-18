import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Actor, Role } from '@/server/domain/access-policy';
import { SESSION_COOKIE } from './cookie';
import { resolveActor } from './session';

export async function currentActor(): Promise<Actor | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? resolveActor(token) : null;
}

export async function requireActor(role: Role): Promise<Actor> {
  const actor = await currentActor();
  if (!actor) redirect('/login');
  if (actor.role !== role) redirect(actor.role === 'TEACHER' ? '/teacher' : '/parent');
  return actor;
}
