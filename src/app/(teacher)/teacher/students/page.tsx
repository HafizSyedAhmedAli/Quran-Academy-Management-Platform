import Link from 'next/link';
import { requireActor } from '@/server/auth/current-actor';
import { listStudentsWithParents } from '@/server/students/teacher-queries';
import { StudentList } from '@/entities/student';
import { AddStudentForm } from '@/features/student-management';

export const instant = false;

export default async function TeacherStudentsPage() {
  const actor = await requireActor('TEACHER');
  const students = await listStudentsWithParents(actor);
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <Link className="underline" href="/teacher">
        ← Dashboard
      </Link>
      <h1 className="text-2xl font-semibold">Students</h1>
      <AddStudentForm />
      <StudentList students={students} hrefBase="/teacher/students" />
    </main>
  );
}
