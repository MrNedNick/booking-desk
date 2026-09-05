import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { map, of, startWith } from 'rxjs';
import { ApiFailure, BookingApi } from '../../core/api';
import {
  BookingForm,
  BookingFormValue,
  OverlapError,
  endAfterStart,
  maxDuration,
  noOverlap,
  notInThePast,
  withinCapacity,
  withinOpeningHours,
} from '../../core/booking-form';
import { BookingStore } from '../../core/booking-store';
import { Booking } from '../../core/models';
import {
  DAY_END,
  MAX_BOOKING_MINUTES,
  SLOT_MINUTES,
  daySlots,
  formatDuration,
  formatRange,
  formatTime,
  fromIsoDate,
  toIsoDate,
} from '../../core/time';
import { ErrorState } from '../../shared/error-state';
import { Icon, IconName } from '../../shared/icon';

/** One thing wrong with the booking as a whole, ready to render. */
interface Problem {
  readonly icon: IconName;
  readonly text: string;
}

/** What the conflict check needs to know: the room and the day, nothing else. */
interface DayQuery {
  readonly roomId: string | null;
  readonly date: string | null;
}

@Component({
  selector: 'app-booking-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ErrorState,
    Icon,
  ],
  templateUrl: './booking-page.html',
  styleUrl: './booking-page.scss',
})
export class BookingPage {
  private readonly store = inject(BookingStore);
  private readonly api = inject(BookingApi);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  /** Prefilled straight from the slot the person clicked in the schedule. */
  readonly roomId = input<string>();
  readonly date = input<string>();
  readonly start = input<string>();

  protected readonly rooms = this.store.rooms;
  protected readonly slots = daySlots();
  protected readonly endSlots = [...daySlots().slice(1), DAY_END];
  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly minDate = new Date();
  protected readonly maxLength = formatDuration(MAX_BOOKING_MINUTES);

  /**
   * What is already booked in the chosen room on the chosen day. A plain signal
   * so the overlap validator can read it while the form is being built — the
   * resource below fills it in.
   */
  private readonly dayBookings = signal<readonly Booking[]>([]);

