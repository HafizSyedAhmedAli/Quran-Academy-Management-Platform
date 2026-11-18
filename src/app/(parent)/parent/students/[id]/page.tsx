import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/current-actor';
import { NotFoundError } from '@/server/domain/errors';
import { getStudentForActor, type StudentView } from '@/server/students/student-queries';

export const instant = false;

export default async function ParentStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor('PARENT');
  const { id } = await params;
  let student: StudentView;
  try {
    student = await getStudentForActor(actor, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold" data-testid="student-name">
        {student.fullName}
      </h1>
      <p>{student.isActive ? 'Active' : 'Inactive'}</p>
    </main>
  );
}
