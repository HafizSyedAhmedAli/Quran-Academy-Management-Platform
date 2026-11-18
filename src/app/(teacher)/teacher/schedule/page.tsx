import Link from 'next/link';
import { requireActor } from '@/server/auth/current-actor';
import { ensureUpcomingSessions } from '@/server/schedules/schedule-commands';
import { listUpcomingSessionsForActor } from '@/server/schedules/schedule-queries';
import { SessionList } from '@/entities/session';
import { APP_TIMEZONE } from '@/shared/config/app';

export const instant = false;

export default async function UpcomingClassesPage() {
  const actor = await requireActor('TEACHER');
  await ensureUpcomingSessions(actor); // idempotent: tops up the next 4 weeks
  const sessions = await listUpcomingSessionsForActor(actor);
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <Link className="underline" href="/teacher">
        ← Dashboard
      </Link>
      <h1 className="text-2xl font-semibold">Upcoming classes</h1>
      <p className="text-sm text-gray-600">Next 4 weeks, times in {APP_TIMEZONE}.</p>
      <SessionList sessions={sessions} />
    </main>
  );
}
