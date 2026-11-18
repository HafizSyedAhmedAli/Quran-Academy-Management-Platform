import { NextResponse } from 'next/server';
import { currentActor } from '@/server/auth/current-actor';
import { getStudentForActor } from '@/server/students/student-queries';
import { updateStudent } from '@/server/students/student-commands';
import { authorize, errorResponse, readJson } from '@/server/http/route-helpers';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await ctx.params;
    return NextResponse.json(await getStudentForActor(actor, id));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  try {
    const { id } = await ctx.params;
    return NextResponse.json(await updateStudent(auth.actor, id, await readJson(req)));
  } catch (e) {
    return errorResponse(e);
  }
}
