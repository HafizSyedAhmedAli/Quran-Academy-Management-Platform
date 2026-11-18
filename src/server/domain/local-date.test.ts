import { describe, it, expect } from 'vitest';
import {
  addDays,
  daysBetween,
  formatMinutes,
  isoWeekday,
  isValidLocalDate,
  localDateOf,
  parseTimeOfDay,
  zonedTimeToUtc,
} from './local-date';

describe('local dates', () => {
  it('validates real calendar dates only', () => {
    expect(isValidLocalDate('2026-11-18')).toBe(true);
    expect(isValidLocalDate('2028-02-29')).toBe(true);
    expect(isValidLocalDate('2026-02-29')).toBe(false);
    expect(isValidLocalDate('2026-13-01')).toBe(false);
    expect(isValidLocalDate('18-11-2026')).toBe(false);
  });

  it('adds days across months, years and leap days', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('counts days between dates', () => {
    expect(daysBetween('2026-11-18', '2026-12-16')).toBe(28);
    expect(daysBetween('2026-11-18', '2026-11-18')).toBe(0);
  });

  it('computes ISO weekdays (Monday = 1 ... Sunday = 7)', () => {
    expect(isoWeekday('2026-11-16')).toBe(1);
    expect(isoWeekday('2026-11-18')).toBe(3);
    expect(isoWeekday('2026-11-22')).toBe(7);
  });

  it('parses and formats times of day', () => {
    expect(parseTimeOfDay('19:00')).toBe(1140);
    expect(formatMinutes(1140)).toBe('19:00');
    expect(formatMinutes(5)).toBe('00:05');
  });
});

describe('timezones', () => {
  it('finds the Karachi calendar date of an instant', () => {
    expect(localDateOf(new Date('2026-11-18T18:59:59Z'), 'Asia/Karachi')).toBe('2026-11-18');
    expect(localDateOf(new Date('2026-11-18T19:00:00Z'), 'Asia/Karachi')).toBe('2026-11-19');
  });

  it('converts Karachi wall-clock time to UTC', () => {
    expect(zonedTimeToUtc('2026-11-18', 19 * 60, 'Asia/Karachi').toISOString()).toBe(
      '2026-11-18T14:00:00.000Z',
    );
  });

  it('is not hard-coded to a fixed offset (DST zone check)', () => {
    expect(zonedTimeToUtc('2026-03-07', 19 * 60, 'America/New_York').toISOString()).toBe(
      '2026-03-08T00:00:00.000Z',
    );
    expect(zonedTimeToUtc('2026-03-08', 19 * 60, 'America/New_York').toISOString()).toBe(
      '2026-03-08T23:00:00.000Z',
    );
  });
});
