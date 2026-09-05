import { describe, expect, it } from 'vitest';
import {
  addDays,
  formatRange,
  isPast,
  nextWorkingDay,
  overlaps,
  startOfWeek,
  toIsoDate,
  weekDays,
} from './time';

describe('time helpers', () => {
  it('takes the Monday of a week, whatever day you give it', () => {
    expect(startOfWeek('2026-09-09')).toBe('2026-09-07');
    expect(startOfWeek('2026-09-07')).toBe('2026-09-07');
    expect(startOfWeek('2026-09-13')).toBe('2026-09-07');
  });

  it('lists the five working days of a week', () => {
    expect(weekDays('2026-09-07')).toEqual([
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
    ]);
  });

  it('moves a weekend on to the coming Monday', () => {
    expect(nextWorkingDay('2026-09-05')).toBe('2026-09-07'); // Saturday
    expect(nextWorkingDay('2026-09-06')).toBe('2026-09-07'); // Sunday
    expect(nextWorkingDay('2026-09-08')).toBe('2026-09-08'); // Tuesday
  });

  it('crosses a month boundary without drifting', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31');
  });

  it('formats a local date without shifting the day in any timezone', () => {
    expect(toIsoDate(new Date(2026, 8, 10, 23, 30))).toBe('2026-09-10');
    expect(toIsoDate(new Date(2026, 8, 10, 0, 15))).toBe('2026-09-10');
  });

  it('treats touching intervals as free, overlapping ones as taken', () => {
    expect(overlaps(600, 660, 660, 720)).toBe(false);
    expect(overlaps(600, 660, 630, 720)).toBe(true);
    expect(overlaps(600, 720, 630, 660)).toBe(true);
  });

  it('knows a finished slot from a future one', () => {
    expect(isPast('2020-01-01', 600)).toBe(true);
    expect(isPast('2999-01-01', 600)).toBe(false);
  });

  it('formats a range the way the grid shows it', () => {
    expect(formatRange(9 * 60 + 30, 11 * 60)).toBe('09:30–11:00');
  });
});
