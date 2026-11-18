import { NextResponse } from 'next/server';
import { currentActor } from '@/server/auth/current-actor';
import { NotFoundError } from '@/server/domain/errors';
import { getStudentForActor } from '@/server/students/student-queries';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await ctx.params;
    return NextResponse.json(await getStudentForActor(actor, id));
  } catch (e) {
    if (e instanceof NotFoundError)
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    throw e;
  }
}
