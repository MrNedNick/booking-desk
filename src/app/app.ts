import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SessionService } from './core/session';
import { ThemeService } from './core/theme';
import { Role } from './core/models';
import { Icon } from './shared/icon';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatButtonModule, MatButtonToggleModule, Icon],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly session = inject(SessionService);
  private readonly themeService = inject(ThemeService);

  protected readonly user = this.session.user;
  protected readonly role = this.session.role;
  protected readonly isAdmin = this.session.isAdmin;
  protected readonly theme = this.themeService.theme;
  protected readonly year = new Date().getFullYear();

  protected setRole(role: Role): void {
    this.session.setRole(role);
  }

  protected toggleTheme(): void {
    this.themeService.toggle();
  }
}
