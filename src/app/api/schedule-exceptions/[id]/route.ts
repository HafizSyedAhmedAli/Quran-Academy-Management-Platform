import { NextResponse } from 'next/server';
import { removeScheduleException } from '@/server/schedules/schedule-commands';
import { authorize, errorResponse } from '@/server/http/route-helpers';

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  try {
    const { id } = await ctx.params;
    await removeScheduleException(auth.actor, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
