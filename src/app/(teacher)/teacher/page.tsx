import Link from 'next/link';
import { requireActor } from '@/server/auth/current-actor';
import { LogoutButton } from '@/features/authentication';

export const instant = false;

export default async function TeacherHome() {
  await requireActor('TEACHER');
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-8">
      <h1 className="text-2xl font-semibold">Teacher dashboard</h1>
      <nav className="space-x-4">
        <Link className="underline" href="/teacher/students">
          Students
        </Link>
        <Link className="underline" href="/teacher/parents">
          Parents
        </Link>
        <Link className="underline" href="/teacher/schedule">
          Upcoming classes
        </Link>
      </nav>
      <LogoutButton />
    </main>
  );
}
