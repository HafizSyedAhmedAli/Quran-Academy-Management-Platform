import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/current-actor';
import { NotFoundError } from '@/server/domain/errors';
import {
  getStudentDetail,
  listParents,
  type StudentDetail,
} from '@/server/students/teacher-queries';
import {
  EditStudentForm,
  LinkParentForm,
  StudentActiveToggle,
  UnlinkParentButton,
} from '@/features/student-management';

export const instant = false;

export default async function TeacherStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor('TEACHER');
  const { id } = await params;

  let student: StudentDetail;
  try {
    student = await getStudentDetail(actor, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }

  const linked = new Set(student.parents.map((p) => p.id));
  const options = (await listParents(actor))
    .filter((p) => p.isActive && !linked.has(p.id))
    .map((p) => ({ id: p.id, label: `${p.fullName} (${p.email})` }));

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <Link className="underline" href="/teacher/students">
        ← Students
      </Link>
      <h1 className="text-2xl font-semibold">{student.fullName}</h1>
      <p data-testid="student-status">{student.isActive ? 'Active' : 'Inactive'}</p>

      <Link className="underline" href={`/teacher/students/${student.id}/schedule`}>
        Manage schedule
      </Link>

      <EditStudentForm student={student} />
      <StudentActiveToggle student={student} />

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Parents</h2>
        {student.parents.length === 0 ? (
          <p>No parents linked.</p>
        ) : (
          <ul className="space-y-2">
            {student.parents.map((p) => (
              <li key={p.id} data-testid="linked-parent">
                {p.fullName} ({p.email}){p.whatsappNumber ? ` · ${p.whatsappNumber}` : ''}{' '}
                <UnlinkParentButton studentId={student.id} parentId={p.id} />
              </li>
            ))}
          </ul>
        )}
        <LinkParentForm studentId={student.id} options={options} />
      </section>
    </main>
  );
}
