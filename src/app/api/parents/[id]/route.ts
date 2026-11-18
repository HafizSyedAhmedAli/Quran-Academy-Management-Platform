import { NextResponse } from 'next/server';
import { setParentActive, updateParent } from '@/server/students/parent-commands';
import { authorize, errorResponse, readJson } from '@/server/http/route-helpers';

type Ctx = { params: Promise<{ id: string }> };

// PUT replaces contact details (name, WhatsApp number).
export async function PUT(req: Request, ctx: Ctx) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  try {
    const { id } = await ctx.params;
    return NextResponse.json(await updateParent(auth.actor, id, await readJson(req)));
  } catch (e) {
    return errorResponse(e);
  }
}

// PATCH toggles the account's active state.
export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;
  try {
    const { id } = await ctx.params;
    return NextResponse.json(await setParentActive(auth.actor, id, await readJson(req)));
  } catch (e) {
    return errorResponse(e);
  }
}
