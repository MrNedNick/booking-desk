import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Booking, Role } from '../core/models';
import { addDays, nextWorkingDay, startOfWeek } from '../core/time';
import { resetDb } from './db';
import { setApiLatency } from './handlers';
import { callApi } from './test-client';

/**
 * The mock API is the app's server: these are the rules a UI cannot be trusted
 * to enforce on its own.
 */
const DAY = addDays(startOfWeek(nextWorkingDay()), 1);

function who(role: Role, id = 'u-1', name = 'Alex Rivera'): Record<string, string> {
  return { 'x-user-id': id, 'x-user-name': name, 'x-user-role': role };
}

async function book(
  overrides: Partial<Booking> = {},
  role: Role = 'employee',
  id = 'u-1',
): Promise<Response> {
  return callApi('POST', '/api/bookings', {
    headers: who(role, id),
    body: {
      roomId: 'r-1',
      date: DAY,
      start: 14 * 60,
      end: 15 * 60,
      attendees: 3,
      purpose: 'Design review',
      ...overrides,
    },
  });
}

// The demo latency exists to make loading states visible, not to slow tests.
beforeAll(() => setApiLatency(0));
afterEach(() => resetDb());

describe('booking API', () => {
  it('serves the rooms', async () => {
    const response = await callApi('GET', '/api/rooms', { headers: who('employee') });
    const rooms = (await response.json()) as { name: string }[];
    expect(response.status).toBe(200);
    expect(rooms.map((room) => room.name)).toContain('Cedar');
  });

  it('books a free slot for whoever asked', async () => {
    const response = await book();
    const booking = (await response.json()) as Booking;
    expect(response.status).toBe(201);
    expect(booking.ownerId).toBe('u-1');
    expect(booking.ownerName).toBe('Alex Rivera');
  });

  it('refuses a slot that is taken, and says who has it', async () => {
    await book({ purpose: 'Sprint planning' }, 'employee', 'u-9');
    const response = await book({ start: 14 * 60 + 30, end: 15 * 60 + 30 });
    const body = (await response.json()) as { message: string; conflict: { purpose: string } };

    expect(response.status).toBe(409);
    expect(body.conflict.purpose).toBe('Sprint planning');
    expect(body.message).toContain('Aster');
  });

  it('refuses a booking longer than four hours', async () => {
    const response = await book({ start: 9 * 60, end: 14 * 60 });
    expect(response.status).toBe(422);
    expect(((await response.json()) as { message: string }).message).toContain('4 hours');
  });

  it('refuses more people than the room seats', async () => {
    const response = await book({ attendees: 9 });
    expect(response.status).toBe(422);
    expect(((await response.json()) as { message: string }).message).toContain('seats 4');
  });

  describe('cancelling', () => {
    async function someoneElsesBooking(): Promise<Booking> {
      const created = await book({ purpose: 'Not yours' }, 'employee', 'u-9');
      return (await created.json()) as Booking;
    }

    it('lets people cancel their own booking', async () => {
      const mine = (await (await book()).json()) as Booking;
      const response = await callApi('DELETE', `/api/bookings/${mine.id}`, {
        headers: who('employee'),
      });
      expect(response.status).toBe(204);
    });

    it("refuses to cancel someone else's booking, even called directly", async () => {
      const theirs = await someoneElsesBooking();
      const response = await callApi('DELETE', `/api/bookings/${theirs.id}`, {
        headers: who('employee'),
      });
      expect(response.status).toBe(403);

      const remaining = await callApi('GET', `/api/bookings?from=${DAY}&to=${DAY}`, {
        headers: who('employee'),
      });
      expect(((await remaining.json()) as Booking[]).some((b) => b.id === theirs.id)).toBe(true);
    });

    it('lets an admin cancel anyone', async () => {
      const theirs = await someoneElsesBooking();
      const response = await callApi('DELETE', `/api/bookings/${theirs.id}`, {
        headers: who('admin'),
      });
      expect(response.status).toBe(204);
    });
  });

  it("only lets an admin list everyone's bookings", async () => {
    const asEmployee = await callApi('GET', `/api/bookings?from=${DAY}&to=${DAY}&scope=all`, {
      headers: who('employee'),
    });
    expect(asEmployee.status).toBe(403);

    const asAdmin = await callApi('GET', `/api/bookings?from=${DAY}&to=${DAY}&scope=all`, {
      headers: who('admin'),
    });
    expect(asAdmin.status).toBe(200);
  });
});
