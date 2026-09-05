import { signal } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import {
  BookingForm,
  endAfterStart,
  maxDuration,
  noOverlap,
  notInThePast,
  withinCapacity,
} from './booking-form';
import { Booking, Room } from './models';

const ROOM: Room = { id: 'r-1', name: 'Aster', floor: 2, capacity: 4, features: [] };

const TAKEN: Booking = {
  id: 'b-1',
  roomId: 'r-1',
  date: '2999-01-04',
  start: 10 * 60,
  end: 11 * 60,
  purpose: 'Sprint planning',
  attendees: 6,
  ownerId: 'u-2',
  ownerName: 'Priya Raman',
  createdAt: '2026-09-01T09:00:00.000Z',
};

function form(values: {
  roomId?: string | null;
  date?: Date | null;
  start?: number | null;
  end?: number | null;
  attendees?: number;
  purpose?: string;
}): BookingForm {
  return new FormGroup({
    roomId: new FormControl<string | null>(values.roomId ?? 'r-1'),
    date: new FormControl<Date | null>(values.date ?? new Date(2999, 0, 4)),
    start: new FormControl<number | null>(values.start ?? 9 * 60),
    end: new FormControl<number | null>(values.end ?? 10 * 60),
    attendees: new FormControl<number>(values.attendees ?? 2, { nonNullable: true }),
    purpose: new FormControl<string>(values.purpose ?? 'Design review', { nonNullable: true }),
  });
}

describe('booking validators', () => {
  it('rejects a meeting that ends before it starts', () => {
    expect(endAfterStart(form({ start: 11 * 60, end: 10 * 60 }))).toEqual({ endBeforeStart: true });
    expect(endAfterStart(form({ start: 10 * 60, end: 11 * 60 }))).toBeNull();
  });

  it('caps a single booking at four hours', () => {
    const validate = maxDuration();
    expect(validate(form({ start: 9 * 60, end: 13 * 60 }))).toBeNull();
    expect(validate(form({ start: 9 * 60, end: 13 * 60 + 30 }))).toMatchObject({
      tooLong: { limit: 240 },
    });
  });

  it('refuses a slot that has already passed', () => {
    expect(notInThePast(form({ date: new Date(2020, 0, 1) }))).toEqual({ inThePast: true });
    expect(notInThePast(form({}))).toBeNull();
  });

  it('will not put nine people in a room that seats four', () => {
    const validate = withinCapacity(signal<readonly Room[]>([ROOM]));
    expect(validate(form({ attendees: 4 }))).toBeNull();
    expect(validate(form({ attendees: 9 }))).toEqual({
      overCapacity: { capacity: 4, room: 'Aster' },
    });
  });

  describe('overlap', () => {
    const validate = noOverlap(signal<readonly Booking[]>([TAKEN]));

    it('says who has the slot, not just that it is taken', () => {
      const errors = validate(form({ start: 10 * 60 + 30, end: 11 * 60 + 30 }));
      expect(errors?.['overlap']).toEqual({
        purpose: 'Sprint planning',
        ownerName: 'Priya Raman',
        start: 600,
        end: 660,
      });
    });

    it('lets a booking start exactly when the previous one ends', () => {
      expect(validate(form({ start: 11 * 60, end: 12 * 60 }))).toBeNull();
      expect(validate(form({ start: 9 * 60, end: 10 * 60 }))).toBeNull();
    });

    it('ignores another room on the same day', () => {
      expect(validate(form({ roomId: 'r-2', start: 10 * 60, end: 11 * 60 }))).toBeNull();
    });
  });
});
