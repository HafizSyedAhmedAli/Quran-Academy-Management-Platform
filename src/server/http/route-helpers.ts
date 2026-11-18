import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { currentActor } from '@/server/auth/current-actor';
import type { Actor } from '@/server/domain/access-policy';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/server/domain/errors';

function originHost(origin: string): string | null {
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
}

// Mutations must come from our own origin. Requests with no Origin header (non-browser clients) pass,
// but they still need a valid session cookie.
export async function authorize(
  req: Request,
): Promise<{ actor: Actor } | { response: NextResponse }> {
  const origin = req.headers.get('origin');
  if (origin) {
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
    if (originHost(origin) !== host) {
      return { response: NextResponse.json({ error: 'Bad origin' }, { status: 403 }) };
    }
  }
  const actor = await currentActor();
  if (!actor) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { actor };
}

export const readJson = (req: Request): Promise<unknown> => req.json().catch(() => null);

export function errorResponse(e: unknown): NextResponse {
  if (e instanceof ZodError) {
    return NextResponse.json({ error: e.issues.map((i) => i.message).join('; ') }, { status: 400 });
  }
  if (e instanceof ForbiddenError)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (e instanceof NotFoundError) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (e instanceof ConflictError) return NextResponse.json({ error: e.message }, { status: 409 });
  if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
  throw e;
}
