import { Signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Booking, Room } from './models';
import { DAY_END, DAY_START, MAX_BOOKING_MINUTES, isPast, overlaps, toIsoDate } from './time';

/**
 * The form is typed end to end: the controls below are the only description of
 * a booking form in the app, and every validator reads them through
 * `getRawValue()` — no `any`, no string lookups.
 */
export interface BookingFormControls {
  roomId: FormControl<string | null>;
  date: FormControl<Date | null>;
  start: FormControl<number | null>;
  end: FormControl<number | null>;
  attendees: FormControl<number>;
  purpose: FormControl<string>;
}

export type BookingForm = FormGroup<BookingFormControls>;

export interface BookingFormValue {
  roomId: string | null;
  date: Date | null;
  start: number | null;
  end: number | null;
  attendees: number;
  purpose: string;
}

export interface OverlapError {
  purpose: string;
  ownerName: string;
  start: number;
  end: number;
}

function valueOf(control: AbstractControl): BookingFormValue | null {
  const group = control as BookingForm;
  if (!group.controls?.start) return null;
  return group.getRawValue();
}

/** End strictly after start — the mistake every booking form is judged on. */
export const endAfterStart: ValidatorFn = (control): ValidationErrors | null => {
  const value = valueOf(control);
  if (!value || value.start === null || value.end === null) return null;
  return value.end > value.start ? null : { endBeforeStart: true };
};

export const withinOpeningHours: ValidatorFn = (control): ValidationErrors | null => {
  const value = valueOf(control);
  if (!value || value.start === null || value.end === null) return null;
  return value.start >= DAY_START && value.end <= DAY_END ? null : { outsideHours: true };
};

export const notInThePast: ValidatorFn = (control): ValidationErrors | null => {
  const value = valueOf(control);
  if (!value || !value.date || value.end === null) return null;
  return isPast(toIsoDate(value.date), value.end) ? { inThePast: true } : null;
};

export function maxDuration(limit: number = MAX_BOOKING_MINUTES): ValidatorFn {
  return (control): ValidationErrors | null => {
    const value = valueOf(control);
    if (!value || value.start === null || value.end === null) return null;
    const length = value.end - value.start;
    return length > limit ? { tooLong: { limit, length } } : null;
  };
}

/** A room that seats four is not a room for nine. */
export function withinCapacity(rooms: Signal<readonly Room[]>): ValidatorFn {
  return (control): ValidationErrors | null => {
    const value = valueOf(control);
    if (!value || !value.roomId || !value.attendees) return null;
    const room = rooms().find((item) => item.id === value.roomId);
    if (!room || value.attendees <= room.capacity) return null;
    return { overCapacity: { capacity: room.capacity, room: room.name } };
  };
}

/**
 * Says who took the slot, not just that it is taken. The server checks the same
 * thing again on submit — this one exists so the answer arrives while typing.
 */
export function noOverlap(bookings: Signal<readonly Booking[]>, ignoreId?: string): ValidatorFn {
  return (control): ValidationErrors | null => {
    const value = valueOf(control);
    if (!value || !value.roomId || !value.date || value.start === null || value.end === null) {
      return null;
    }
    const date = toIsoDate(value.date);
    const clash = bookings().find(
      (booking) =>
        booking.id !== ignoreId &&
        booking.roomId === value.roomId &&
        booking.date === date &&
        overlaps(value.start as number, value.end as number, booking.start, booking.end),
    );
    if (!clash) return null;
    const error: OverlapError = {
      purpose: clash.purpose,
      ownerName: clash.ownerName,
      start: clash.start,
      end: clash.end,
    };
    return { overlap: error };
  };
}
