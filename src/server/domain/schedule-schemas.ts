import { z } from 'zod';
import { isValidLocalDate, parseTimeOfDay } from './local-date';

const localDate = z
  .string()
  .refine(isValidLocalDate, { message: 'Enter a valid date (YYYY-MM-DD)' });
const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 19:00');
const weekday = z.number().int().min(1).max(7);
const duration = z
  .number()
  .int()
  .min(5, 'Class must be at least 5 minutes')
  .max(480, 'Class is too long');

export const scheduleCreateSchema = z
  .object({
    studentId: z.string().uuid(),
    weekdays: z.array(weekday).min(1, 'Choose at least one day').max(7),
    startTime: timeOfDay,
    durationMinutes: duration,
    effectiveFrom: localDate,
    effectiveTo: localDate.nullish(),
  })
  .refine((v) => v.effectiveTo == null || v.effectiveTo >= v.effectiveFrom, {
    message: 'End date cannot be before the start date',
  })
  .transform(({ startTime, weekdays, effectiveTo, ...rest }) => ({
    ...rest,
    weekdays: [...new Set(weekdays)].sort((a, b) => a - b),
    startMinute: parseTimeOfDay(startTime),
    effectiveTo: effectiveTo ?? null,
  }));

export const scheduleChangeSchema = z
  .object({ weekday, startTime: timeOfDay, durationMinutes: duration, effectiveFrom: localDate })
  .transform(({ startTime, ...rest }) => ({ ...rest, startMinute: parseTimeOfDay(startTime) }));

export const scheduleEndSchema = z.object({ lastDate: localDate });

export const exceptionCreateSchema = z.object({
  localDate,
  reason: z
    .string()
    .trim()
    .max(200, 'Reason is too long')
    .optional()
    .transform((v) => (v ? v : null)),
});
