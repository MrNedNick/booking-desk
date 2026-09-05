import { Injectable, computed, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom, fromEvent } from 'rxjs';
import { BookingApi } from './api';
import { Booking, NewBooking, Room } from './models';
import { SessionService } from './session';
import { WORK_DAYS, addDays, nextWorkingDay, startOfWeek } from './time';

/**
 * The single owner of schedule state.
 *
 * The boundary between the two reactive worlds lives here: RxJS does the I/O
 * (`BookingApi` returns observables), signals hold everything the templates
 * read. `rxResource` is the seam — it turns a request stream into
 * `value / isLoading / error` signals, which is exactly what the loading and
 * error states of the UI need.
 */
@Injectable({ providedIn: 'root' })
export class BookingStore {
  private readonly api = inject(BookingApi);
  private readonly session = inject(SessionService);

  /** Monday of the week on screen. */
  readonly weekStart = signal(startOfWeek(nextWorkingDay()));
  readonly weekEnd = computed(() => addDays(this.weekStart(), WORK_DAYS - 1));

  /** Survives week switching on purpose — you are looking at one room's week. */
  readonly selectedRoomId = signal<string | null>(null);

  /** Bumped after every write, and whenever another tab writes. */
  private readonly revision = signal(0);

  /** Resources outside this store add it to their params to refetch on writes. */
  readonly changes = this.revision.asReadonly();

  // Reference data: loaded once, reloaded only on an explicit refresh.
  private readonly roomsResource = rxResource<Room[], void>({
    stream: () => this.api.rooms(),
    defaultValue: [],
  });

  // Keyed by the week on screen: a new week really is different data, so
  // resetting to empty and showing skeletons is the honest thing to do.
  private readonly bookingsResource = rxResource<Booking[], { from: string; to: string }>({
    params: () => ({ from: this.weekStart(), to: this.weekEnd() }),
    stream: ({ params }) => this.api.bookings(params),
    defaultValue: [],
  });

  readonly rooms = this.roomsResource.value.asReadonly();
  readonly roomsLoading = this.roomsResource.isLoading;
  readonly roomsError = computed(() => messageOf(this.roomsResource.error()));

  readonly weekBookings = this.bookingsResource.value.asReadonly();
  readonly bookingsLoading = this.bookingsResource.isLoading;
  readonly bookingsError = computed(() => messageOf(this.bookingsResource.error()));

  readonly selectedRoom = computed<Room | null>(() => {
    const rooms = this.rooms();
    if (!rooms.length) return null;
    const id = this.selectedRoomId();
    return rooms.find((room) => room.id === id) ?? rooms[0];
  });

  /** Bookings of the selected room only — what the week grid draws. */
  readonly selectedRoomBookings = computed(() => {
    const room = this.selectedRoom();
    if (!room) return [];
    return this.weekBookings().filter((booking) => booking.roomId === room.id);
  });

  constructor() {
    this.watchOtherTabs();
  }

  isMine(booking: Booking): boolean {
    return booking.ownerId === this.session.user().id;
  }

  canCancel(booking: Booking): boolean {
    return this.session.isAdmin() || this.isMine(booking);
  }

  roomName(roomId: string): string {
    return this.rooms().find((room) => room.id === roomId)?.name ?? 'Unknown room';
  }

  selectRoom(roomId: string): void {
    this.selectedRoomId.set(roomId);
  }

  goToWeek(offsetWeeks: number): void {
    this.weekStart.update((monday) => addDays(monday, offsetWeeks * 7));
  }

  goToCurrentWeek(): void {
    this.weekStart.set(startOfWeek(nextWorkingDay()));
  }

  async create(input: NewBooking): Promise<Booking> {
    const created = await firstValueFrom(this.api.create(input));
    this.refresh();
    return created;
  }

  async cancel(id: string): Promise<void> {
    await firstValueFrom(this.api.cancel(id));
    this.refresh();
  }

  /**
   * Re-reads everything currently on screen without blanking it first, and
   * signals the same to resources owned by pages (`changes`).
   */
  refresh(): void {
    this.roomsResource.reload();
    this.bookingsResource.reload();
    this.revision.update((value) => value + 1);
  }

  /**
   * A second tab writes to the same storage; without this the first tab would
   * keep showing a schedule that is no longer true.
   */
  private watchOtherTabs(): void {
    if (typeof window === 'undefined') return;
    fromEvent<StorageEvent>(window, 'storage')
      .pipe(
        filter((event) => event.key === null || event.key.startsWith('booking-desk.db')),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.refresh());
  }
}

function messageOf(error: unknown): string | null {
  if (!error) return null;
  return error instanceof Error ? error.message : 'Something went wrong.';
}
