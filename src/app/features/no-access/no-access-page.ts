import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Router, RouterLink } from '@angular/router';
import { SessionService } from '../../core/session';
import { Icon } from '../../shared/icon';

/**
 * Where the admin guard sends an employee. A dead end with an explanation beats
 * a silent redirect: the person knows what happened and what to do next.
 */
@Component({
  selector: 'app-no-access-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, RouterLink, Icon],
  template: `
    <section class="app-card panel">
      <span class="badge"><app-icon name="lock" [size]="24" /></span>
      <h1>That page is for admins</h1>
      <p>
        You are signed in as <strong>{{ user().name }}</strong> with the
        <strong>employee</strong> role, so
        <code>{{ from() ?? '/admin' }}</code> is closed to you. Employees see and cancel their own
        bookings; admins see everyone's.
      </p>
      <p class="hint">
        This is a demo, so you can change your own role — the switch is in the header, or use the
        button below.
      </p>
      <div class="actions">
        <a matButton routerLink="/schedule">Back to the schedule</a>
        <button matButton="filled" type="button" (click)="becomeAdmin()">
          Switch to admin and continue
        </button>
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
      max-width: 620px;
      margin-inline: auto;
    }
    .panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.6rem;
      padding: 2.5rem 1.5rem;
      text-align: center;
    }
    .badge {
      display: grid;
      place-items: center;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }
    h1 {
      font: var(--mat-sys-headline-small);
    }
    p {
      margin: 0;
      max-width: 48ch;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-medium);
    }
    .hint {
      font: var(--mat-sys-body-small);
    }
    code {
      padding: 0.05rem 0.35rem;
      border-radius: 5px;
      background: var(--mat-sys-surface-container-high);
      color: var(--mat-sys-on-surface);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      justify-content: center;
      margin-top: 0.75rem;
    }
  `,
})
export class NoAccessPage {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  /** The URL the guard turned away, bound from the query string. */
  readonly from = input<string>();

  protected readonly user = this.session.user;

  protected becomeAdmin(): void {
    this.session.setRole('admin');
    void this.router.navigateByUrl(this.from() ?? '/admin');
  }
}
