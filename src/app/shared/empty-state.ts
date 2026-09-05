import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon, IconName } from './icon';

/** First visit, cleared storage, a filter that matches nothing — never a blank area. */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div class="empty">
      <span class="badge"><app-icon [name]="icon()" [size]="22" /></span>
      <h3>{{ title() }}</h3>
      <p>{{ hint() }}</p>
      <ng-content />
    </div>
  `,
  styles: `
    .empty {
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
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }
    h3 {
      font: var(--mat-sys-title-medium);
    }
    p {
      margin: 0;
      max-width: 42ch;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-medium);
    }
  `,
})
export class EmptyState {
  readonly title = input.required<string>();
  readonly hint = input.required<string>();
  readonly icon = input<IconName>('calendar');
}
