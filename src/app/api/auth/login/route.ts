import { NextResponse } from 'next/server';
import { login, loginSchema } from '@/server/auth/login';
import { SESSION_COOKIE } from '@/server/auth/cookie';
import { createRateLimiter } from '@/server/domain/rate-limit';

const limiter = createRateLimiter({ max: 5, windowMs: 15 * 60 * 1000 });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const key = `${ip}:${parsed.data.email}`;
  if (limiter.isBlocked(key)) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const result = await login(parsed.data);
  if (!result) {
    limiter.recordFailure(key);
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }
  limiter.reset(key);

  const res = NextResponse.json({ role: result.role });
  res.cookies.set(SESSION_COOKIE, result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: result.expiresAt,
  });
  return res;
}
