'use client';
import { WEEKDAYS } from '@/entities/schedule';
import { sendJson } from '@/shared/api/send-json';
import { useMutation } from '@/shared/lib/use-mutation';
import { ErrorText } from '@/shared/ui/error-text';

const inputClass = 'mt-1 w-full rounded border p-2';
const buttonClass = 'rounded bg-black px-4 py-2 text-white disabled:opacity-50';

export function AddScheduleForm({ studentId, today }: { studentId: string; today: string }) {
  const { error, busy, run } = useMutation();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        const effectiveTo = String(f.get('effectiveTo') ?? '');
        void run(
          () =>
            sendJson('/api/schedules', 'POST', {
              studentId,
              weekdays: f.getAll('weekday').map(Number),
              startTime: f.get('startTime'),
              durationMinutes: Number(f.get('durationMinutes')),
              effectiveFrom: f.get('effectiveFrom'),
              effectiveTo: effectiveTo === '' ? null : effectiveTo,
            }),
          () => form.reset(),
        );
      }}
    >
      <fieldset className="space-x-3">
        <legend>Class days</legend>
        {WEEKDAYS.map((d) => (
          <label key={d.value}>
            <input type="checkbox" name="weekday" value={d.value} /> {d.label}
          </label>
        ))}
      </fieldset>
      <label className="block">
        Start time
        <input name="startTime" type="time" required defaultValue="19:00" className={inputClass} />
      </label>
      <label className="block">
        Duration (minutes)
        <input
          name="durationMinutes"
          type="number"
          required
          min={5}
          max={480}
          defaultValue={60}
          className={inputClass}
        />
      </label>
      <label className="block">
        Start date
        <input
          name="effectiveFrom"
          type="date"
          required
          defaultValue={today}
          className={inputClass}
        />
      </label>
      <label className="block">
        End date (optional)
        <input name="effectiveTo" type="date" className={inputClass} />
      </label>
      <ErrorText message={error} />
      <button disabled={busy} className={buttonClass}>
        Add schedule
      </button>
    </form>
  );
}

export function SkipDateForm({ scheduleId, label }: { scheduleId: string; label: string }) {
  const { error, busy, run } = useMutation();
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        void run(
          () =>
            sendJson(`/api/schedules/${scheduleId}/exceptions`, 'POST', {
              localDate: f.get('localDate'),
              reason: f.get('reason'),
            }),
          () => form.reset(),
        );
      }}
    >
      <input
        name="localDate"
        type="date"
        required
        aria-label={`Date to skip (${label})`}
        className="rounded border p-2"
      />
      <input
        name="reason"
        maxLength={200}
        placeholder="Reason (optional)"
        aria-label={`Skip reason (${label})`}
        className="rounded border p-2"
      />
      <button disabled={busy} className={buttonClass}>
        Skip date
      </button>
      <ErrorText message={error} />
    </form>
  );
}

export function EndScheduleForm({
  scheduleId,
  defaultDate,
}: {
  scheduleId: string;
  defaultDate: string;
}) {
  const { error, busy, run } = useMutation();
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const lastDate = new FormData(e.currentTarget).get('lastDate');
        void run(() => sendJson(`/api/schedules/${scheduleId}/end`, 'POST', { lastDate }));
      }}
    >
      <input
        name="lastDate"
        type="date"
        required
        defaultValue={defaultDate}
        aria-label="Last class date"
        className="rounded border p-2"
      />
      <button disabled={busy} className={buttonClass}>
        End schedule
      </button>
      <ErrorText message={error} />
    </form>
  );
}

export function RemoveExceptionButton({ exceptionId }: { exceptionId: string }) {
  const { error, busy, run } = useMutation();
  return (
    <span>
      <button
        disabled={busy}
        className="underline"
        onClick={() =>
          void run(() => sendJson(`/api/schedule-exceptions/${exceptionId}`, 'DELETE'))
        }
      >
        Restore class
      </button>
      <ErrorText message={error} />
    </span>
  );
}