  readonly form: BookingForm = new FormGroup(
    {
      roomId: new FormControl<string | null>(null, { validators: [Validators.required] }),
      date: new FormControl<Date | null>(null, { validators: [Validators.required] }),
      start: new FormControl<number | null>(null, { validators: [Validators.required] }),
      end: new FormControl<number | null>(null, { validators: [Validators.required] }),
      attendees: new FormControl<number>(2, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(1), Validators.max(50)],
      }),
      purpose: new FormControl<string>('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(3), Validators.maxLength(80)],
      }),
    },
    {
      validators: [
        endAfterStart,
        withinOpeningHours,
        notInThePast,
        maxDuration(),
        withinCapacity(this.store.rooms),
        noOverlap(this.dayBookings),
      ],
    },
  );

  /**
   * The bridge between the two worlds: a reactive form is an RxJS stream, and
   * everything downstream of it here wants a signal.
   */
  private readonly value = toSignal<BookingFormValue>(
    this.form.valueChanges.pipe(
      map(() => this.form.getRawValue()),
      startWith(this.form.getRawValue()),
    ),
    { requireSync: true },
  );

  /** Changes only when the room or the day changes — typing must not refetch. */
  private readonly query = computed<DayQuery>(
    () => {
      const value = this.value();
      return { roomId: value.roomId, date: value.date ? toIsoDate(value.date) : null };
    },
    { equal: (a, b) => a.roomId === b.roomId && a.date === b.date },
  );

  private readonly dayResource = rxResource<Booking[], DayQuery>({
    params: () => this.query(),
    stream: ({ params }) =>
      params.date && params.roomId
        ? this.api.bookings({ from: params.date, to: params.date })
        : of([]),
    defaultValue: [],
  });

  protected readonly loadingDay = this.dayResource.isLoading;
  protected readonly dayError = computed(() => {
    const error = this.dayResource.error();
    return error instanceof Error ? error.message : null;
  });

  protected readonly selectedRoom = computed(
    () => this.store.rooms().find((room) => room.id === this.value().roomId) ?? null,
  );

  protected readonly length = computed(() => {
    const { start, end } = this.value();
    if (start === null || end === null || end <= start) return null;
    return formatDuration(end - start);
  });

  private readonly overlap = signal<OverlapError | null>(null);
  private readonly groupErrors = signal<ValidationErrors | null>(null);

  /**
   * Cross-field problems belong to the booking, not to any single input, so
   * they are listed together under the form instead of under a control.
   */
  protected readonly problems = computed<Problem[]>(() => {
    const errors = this.groupErrors();
    const list: Problem[] = [];

    if (errors?.['endBeforeStart']) {
      list.push({ icon: 'alert', text: 'The meeting has to end after it starts.' });
    }
    if (errors?.['tooLong']) {
      list.push({ icon: 'alert', text: `Keep a single booking under ${this.maxLength}.` });
    }
    if (errors?.['inThePast']) {
      list.push({ icon: 'alert', text: 'That slot is already in the past.' });
    }
    if (errors?.['outsideHours']) {
      list.push({ icon: 'alert', text: 'Rooms can be booked between 08:00 and 20:00.' });
    }
    const capacity = errors?.['overCapacity'] as { room: string; capacity: number } | undefined;
    if (capacity) {
      list.push({
        icon: 'users',
        text: `${capacity.room} seats ${capacity.capacity} people. Pick a bigger room, or bring fewer people.`,
      });
    }
    const clash = this.overlap();
    if (clash) {
      list.push({ icon: 'lock', text: this.overlapText(clash) });
    }
    return list;
  });

  constructor() {
    // Prefill from the schedule, once the query parameters are bound.
    effect(() => {
      const roomId = this.roomId() ?? this.store.selectedRoom()?.id ?? this.store.rooms()[0]?.id;
      if (roomId && !this.form.controls.roomId.value) {
        this.form.controls.roomId.setValue(roomId);
      }
    });

    effect(() => {
      if (this.form.controls.date.value) return;
      const date = this.date();
      this.form.controls.date.setValue(date ? fromIsoDate(date) : new Date());
    });

    effect(() => {
      if (this.form.controls.start.value !== null) return;
      const requested = Number(this.start() ?? NaN);
      const start = Number.isFinite(requested) ? requested : 9 * 60;
      this.form.controls.start.setValue(start);
      this.form.controls.end.setValue(Math.min(start + SLOT_MINUTES * 2, DAY_END));
    });

    // The day's real contents decide the verdict, so re-validate when they land.
    effect(() => {
      const roomId = this.query().roomId;
      this.dayBookings.set(
        this.dayResource.value().filter((booking) => booking.roomId === roomId),
      );
      this.form.updateValueAndValidity({ emitEvent: false });
      this.syncErrors();
    });

    // …and whenever the person changes something.
    effect(() => {
      this.value();
      this.syncErrors();
    });
  }

  protected label(minutes: number): string {
    return formatTime(minutes);
  }

  protected overlapText(overlap: OverlapError): string {
    return `${overlap.ownerName} has “${overlap.purpose}” here from ${formatRange(
      overlap.start,
      overlap.end,
    )}. Pick another time, or another room.`;
  }

  protected retryDay(): void {
    this.dayResource.reload();
  }

  private syncErrors(): void {
    this.groupErrors.set(this.form.errors);
    this.overlap.set((this.form.errors?.['overlap'] as OverlapError | undefined) ?? null);
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    this.syncErrors();
    if (this.form.invalid || this.submitting()) return;

    const value = this.form.getRawValue();
    if (!value.roomId || !value.date || value.start === null || value.end === null) return;

    this.submitting.set(true);
    this.serverError.set(null);

    try {
      const booking = await this.store.create({
        roomId: value.roomId,
        date: toIsoDate(value.date),
        start: value.start,
        end: value.end,
        attendees: value.attendees,
        purpose: value.purpose.trim(),
      });
      this.snackBar.open(
        `Booked ${this.store.roomName(booking.roomId)}, ${formatRange(booking.start, booking.end)}.`,
        'Dismiss',
        { duration: 5000 },
      );
      void this.router.navigate(['/bookings']);
    } catch (error) {
      // The server has the last word: it sees writes from other tabs and people.
      if (error instanceof ApiFailure) {
        this.serverError.set(error.message);
        if (error.conflict) this.overlap.set(error.conflict);
      } else {
        this.serverError.set('The booking could not be saved. Try again.');
      }
      this.dayResource.reload();
    } finally {
      this.submitting.set(false);
    }
  }
}
