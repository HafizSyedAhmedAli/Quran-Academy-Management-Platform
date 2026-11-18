import Link from 'next/link';
import { requireActor } from '@/server/auth/current-actor';
import { listParents } from '@/server/students/teacher-queries';
import { AddParentForm } from '@/features/parent-management';

export const instant = false;

export default async function TeacherParentsPage() {
  const actor = await requireActor('TEACHER');
  const parents = await listParents(actor);
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <Link className="underline" href="/teacher">
        ← Dashboard
      </Link>
      <h1 className="text-2xl font-semibold">Parents</h1>
      <AddParentForm />
      {parents.length === 0 ? (
        <p>No parents yet.</p>
      ) : (
        <ul className="space-y-2">
          {parents.map((p) => (
            <li key={p.id} data-testid="parent-item">
              <strong>{p.fullName}</strong> · {p.email}
              {p.whatsappNumber ? ` · ${p.whatsappNumber}` : ''}
              {!p.isActive && (
                <span className="ml-2 rounded bg-gray-200 px-1 text-xs">Inactive</span>
              )}
              <div className="text-sm text-gray-600">
                Students:{' '}
                {p.students.length ? p.students.map((s) => s.fullName).join(', ') : 'none'}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
