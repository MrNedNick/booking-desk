import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Icon } from './icon';

/** What went wrong, in words, and a way out of it. */
@Component({
  selector: 'app-error-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, Icon],
  template: `
    <div class="error" role="alert">
      <span class="badge"><app-icon name="alert" [size]="22" /></span>
      <h3>{{ title() }}</h3>
      <p>{{ message() }}</p>
      <button matButton="filled" type="button" (click)="retry.emit()">Try again</button>
    </div>
  `,
  styles: `
    .error {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 2.5rem 1.25rem;
      text-align: center;
    }
    .badge {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
    h3 {
      font: var(--mat-sys-title-medium);
    }
    p {
      margin: 0 0 0.5rem;
      max-width: 46ch;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-medium);
    }
  `,
})
export class ErrorState {
  readonly title = input('Could not load this');
  readonly message = input.required<string>();
  readonly retry = output<void>();
}
