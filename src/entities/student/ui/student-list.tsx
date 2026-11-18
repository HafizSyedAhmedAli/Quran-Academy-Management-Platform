import Link from 'next/link';

type Item = { id: string; fullName: string; isActive?: boolean };

export function StudentList({ students, hrefBase }: { students: Item[]; hrefBase?: string }) {
  if (students.length === 0) return <p>No students yet.</p>;
  return (
    <ul className="space-y-2">
      {students.map((s) => (
        <li key={s.id} data-testid="student-item">
          {hrefBase ? (
            <Link className="underline" href={`${hrefBase}/${s.id}`}>
              {s.fullName}
            </Link>
          ) : (
            <span>{s.fullName}</span>
          )}
          {s.isActive === false && (
            <span className="ml-2 rounded bg-gray-200 px-1 text-xs">Inactive</span>
          )}{' '}
          <code className="text-xs text-gray-500">{s.id}</code>
        </li>
      ))}
    </ul>
  );
}
