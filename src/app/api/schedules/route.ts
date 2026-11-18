import { NextResponse } from 'next/server';
import { createSchedules } from '@/server/schedules/schedule-commands';
import { authorize, errorResponse, readJson } from '@/server/http/route-helpers';

export async function POST(req: Request) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  try {
    const schedules = await createSchedules(auth.actor, await readJson(req));
    return NextResponse.json({ schedules }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
