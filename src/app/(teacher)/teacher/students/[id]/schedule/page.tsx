import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/current-actor';
import { NotFoundError } from '@/server/domain/errors';
import { localDateOf } from '@/server/domain/local-date';
import { listSchedulesForStudent } from '@/server/schedules/schedule-queries';
import { getStudentDetail, type StudentDetail } from '@/server/students/teacher-queries';
import { weekdayLabel } from '@/entities/schedule';
import {
  AddScheduleForm,
  EndScheduleForm,
  RemoveExceptionButton,
  SkipDateForm,
} from '@/features/schedule-management';
import { APP_TIMEZONE } from '@/shared/config/app';

export const instant = false;

export default async function StudentSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor('TEACHER');
  const { id } = await params;

  let student: StudentDetail;
  try {
    student = await getStudentDetail(actor, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }

  const schedules = await listSchedulesForStudent(actor, id);
  const today = localDateOf(new Date(), APP_TIMEZONE);

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <Link className="underline" href={`/teacher/students/${student.id}`}>
        ← {student.fullName}
      </Link>
      <h1 className="text-2xl font-semibold">Schedule for {student.fullName}</h1>
      <p className="text-sm text-gray-600">Times are in {APP_TIMEZONE}.</p>

      <AddScheduleForm studentId={student.id} today={today} />

      {schedules.length === 0 ? (
        <p>No schedules yet.</p>
      ) : (
        <ul className="space-y-4">
          {schedules.map((s) => {
            const ended = s.effectiveTo !== null && s.effectiveTo < today;
            const label = `${weekdayLabel(s.weekday)} ${s.startTime}`;
            return (
              <li key={s.id} data-testid="schedule-item" className="space-y-2 rounded border p-3">
                <div>
                  <strong>{label}</strong> · {s.durationMinutes} min · from {s.effectiveFrom}
                  {s.effectiveTo ? ` to ${s.effectiveTo}` : ''}
                  {ended && <span className="ml-2 rounded bg-gray-200 px-1 text-xs">Ended</span>}
                </div>
                {s.exceptions.length > 0 && (
                  <ul className="space-y-1 text-sm">
                    {s.exceptions.map((x) => (
                      <li key={x.id} data-testid="exception-item">
                        Skipped {x.localDate}
                        {x.reason ? ` (${x.reason})` : ''}{' '}
                        <RemoveExceptionButton exceptionId={x.id} />
                      </li>
                    ))}
                  </ul>
                )}
                {!ended && (
                  <div className="space-y-2">
                    <SkipDateForm scheduleId={s.id} label={label} />
                    <EndScheduleForm scheduleId={s.id} defaultDate={today} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
