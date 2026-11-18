import { NextResponse } from 'next/server';
import { endSchedule } from '@/server/schedules/schedule-commands';
import { authorize, errorResponse, readJson } from '@/server/http/route-helpers';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  try {
    const { id } = await ctx.params;
    return NextResponse.json(await endSchedule(auth.actor, id, await readJson(req)));
  } catch (e) {
    return errorResponse(e);
  }
}
