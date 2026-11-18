import { requireActor } from '@/server/auth/current-actor';
import { listStudentsForActor } from '@/server/students/student-queries';
import { StudentList } from '@/entities/student';
import { LogoutButton } from '@/features/authentication';

export const instant = false;

export default async function ParentHome() {
  const actor = await requireActor('PARENT');
  const students = await listStudentsForActor(actor);
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-8">
      <h1 className="text-2xl font-semibold">My children</h1>
      <StudentList students={students} hrefBase="/parent/students" />
      <LogoutButton />
    </main>
  );
}
