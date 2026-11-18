import { requireActor } from '@/server/auth/current-actor';
import { listStudentsForActor } from '@/server/students/student-queries';
import { listUpcomingSessionsForActor } from '@/server/schedules/schedule-queries';
import { StudentList } from '@/entities/student';
import { SessionList } from '@/entities/session';
import { LogoutButton } from '@/features/authentication';
import { APP_TIMEZONE } from '@/shared/config/app';

export const instant = false;

export default async function ParentHome() {
  const actor = await requireActor('PARENT');
  const [students, sessions] = await Promise.all([
    listStudentsForActor(actor),
    listUpcomingSessionsForActor(actor),
  ]);
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <h1 className="text-2xl font-semibold">My children</h1>
      <StudentList students={students} hrefBase="/parent/students" />
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Upcoming classes</h2>
        <p className="text-sm text-gray-600">Times are in {APP_TIMEZONE}.</p>
        <SessionList sessions={sessions} />
      </section>
      <LogoutButton />
    </main>
  );
}
