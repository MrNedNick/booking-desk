import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Holds the exact space the real content will take, so nothing jumps. */
@Component({
  selector: 'app-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rows" [attr.aria-label]="label()" role="status">
      @for (row of rows(); track $index) {
        <span class="row" [style.height.px]="height()"></span>
      }
    </div>
  `,
  styles: `
    .rows {
      display: grid;
      gap: 0.6rem;
      width: 100%;
    }
    .row {
      display: block;
      border-radius: var(--app-radius-sm);
      background: linear-gradient(
        90deg,
        var(--mat-sys-surface-container) 25%,
        var(--mat-sys-surface-container-high) 37%,
        var(--mat-sys-surface-container) 63%
      );
      background-size: 400% 100%;
      animation: shimmer 1.4s ease infinite;
    }
    @keyframes shimmer {
      0% {
        background-position: 100% 50%;
      }
      100% {
        background-position: 0 50%;
      }
    }
  `,
})
export class Skeleton {
  readonly count = input(3);
  readonly height = input(56);
  readonly label = input('Loading');

  protected readonly rows = () => Array.from({ length: this.count() });
}
