import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { BookingApi } from '../../core/api';
import { BookingStore } from '../../core/booking-store';
import { reloadOn } from '../../core/reload-on';
import { Booking } from '../../core/models';
import { addDays, formatDay, isPast, today } from '../../core/time';
import { BookingCard } from '../../shared/booking-card';
import {
  BookingDetailsData,
  BookingDetailsDialog,
  BookingDetailsResult,
} from '../../shared/booking-details-dialog';
import { EmptyState } from '../../shared/empty-state';
import { ErrorState } from '../../shared/error-state';
import { Skeleton } from '../../shared/skeleton';

interface DayGroup {
  readonly date: string;
  readonly label: string;
  readonly bookings: readonly Booking[];
}

/** Admin-only: everyone's bookings, and the right to cancel any of them. */
@Component({
  selector: 'app-admin-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, BookingCard, EmptyState, ErrorState, Skeleton],
  templateUrl: './admin-page.html',
  styleUrl: './admin-page.scss',
})
export class AdminPage {
  private readonly api = inject(BookingApi);
  private readonly store = inject(BookingStore);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly cancelling = signal<string | null>(null);

  // `scope=all` is rejected by the server for anyone who is not an admin.
  private readonly resource = rxResource<Booking[], void>({
    stream: () => this.api.bookings({ from: today(), to: addDays(today(), 27), scope: 'all' }),
    defaultValue: [],
  });

  constructor() {
    reloadOn(this.store.changes, this.resource);
  }

  protected readonly loading = this.resource.isLoading;
  protected readonly error = computed(() => {
    const error = this.resource.error();
    return error instanceof Error ? error.message : null;
  });

  private readonly upcoming = computed(() =>
    this.resource.value().filter((booking) => !isPast(booking.date, booking.end)),
  );

  protected readonly groups = computed<DayGroup[]>(() => {
    const byDate = new Map<string, Booking[]>();
    for (const booking of this.upcoming()) {
      const list = byDate.get(booking.date) ?? [];
      list.push(booking);
      byDate.set(booking.date, list);
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, bookings]) => ({
        date,
        label: formatDay(date, { weekday: 'long', day: 'numeric', month: 'long' }),
        bookings: [...bookings].sort((a, b) => a.start - b.start),
      }));
  });

  protected readonly stats = computed(() => {
    const bookings = this.upcoming();
    const minutes = bookings.reduce((sum, booking) => sum + (booking.end - booking.start), 0);
    const perRoom = new Map<string, number>();
    for (const booking of bookings) {
      perRoom.set(booking.roomId, (perRoom.get(booking.roomId) ?? 0) + 1);
    }
    const busiest = [...perRoom.entries()].sort(([, a], [, b]) => b - a)[0];
    return {
      total: bookings.length,
      hours: Math.round(minutes / 6) / 10,
      busiest: busiest ? this.store.roomName(busiest[0]) : '—',
      people: new Set(bookings.map((booking) => booking.ownerId)).size,
    };
  });

  protected roomName(booking: Booking): string {
    return this.store.roomName(booking.roomId);
  }

  protected retry(): void {
    this.resource.reload();
  }

  protected async confirmCancel(booking: Booking): Promise<void> {
    const data: BookingDetailsData = {
      booking,
      roomName: this.roomName(booking),
      canCancel: true,
    };

    const result = await new Promise<BookingDetailsResult>((resolve) => {
      this.dialog
        .open<BookingDetailsDialog, BookingDetailsData, BookingDetailsResult>(BookingDetailsDialog, {
          data,
          autoFocus: 'dialog',
        })
        .afterClosed()
        .subscribe((value) => resolve(value));
    });

    if (result !== 'cancelled-request') return;

    this.cancelling.set(booking.id);
    try {
      await this.store.cancel(booking.id);
      this.snackBar.open(
        `Cancelled “${booking.purpose}” (${booking.ownerName}).`,
        'Dismiss',
        { duration: 5000 },
      );
    } catch (error) {
      this.snackBar.open(
        error instanceof Error ? error.message : 'The booking could not be cancelled.',
        'Dismiss',
        { duration: 7000 },
      );
    } finally {
      this.cancelling.set(null);
    }
  }
}
