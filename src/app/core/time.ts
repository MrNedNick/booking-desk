/**
 * Time helpers. Times are minutes from midnight, days are local `YYYY-MM-DD`
 * strings — never `Date` objects in the model, so a timezone can never shift a
 * meeting to the previous day.
 */

export const SLOT_MINUTES = 30;
export const DAY_START = 8 * 60;
export const DAY_END = 20 * 60;
export const MAX_BOOKING_MINUTES = 4 * 60;
export const WORK_DAYS = 5;

export function toIsoDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function fromIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(iso: string, days: number): string {
  const date = fromIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/** Monday of the week the given day belongs to. */
export function startOfWeek(iso: string): string {
  const date = fromIsoDate(iso);
  const shift = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - shift);
  return toIsoDate(date);
}

export function today(): string {
  return toIsoDate(new Date());
}

/**
 * Today, or the coming Monday when today is a weekend. Opening the app on a
 * Saturday should not land on a week whose every slot has already passed.
 */
export function nextWorkingDay(from: string = today()): string {
  const day = fromIsoDate(from).getDay();
  if (day === 6) return addDays(from, 2);
  if (day === 0) return addDays(from, 1);
  return from;
}

export function weekDays(monday: string, count: number = WORK_DAYS): string[] {
  return Array.from({ length: count }, (_, index) => addDays(monday, index));
}

/** Every bookable slot start of a day: 08:00, 08:30, … 19:30. */
export function daySlots(): number[] {
  const result: number[] = [];
  for (let minute = DAY_START; minute < DAY_END; minute += SLOT_MINUTES) {
    result.push(minute);
  }
  return result;
}

export function formatTime(minutes: number): string {
  const hours = `${Math.floor(minutes / 60)}`.padStart(2, '0');
  const rest = `${minutes % 60}`.padStart(2, '0');
  return `${hours}:${rest}`;
}

export function formatRange(start: number, end: number): string {
  return `${formatTime(start)}–${formatTime(end)}`;
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours && rest) return `${hours} h ${rest} min`;
  if (hours) return `${hours} h`;
  return `${rest} min`;
}

export function formatDay(iso: string, options: Intl.DateTimeFormatOptions): string {
  return fromIsoDate(iso).toLocaleDateString('en-GB', options);
}

export function minutesSinceMidnight(date: Date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** `true` when the slot has already passed and can no longer be booked. */
export function isPast(date: string, end: number): boolean {
  const now = today();
  if (date < now) return true;
  return date === now && end <= minutesSinceMidnight();
}
