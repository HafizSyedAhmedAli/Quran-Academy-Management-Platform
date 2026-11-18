import { NextResponse } from 'next/server';
import { unlinkParent } from '@/server/students/student-commands';
import { authorize, errorResponse } from '@/server/http/route-helpers';

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string; parentId: string }> },
) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  try {
    const { id, parentId } = await ctx.params;
    await unlinkParent(auth.actor, id, parentId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
