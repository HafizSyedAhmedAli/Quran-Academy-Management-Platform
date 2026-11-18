'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ApiResult } from '@/shared/api/send-json';

export function useMutation() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run<T>(request: () => Promise<ApiResult<T>>, onSuccess?: () => void) {
    setBusy(true);
    setError(null);
    const result = await request();
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSuccess?.();
    router.refresh();
  }

  return { error, busy, run };
}
