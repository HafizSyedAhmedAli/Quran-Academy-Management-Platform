import { NextResponse } from 'next/server';
import { z } from 'zod';
import { linkParent } from '@/server/students/student-commands';
import { authorize, errorResponse, readJson } from '@/server/http/route-helpers';

const bodySchema = z.object({ parentId: z.string().min(1, 'Choose a parent') });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  try {
    const { id } = await ctx.params;
    const { parentId } = bodySchema.parse(await readJson(req));
    await linkParent(auth.actor, id, parentId);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
