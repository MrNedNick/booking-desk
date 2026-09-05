import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Booking } from '../core/models';
import { formatDay, formatDuration, formatRange, isPast } from '../core/time';
import { Icon } from './icon';

/** One booking as a row. Used by "My bookings" and by the admin list. */
@Component({
  selector: 'app-booking-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, Icon],
  template: `
    <article class="card" [class.past]="past()">
      <div class="when">
        <span class="day">{{ day() }}</span>
        <span class="time">{{ time() }}</span>
      </div>

      <div class="what">
        <h3>{{ booking().purpose }}</h3>
        <p class="app-muted">
          {{ roomName() }} · {{ length() }} ·
          <span class="attendees"><app-icon name="users" [size]="14" /> {{ booking().attendees }}</span>
          @if (showOwner()) {
            · {{ booking().ownerName }}
          }
        </p>
      </div>

      @if (canCancel() && !past()) {
        <button
          matButton
          type="button"
          class="cancel"
          [disabled]="busy()"
          (click)="cancelBooking.emit(booking())"
        >
          <app-icon name="trash" [size]="16" />
          {{ busy() ? 'Cancelling…' : 'Cancel' }}
        </button>
      }
    </article>
  `,
  styles: `
    .card {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem 1rem;
      align-items: center;
      padding: 0.9rem 1rem;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--app-radius-sm);
      background: var(--mat-sys-surface-container);
    }
    .card.past {
      opacity: 0.72;
    }
    .when {
      display: flex;
      flex-direction: column;
      min-width: 11ch;
    }
    .day {
      font: var(--mat-sys-label-large);
    }
    .time {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
      font-variant-numeric: tabular-nums;
    }
    .what {
      flex: 1 1 14rem;
      min-width: 0;
    }
    h3 {
      font: var(--mat-sys-title-small);
    }
    p {
      margin: 0.15rem 0 0;
    }
    .attendees {
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
      vertical-align: -2px;
    }
    .cancel app-icon {
      margin-inline-end: 0.3rem;
    }
  `,
})
export class BookingCard {
  readonly booking = input.required<Booking>();
  readonly roomName = input.required<string>();
  readonly canCancel = input(false);
  readonly showOwner = input(false);
  readonly busy = input(false);
  readonly cancelBooking = output<Booking>();

  protected readonly day = computed(() =>
    formatDay(this.booking().date, { weekday: 'short', day: 'numeric', month: 'short' }),
  );
  protected readonly time = computed(() => formatRange(this.booking().start, this.booking().end));
  protected readonly length = computed(() =>
    formatDuration(this.booking().end - this.booking().start),
  );
  protected readonly past = computed(() => isPast(this.booking().date, this.booking().end));
}
