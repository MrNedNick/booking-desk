import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { BookingApi } from '../../core/api';
import { BookingStore } from '../../core/booking-store';
import { Booking } from '../../core/models';
import { reloadOn } from '../../core/reload-on';
import { SessionService } from '../../core/session';
import { addDays, isPast, today } from '../../core/time';
import { BookingCard } from '../../shared/booking-card';
import {
  BookingDetailsData,
  BookingDetailsDialog,
  BookingDetailsResult,
} from '../../shared/booking-details-dialog';
import { EmptyState } from '../../shared/empty-state';
import { ErrorState } from '../../shared/error-state';
import { Icon } from '../../shared/icon';
import { Skeleton } from '../../shared/skeleton';

type Filter = 'upcoming' | 'past';

@Component({
  selector: 'app-my-bookings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    BookingCard,
    EmptyState,
    ErrorState,
    Icon,
    Skeleton,
  ],
  templateUrl: './my-bookings-page.html',
  styleUrl: './my-bookings-page.scss',
})
export class MyBookingsPage {
  private readonly api = inject(BookingApi);
  private readonly store = inject(BookingStore);
  private readonly session = inject(SessionService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly filter = signal<Filter>('upcoming');
  protected readonly cancelling = signal<string | null>(null);

  private readonly resource = rxResource<Booking[], string>({
    params: () => this.session.user().id,
    stream: () => this.api.bookings({ from: addDays(today(), -180), to: addDays(today(), 365) }),
    defaultValue: [],
  });

  constructor() {
    // A booking cancelled from the schedule has to disappear from this list too.
    reloadOn(this.store.changes, this.resource);
  }

  protected readonly loading = this.resource.isLoading;
  protected readonly error = computed(() => {
    const error = this.resource.error();
    return error instanceof Error ? error.message : null;
  });

  private readonly mine = computed(() =>
    this.resource.value().filter((booking) => booking.ownerId === this.session.user().id),
  );

  protected readonly upcoming = computed(() =>
    this.mine().filter((booking) => !isPast(booking.date, booking.end)),
  );

  protected readonly past = computed(() =>
    this.mine()
      .filter((booking) => isPast(booking.date, booking.end))
      .reverse(),
  );

  protected readonly visible = computed(() =>
    this.filter() === 'upcoming' ? this.upcoming() : this.past(),
  );

  protected readonly hasAny = computed(() => this.mine().length > 0);

  protected setFilter(value: Filter): void {
    this.filter.set(value);
  }

  protected retry(): void {
    this.resource.reload();
  }

  protected roomName(booking: Booking): string {
    return this.store.roomName(booking.roomId);
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
      this.snackBar.open(`“${booking.purpose}” was cancelled.`, 'Dismiss', { duration: 5000 });
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
