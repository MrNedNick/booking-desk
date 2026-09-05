import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { Booking } from '../core/models';
import { formatDay, formatDuration, formatRange } from '../core/time';
import { Icon } from './icon';

export interface BookingDetailsData {
  readonly booking: Booking;
  readonly roomName: string;
  readonly canCancel: boolean;
  /** Why cancelling is not offered, when it is not. */
  readonly blockedReason?: string;
}

export type BookingDetailsResult = 'cancelled-request' | undefined;

/** Details of one booking, and the confirmation step before it is cancelled. */
@Component({
  selector: 'app-booking-details-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule, Icon],
  template: `
    <h2 mat-dialog-title>{{ data.booking.purpose }}</h2>
    <mat-dialog-content>
      <dl class="facts">
        <div>
          <dt>Room</dt>
          <dd>{{ data.roomName }}</dd>
        </div>
        <div>
          <dt>When</dt>
          <dd>
            {{ day }}, {{ time }}
            <span class="app-muted">({{ length }})</span>
          </dd>
        </div>
        <div>
          <dt>Booked by</dt>
          <dd>{{ data.booking.ownerName }}</dd>
        </div>
        <div>
          <dt>People</dt>
          <dd>{{ data.booking.attendees }}</dd>
        </div>
      </dl>

      @if (!data.canCancel && data.blockedReason) {
        <p class="blocked">
          <app-icon name="lock" [size]="18" />
          <span>{{ data.blockedReason }}</span>
        </p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" mat-dialog-close>Close</button>
      @if (data.canCancel) {
        <button matButton="filled" type="button" (click)="confirmCancel()">Cancel booking</button>
      }
    </mat-dialog-actions>
  `,
  styles: `
    .facts {
      display: grid;
      gap: 0.75rem;
      margin: 0;
      min-width: min(320px, 70vw);
    }
    dt {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
    dd {
      margin: 0;
      font: var(--mat-sys-body-large);
    }
    .blocked {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      margin: 1rem 0 0;
      padding: 0.7rem 0.85rem;
      border-radius: var(--app-radius-sm);
      background: var(--mat-sys-surface-container-high);
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
  `,
})
export class BookingDetailsDialog {
  protected readonly data = inject<BookingDetailsData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<BookingDetailsDialog, BookingDetailsResult>>(MatDialogRef);

  protected readonly day = formatDay(this.data.booking.date, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  protected readonly time = formatRange(this.data.booking.start, this.data.booking.end);
  protected readonly length = formatDuration(this.data.booking.end - this.data.booking.start);

  protected confirmCancel(): void {
    this.dialogRef.close('cancelled-request');
  }
}
