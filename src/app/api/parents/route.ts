import { NextResponse } from 'next/server';
import { createParent } from '@/server/students/parent-commands';
import { authorize, errorResponse, readJson } from '@/server/http/route-helpers';

export async function POST(req: Request) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  try {
    return NextResponse.json(await createParent(auth.actor, await readJson(req)), { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
