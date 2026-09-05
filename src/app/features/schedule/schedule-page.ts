import { BreakpointObserver } from '@angular/cdk/layout';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { interval, map, startWith } from 'rxjs';
import { BookingStore } from '../../core/booking-store';
import { Booking, Room } from '../../core/models';
import { SessionService } from '../../core/session';
import {
  DAY_END,
  DAY_START,
  SLOT_MINUTES,
  daySlots,
  formatDay,
  formatRange,
  formatTime,
  isPast,
  minutesSinceMidnight,
  nextWorkingDay,
  startOfWeek,
  today,
  weekDays,
} from '../../core/time';
import {
  BookingDetailsDialog,
  BookingDetailsData,
  BookingDetailsResult,
} from '../../shared/booking-details-dialog';
import { ErrorState } from '../../shared/error-state';
import { Icon } from '../../shared/icon';
import { Skeleton } from '../../shared/skeleton';

/** One booking, already positioned inside its day column. */
interface PlacedBooking {
  readonly booking: Booking;
  readonly top: number;
  readonly height: number;
  readonly mine: boolean;
  readonly label: string;
  readonly time: string;
}

interface DayColumn {
  readonly date: string;
  readonly weekday: string;
  readonly dayLabel: string;
  readonly isToday: boolean;
  readonly isPastDay: boolean;
  readonly placed: readonly PlacedBooking[];
  readonly freeSlots: readonly FreeSlot[];
}

interface FreeSlot {
  readonly start: number;
  readonly label: string;
  readonly past: boolean;
}

const SLOT_PX = 44;

@Component({
  selector: 'app-schedule-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatChipsModule, ErrorState, Icon, Skeleton],
  templateUrl: './schedule-page.html',
  styleUrl: './schedule-page.scss',
})
export class SchedulePage {
  private readonly store = inject(BookingStore);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly breakpoints = inject(BreakpointObserver);

  protected readonly rooms = this.store.rooms;
  protected readonly selectedRoom = this.store.selectedRoom;
  protected readonly loading = computed(() => this.store.roomsLoading() || this.store.bookingsLoading());
  protected readonly error = computed(() => this.store.roomsError() ?? this.store.bookingsError());
  protected readonly slotHeight = SLOT_PX;
  protected readonly cancelling = signal<string | null>(null);

  /**
   * The grid is one tab stop, not one per half hour: arrow keys move between
   * free slots the way they would in any other grid. Tabbing through 120
   * buttons to reach the footer is not "keyboard accessible".
   */
  private readonly slotButtons = viewChildren<ElementRef<HTMLButtonElement>>('slotButton');
  private readonly activeSlot = signal<string | null>(null);

