import { requireActor } from '@/server/auth/current-actor';
import { listStudentsForActor } from '@/server/students/student-queries';
import { StudentList } from '@/entities/student';
import { LogoutButton } from '@/features/authentication';

export default async function TeacherHome() {
  const actor = await requireActor('TEACHER');
  const students = await listStudentsForActor(actor);
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-8">
      <h1 className="text-2xl font-semibold">Teacher dashboard</h1>
      <StudentList students={students} />
      <LogoutButton />
    </main>
  );
}
