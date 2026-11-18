'use client';
import { sendJson } from '@/shared/api/send-json';
import { useMutation } from '@/shared/lib/use-mutation';
import { ErrorText } from '@/shared/ui/error-text';

const inputClass = 'mt-1 w-full rounded border p-2';

export function AddParentForm() {
  const { error, busy, run } = useMutation();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        void run(
          () =>
            sendJson('/api/parents', 'POST', {
              fullName: f.get('fullName'),
              email: f.get('email'),
              whatsappNumber: f.get('whatsappNumber'),
              password: f.get('password'),
            }),
          () => form.reset(),
        );
      }}
    >
      <label className="block">
        Full name
        <input name="fullName" required maxLength={120} className={inputClass} />
      </label>
      <label className="block">
        Email
        <input name="email" type="email" required className={inputClass} />
      </label>
      <label className="block">
        WhatsApp number
        <input name="whatsappNumber" placeholder="+923001234567" className={inputClass} />
      </label>
      <label className="block">
        Temporary password
        <input name="password" type="password" required minLength={10} className={inputClass} />
      </label>
      <ErrorText message={error} />
      <button disabled={busy} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">
        Add parent
      </button>
    </form>
  );
}