  /** Below this width the grid stops being readable and becomes a list of days. */
  protected readonly isNarrow = toSignal(
    this.breakpoints.observe('(max-width: 820px)').pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  private readonly nowMinutes = toSignal(
    interval(60_000).pipe(
      startWith(0),
      map(() => minutesSinceMidnight()),
    ),
    { initialValue: minutesSinceMidnight() },
  );

  protected readonly timeLabels = daySlots().filter((minute) => minute % 60 === 0).map(formatTime);
  protected readonly totalHeight = ((DAY_END - DAY_START) / SLOT_MINUTES) * SLOT_PX;

  protected readonly weekLabel = computed(() => {
    const days = weekDays(this.store.weekStart());
    const first = formatDay(days[0], { day: 'numeric', month: 'short' });
    const last = formatDay(days[days.length - 1], { day: 'numeric', month: 'short', year: 'numeric' });
    return `${first} – ${last}`;
  });

  /** The week the app opens on: this one, or the next one over a weekend. */
  private readonly homeWeek = computed(() => startOfWeek(nextWorkingDay()));
  protected readonly isCurrentWeek = computed(() => this.store.weekStart() === this.homeWeek());
  protected readonly homeWeekLabel = computed(() =>
    this.homeWeek() === startOfWeek(today()) ? 'Today' : 'Next week',
  );

  protected readonly columns = computed<DayColumn[]>(() => {
    const room = this.selectedRoom();
    const bookings = this.store.selectedRoomBookings();
    const now = today();

    return weekDays(this.store.weekStart()).map((date) => {
      const ofDay = bookings.filter((booking) => booking.date === date);
      const taken = (minute: number) =>
        ofDay.some((booking) => minute >= booking.start && minute < booking.end);

      return {
        date,
        weekday: formatDay(date, { weekday: 'short' }),
        dayLabel: formatDay(date, { day: 'numeric', month: 'short' }),
        isToday: date === now,
        isPastDay: date < now,
        placed: ofDay.map((booking) => ({
          booking,
          top: ((booking.start - DAY_START) / SLOT_MINUTES) * SLOT_PX,
          height: ((booking.end - booking.start) / SLOT_MINUTES) * SLOT_PX,
          mine: this.store.isMine(booking),
          time: formatRange(booking.start, booking.end),
          // Starts with the visible text of the cell, as "label in name" requires.
          label: `${booking.purpose} ${
            this.store.isMine(booking) ? 'You' : booking.ownerName
          } ${formatRange(booking.start, booking.end)}`,
        })),
        freeSlots: daySlots()
          .filter((minute) => !taken(minute))
          .map((minute) => ({
            start: minute,
            past: isPast(date, minute + SLOT_MINUTES),
            label: `Book ${room?.name ?? 'this room'} on ${formatDay(date, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })} at ${formatTime(minute)}`,
          })),
      };
    });
  });

  /** Where to draw the "now" line, or `null` when today is not on screen. */
  protected readonly nowOffset = computed<number | null>(() => {
    const minutes = this.nowMinutes();
    if (!this.isCurrentWeek() || minutes < DAY_START || minutes > DAY_END) return null;
    return ((minutes - DAY_START) / SLOT_MINUTES) * SLOT_PX;
  });

  protected readonly nowLabel = computed(() => formatTime(this.nowMinutes()));

  /** Pixel offset of an hour label (labels are hourly, slots are half-hourly). */
  private readonly firstFreeKey = computed(() => {
    for (const column of this.columns()) {
      const slot = column.freeSlots.find((item) => !item.past);
      if (slot) return slotKey(column.date, slot.start);
    }
    return null;
  });

  /** The single slot in the grid that Tab can reach. */
  protected isActiveSlot(date: string, start: number): boolean {
    return (this.activeSlot() ?? this.firstFreeKey()) === slotKey(date, start);
  }

  protected onSlotKeydown(event: KeyboardEvent, date: string, start: number): void {
    const columns = this.columns();
    const dayIndex = columns.findIndex((column) => column.date === date);
    if (dayIndex < 0) return;

    const inDay = columns[dayIndex].freeSlots.filter((slot) => !slot.past);
    const position = inDay.findIndex((slot) => slot.start === start);
    let target: string | null = null;

    switch (event.key) {
      case 'ArrowDown':
        target = keyOf(columns[dayIndex].date, inDay[position + 1]?.start);
        break;
      case 'ArrowUp':
        target = keyOf(columns[dayIndex].date, inDay[position - 1]?.start);
        break;
      case 'Home':
        target = keyOf(columns[dayIndex].date, inDay[0]?.start);
        break;
      case 'End':
        target = keyOf(columns[dayIndex].date, inDay[inDay.length - 1]?.start);
        break;
      case 'ArrowRight':
      case 'ArrowLeft': {
        const step = event.key === 'ArrowRight' ? 1 : -1;
        for (let index = dayIndex + step; index >= 0 && index < columns.length; index += step) {
          const free = columns[index].freeSlots.filter((slot) => !slot.past);
          if (!free.length) continue;
          // Keep the same time where possible, otherwise the nearest one below.
          const same = free.find((slot) => slot.start >= start) ?? free[free.length - 1];
          target = keyOf(columns[index].date, same.start);
          break;
        }
        break;
      }
      default:
        return;
    }

    if (!target) return;
    event.preventDefault();
    this.activeSlot.set(target);
    this.focusSlot(target);
  }

  private focusSlot(key: string): void {
    // The tabindex has to be on the element before it can take focus.
    queueMicrotask(() => {
      const button = this.slotButtons().find((ref) => ref.nativeElement.dataset['slot'] === key);
      button?.nativeElement.focus();
    });
  }

  protected slotTop(index: number): number {
    return index * 2 * SLOT_PX;
  }

  /** Pixel offset of a slot inside a day column. */
  protected offsetOf(minute: number): number {
    return ((minute - DAY_START) / SLOT_MINUTES) * SLOT_PX;
  }

  /** The CTA opens the form on the week and room already on screen. */
  protected bookNew(): void {
    const days = this.columns().map((column) => column.date);
    const date = days.find((day) => day >= today()) ?? days[0];
    void this.router.navigate(['/book'], {
      queryParams: { roomId: this.selectedRoom()?.id, date },
    });
  }

  protected selectRoom(room: Room): void {
    this.store.selectRoom(room.id);
  }

  protected previousWeek(): void {
    this.store.goToWeek(-1);
  }

  protected nextWeek(): void {
    this.store.goToWeek(1);
  }

  protected goToToday(): void {
    this.store.goToCurrentWeek();
  }

  protected retry(): void {
    this.store.refresh();
  }

  protected book(date: string, start: number): void {
    void this.router.navigate(['/book'], {
      queryParams: { roomId: this.selectedRoom()?.id, date, start },
    });
  }

  protected async openBooking(booking: Booking): Promise<void> {
    const canCancel = this.store.canCancel(booking);
    const data: BookingDetailsData = {
      booking,
      roomName: this.store.roomName(booking.roomId),
      canCancel,
      blockedReason: canCancel
        ? undefined
        : `${booking.ownerName} booked this room. Only they or an admin can cancel it.`,
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
      this.snackBar.open(messageOf(error), 'Dismiss', { duration: 7000 });
    } finally {
      this.cancelling.set(null);
    }
  }

  protected readonly userName = computed(() => this.session.user().name);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'The booking could not be cancelled.';
}

function slotKey(date: string, start: number): string {
  return `${date}|${start}`;
}

function keyOf(date: string, start: number | undefined): string | null {
  return start === undefined ? null : slotKey(date, start);
}
