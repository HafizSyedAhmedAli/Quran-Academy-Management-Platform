import { NextResponse } from 'next/server';
import { createStudent } from '@/server/students/student-commands';
import { authorize, errorResponse, readJson } from '@/server/http/route-helpers';

export async function POST(req: Request) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  try {
    return NextResponse.json(await createStudent(auth.actor, await readJson(req)), { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
