import { HttpResponse, delay, http } from 'msw';
import { ApiError, Booking, NewBooking, Role } from '../core/models';
import { DAY_END, DAY_START, MAX_BOOKING_MINUTES, overlaps } from '../core/time';
import { ROOMS, readDb, writeDb } from './db';

/** Kept long enough that loading states are real, short enough to stay pleasant. */
let latencyMs = 260;

/** Tests run the same handlers without the demo latency. */
export function setApiLatency(ms: number): void {
  latencyMs = ms;
}

interface Caller {
  readonly id: string;
  readonly name: string;
  readonly role: Role;
}

function caller(request: Request): Caller {
  return {
    id: request.headers.get('x-user-id') ?? 'anonymous',
    name: request.headers.get('x-user-name') ?? 'Anonymous',
    role: request.headers.get('x-user-role') === 'admin' ? 'admin' : 'employee',
  };
}

function fail(status: number, body: ApiError): HttpResponse<ApiError> {
  return HttpResponse.json(body, { status });
}

export const handlers = [
  http.get('/api/rooms', async () => {
    await delay(latencyMs);
    return HttpResponse.json(ROOMS);
  }),

  http.get('/api/bookings', async ({ request }) => {
    await delay(latencyMs);
    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const scope = url.searchParams.get('scope');
    const who = caller(request);

    if (scope === 'all' && who.role !== 'admin') {
      return fail(403, { message: 'Only an admin can list everyone’s bookings.' });
    }

    const bookings = readDb().bookings.filter(
      (booking) => (!from || booking.date >= from) && (!to || booking.date <= to),
    );

    return HttpResponse.json(sortBookings(bookings));
  }),

  http.post('/api/bookings', async ({ request }) => {
    await delay(latencyMs);
    const who = caller(request);
    const input = (await request.json()) as NewBooking;

    const problem = validate(input);
    if (problem) return fail(422, { message: problem });

    const db = readDb();
    const clash = db.bookings.find(
      (booking) =>
        booking.roomId === input.roomId &&
        booking.date === input.date &&
        overlaps(input.start, input.end, booking.start, booking.end),
    );

    if (clash) {
      return fail(409, {
        message: `${roomName(clash.roomId)} is already taken at that time.`,
        conflict: {
          purpose: clash.purpose,
          ownerName: clash.ownerName,
          start: clash.start,
          end: clash.end,
        },
      });
    }

    const booking: Booking = {
      ...input,
      id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ownerId: who.id,
      ownerName: who.name,
      createdAt: new Date().toISOString(),
    };

    writeDb({ ...db, bookings: [...db.bookings, booking] });
    return HttpResponse.json(booking, { status: 201 });
  }),

  http.delete('/api/bookings/:id', async ({ request, params }) => {
    await delay(latencyMs);
    const who = caller(request);
    const db = readDb();
    const booking = db.bookings.find((item) => item.id === params['id']);

    if (!booking) {
      return fail(404, { message: 'That booking no longer exists.' });
    }

    // The same rule the UI shows, enforced here as well: hiding the button is
    // not authorisation.
    if (who.role !== 'admin' && booking.ownerId !== who.id) {
      return fail(403, {
        message: `Only ${booking.ownerName} or an admin can cancel this booking.`,
      });
    }

    writeDb({ ...db, bookings: db.bookings.filter((item) => item.id !== booking.id) });
    return new HttpResponse(null, { status: 204 });
  }),
];

function validate(input: NewBooking): string | null {
  if (!ROOMS.some((room) => room.id === input.roomId)) return 'Unknown room.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return 'Invalid date.';
  if (input.end <= input.start) return 'The meeting has to end after it starts.';
  if (input.start < DAY_START || input.end > DAY_END) {
    return 'Rooms can only be booked between 08:00 and 20:00.';
  }
  if (input.end - input.start > MAX_BOOKING_MINUTES) {
    return 'A single booking cannot be longer than 4 hours.';
  }
  if (!input.purpose.trim()) return 'Say what the meeting is for.';

  const room = ROOMS.find((item) => item.id === input.roomId);
  if (room && input.attendees > room.capacity) {
    return `${room.name} seats ${room.capacity} people.`;
  }
  return null;
}

function roomName(roomId: string): string {
  return ROOMS.find((room) => room.id === roomId)?.name ?? 'That room';
}

function sortBookings(bookings: readonly Booking[]): Booking[] {
  return [...bookings].sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
}
