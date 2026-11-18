'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const data = new FormData(e.currentTarget);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: data.get('email'), password: data.get('password') }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).error ?? 'Login failed');
      return;
    }
    const { role } = (await res.json()) as { role: 'TEACHER' | 'PARENT' };
    router.replace(role === 'TEACHER' ? '/teacher' : '/parent');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto mt-24 max-w-sm space-y-4">
      <h1 className="text-2xl font-semibold">Log in</h1>
      <label className="block">
        Email
        <input name="email" type="email" required className="mt-1 w-full rounded border p-2" />
      </label>
      <label className="block">
        Password
        <input
          name="password"
          type="password"
          required
          className="mt-1 w-full rounded border p-2"
        />
      </label>
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      <button disabled={busy} className="rounded bg-black px-4 py-2 text-white">
        Log in
      </button>
    </form>
  );
}
