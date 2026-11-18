import { describe, it, expect } from 'vitest';
import {
  exceptionCreateSchema,
  scheduleChangeSchema,
  scheduleCreateSchema,
  scheduleEndSchema,
} from './schedule-schemas';

const base = {
  studentId: '00000000-0000-4000-8000-000000000001',
  weekdays: [5, 1, 3, 1],
  startTime: '19:00',
  durationMinutes: 60,
  effectiveFrom: '2026-11-18',
};

describe('scheduleCreateSchema', () => {
  it('dedupes and sorts weekdays, converts the time to minutes, defaults to open-ended', () => {
    const r = scheduleCreateSchema.parse(base);
    expect(r.weekdays).toEqual([1, 3, 5]);
    expect(r.startMinute).toBe(1140);
    expect(r.effectiveTo).toBeNull();
  });

  it('rejects bad times, weekdays, durations and dates', () => {
    for (const startTime of ['7pm', '24:00', '19:60', '']) {
      expect(scheduleCreateSchema.safeParse({ ...base, startTime }).success).toBe(false);
    }
    for (const weekdays of [[], [0], [8], [1.5]]) {
      expect(scheduleCreateSchema.safeParse({ ...base, weekdays }).success).toBe(false);
    }
    for (const durationMinutes of [4, 481, 60.5]) {
      expect(scheduleCreateSchema.safeParse({ ...base, durationMinutes }).success).toBe(false);
    }
    expect(scheduleCreateSchema.safeParse({ ...base, effectiveFrom: '2026-02-30' }).success).toBe(
      false,
    );
  });

  it('rejects an end date before the start date', () => {
    expect(scheduleCreateSchema.safeParse({ ...base, effectiveTo: '2026-11-17' }).success).toBe(
      false,
    );
    expect(scheduleCreateSchema.safeParse({ ...base, effectiveTo: '2026-11-18' }).success).toBe(
      true,
    );
  });
});

describe('other schedule schemas', () => {
  it('parses a change request', () => {
    expect(
      scheduleChangeSchema.parse({
        weekday: 2,
        startTime: '20:30',
        durationMinutes: 45,
        effectiveFrom: '2026-12-01',
      }),
    ).toEqual({ weekday: 2, startMinute: 1230, durationMinutes: 45, effectiveFrom: '2026-12-01' });
  });

  it('requires a valid last date to end a schedule', () => {
    expect(scheduleEndSchema.parse({ lastDate: '2026-12-01' })).toEqual({ lastDate: '2026-12-01' });
    expect(scheduleEndSchema.safeParse({ lastDate: 'tomorrow' }).success).toBe(false);
  });

  it('trims the exception reason and treats blank as null', () => {
    expect(exceptionCreateSchema.parse({ localDate: '2026-11-25', reason: '  Eid ' }).reason).toBe(
      'Eid',
    );
    expect(
      exceptionCreateSchema.parse({ localDate: '2026-11-25', reason: '  ' }).reason,
    ).toBeNull();
    expect(exceptionCreateSchema.parse({ localDate: '2026-11-25' }).reason).toBeNull();
    expect(
      exceptionCreateSchema.safeParse({ localDate: '2026-11-25', reason: 'x'.repeat(201) }).success,
    ).toBe(false);
  });
});
