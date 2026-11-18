'use client';
import { sendJson } from '@/shared/api/send-json';
import { useMutation } from '@/shared/lib/use-mutation';
import { ErrorText } from '@/shared/ui/error-text';

const inputClass = 'mt-1 w-full rounded border p-2';
const buttonClass = 'rounded bg-black px-4 py-2 text-white disabled:opacity-50';

export function AddStudentForm() {
  const { error, busy, run } = useMutation();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fullName = new FormData(form).get('fullName');
        void run(
          () => sendJson('/api/students', 'POST', { fullName }),
          () => form.reset(),
        );
      }}
    >
      <label className="block">
        Full name
        <input name="fullName" required maxLength={120} className={inputClass} />
      </label>
      <ErrorText message={error} />
      <button disabled={busy} className={buttonClass}>
        Add student
      </button>
    </form>
  );
}

export function EditStudentForm({ student }: { student: { id: string; fullName: string } }) {
  const { error, busy, run } = useMutation();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fullName = new FormData(e.currentTarget).get('fullName');
        void run(() => sendJson(`/api/students/${student.id}`, 'PATCH', { fullName }));
      }}
    >
      <label className="block">
        Student name
        <input
          name="fullName"
          defaultValue={student.fullName}
          required
          maxLength={120}
          className={inputClass}
        />
      </label>
      <ErrorText message={error} />
      <button disabled={busy} className={buttonClass}>
        Save name
      </button>
    </form>
  );
}

export function StudentActiveToggle({ student }: { student: { id: string; isActive: boolean } }) {
  const { error, busy, run } = useMutation();
  return (
    <div className="space-y-2">
      <ErrorText message={error} />
      <button
        disabled={busy}
        className={buttonClass}
        onClick={() =>
          void run(() =>
            sendJson(`/api/students/${student.id}`, 'PATCH', { isActive: !student.isActive }),
          )
        }
      >
        {student.isActive ? 'Deactivate student' : 'Reactivate student'}
      </button>
    </div>
  );
}

export function LinkParentForm({
  studentId,
  options,
}: {
  studentId: string;
  options: { id: string; label: string }[];
}) {
  const { error, busy, run } = useMutation();
  if (options.length === 0) return <p>No other parents available. Add one under Parents.</p>;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const parentId = new FormData(e.currentTarget).get('parentId');
        void run(() => sendJson(`/api/students/${studentId}/parents`, 'POST', { parentId }));
      }}
    >
      <div>
        <label htmlFor="link-parent-select">Parent</label>
        <select id="link-parent-select" name="parentId" required className={inputClass}>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <ErrorText message={error} />
      <button disabled={busy} className={buttonClass}>
        Link parent
      </button>
    </form>
  );
}

export function UnlinkParentButton({
  studentId,
  parentId,
}: {
  studentId: string;
  parentId: string;
}) {
  const { error, busy, run } = useMutation();
  return (
    <span>
      <button
        disabled={busy}
        className="underline"
        onClick={() =>
          void run(() => sendJson(`/api/students/${studentId}/parents/${parentId}`, 'DELETE'))
        }
      >
        Unlink
      </button>
      <ErrorText message={error} />
    </span>
  );
}
