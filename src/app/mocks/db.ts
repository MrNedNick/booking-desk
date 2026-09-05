import { Booking, Room } from '../core/models';
import { addDays, startOfWeek, today } from '../core/time';

const STORAGE_KEY = 'booking-desk.db.v1';

export const ROOMS: readonly Room[] = [
  { id: 'r-1', name: 'Aster', floor: 2, capacity: 4, features: ['display'] },
  { id: 'r-2', name: 'Birch', floor: 2, capacity: 8, features: ['display', 'whiteboard'] },
  { id: 'r-3', name: 'Cedar', floor: 3, capacity: 12, features: ['display', 'whiteboard', 'video'] },
  { id: 'r-4', name: 'Dune', floor: 3, capacity: 6, features: ['video'] },
  { id: 'r-5', name: 'Elm', floor: 4, capacity: 20, features: ['display', 'video'] },
  { id: 'r-6', name: 'Fern', floor: 4, capacity: 2, features: [] },
];

interface Db {
  seededWeek: string;
  bookings: Booking[];
}

interface SeedEntry {
  readonly day: number;
  readonly roomId: string;
  readonly start: number;
  readonly end: number;
  readonly purpose: string;
  readonly attendees: number;
  readonly ownerId: string;
  readonly ownerName: string;
}

/**
 * Colleagues' meetings, so the schedule looks like a working week from the
 * first second. Nothing here belongs to the demo user — their own list starts
 * empty on purpose.
 */
const SEED: readonly SeedEntry[] = [
  { day: 0, roomId: 'r-3', start: 9 * 60, end: 10 * 60, purpose: 'Sprint planning', attendees: 9, ownerId: 'u-2', ownerName: 'Priya Raman' },
  { day: 0, roomId: 'r-1', start: 11 * 60, end: 11 * 60 + 30, purpose: 'Design review', attendees: 3, ownerId: 'u-3', ownerName: 'Tomas Neruda' },
  { day: 0, roomId: 'r-5', start: 14 * 60, end: 16 * 60, purpose: 'All-hands rehearsal', attendees: 18, ownerId: 'u-4', ownerName: 'Ines Okafor' },
  { day: 1, roomId: 'r-2', start: 10 * 60, end: 11 * 60, purpose: 'Onboarding: week one', attendees: 5, ownerId: 'u-5', ownerName: 'Marek Dvorak' },
  { day: 1, roomId: 'r-4', start: 13 * 60, end: 14 * 60, purpose: 'Customer call — Northwind', attendees: 4, ownerId: 'u-6', ownerName: 'Hana Sato' },
  { day: 1, roomId: 'r-3', start: 15 * 60 + 30, end: 17 * 60, purpose: 'Architecture sync', attendees: 7, ownerId: 'u-2', ownerName: 'Priya Raman' },
  { day: 2, roomId: 'r-1', start: 9 * 60 + 30, end: 10 * 60, purpose: 'One-on-one', attendees: 2, ownerId: 'u-3', ownerName: 'Tomas Neruda' },
  { day: 2, roomId: 'r-5', start: 11 * 60, end: 12 * 60 + 30, purpose: 'Quarterly numbers', attendees: 16, ownerId: 'u-4', ownerName: 'Ines Okafor' },
  { day: 2, roomId: 'r-2', start: 16 * 60, end: 17 * 60, purpose: 'Retro', attendees: 8, ownerId: 'u-5', ownerName: 'Marek Dvorak' },
  { day: 3, roomId: 'r-3', start: 10 * 60, end: 11 * 60 + 30, purpose: 'Roadmap workshop', attendees: 11, ownerId: 'u-6', ownerName: 'Hana Sato' },
  { day: 3, roomId: 'r-6', start: 12 * 60, end: 12 * 60 + 30, purpose: 'Recruiting screen', attendees: 2, ownerId: 'u-7', ownerName: 'Luis Ferreira' },
  { day: 3, roomId: 'r-4', start: 15 * 60, end: 16 * 60, purpose: 'Vendor demo', attendees: 5, ownerId: 'u-2', ownerName: 'Priya Raman' },
  { day: 4, roomId: 'r-2', start: 9 * 60, end: 10 * 60, purpose: 'Support handover', attendees: 6, ownerId: 'u-3', ownerName: 'Tomas Neruda' },
  { day: 4, roomId: 'r-5', start: 13 * 60, end: 14 * 60, purpose: 'Town hall', attendees: 20, ownerId: 'u-4', ownerName: 'Ines Okafor' },
  { day: 4, roomId: 'r-1', start: 16 * 60 + 30, end: 17 * 60 + 30, purpose: 'Friday demo', attendees: 4, ownerId: 'u-5', ownerName: 'Marek Dvorak' },
];

function seedBookings(monday: string): Booking[] {
  const weeks = [monday, addDays(monday, 7)];
  return weeks.flatMap((weekStart, weekIndex) =>
    SEED.map((entry) => ({
      id: `seed-${weekIndex}-${entry.day}-${entry.roomId}-${entry.start}`,
      roomId: entry.roomId,
      date: addDays(weekStart, entry.day),
      start: entry.start,
      end: entry.end,
      purpose: entry.purpose,
      attendees: entry.attendees,
      ownerId: entry.ownerId,
      ownerName: entry.ownerName,
      createdAt: new Date().toISOString(),
    })),
  );
}

function emptyDb(monday: string): Db {
  return { seededWeek: monday, bookings: seedBookings(monday) };
}

/**
 * Reads the database, re-seeding colleagues' meetings when the calendar has
 * moved on to another week. Bookings made by the demo user are never dropped,
 * so their own work survives both a reload and a change of week.
 */
export function readDb(): Db {
  const monday = startOfWeek(today());
  const stored = readStored();

  if (!stored || !Array.isArray(stored.bookings)) {
    const fresh = emptyDb(monday);
    writeDb(fresh);
    return fresh;
  }

  if (stored.seededWeek !== monday) {
    const own = stored.bookings.filter((booking) => !booking.id.startsWith('seed-'));
    const refreshed: Db = { seededWeek: monday, bookings: [...seedBookings(monday), ...own] };
    writeDb(refreshed);
    return refreshed;
  }

  return stored;
}

function readStored(): Db | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Db) : null;
  } catch {
    return null;
  }
}

export function writeDb(db: Db): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Nothing to do: the demo keeps running in memory for this tab.
  }
}

/** Used by the tests to start from a known state. */
export function resetDb(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignored — see `writeDb`.
  }
}
