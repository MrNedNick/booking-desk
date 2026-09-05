import { Injectable, computed, effect, signal } from '@angular/core';
import { Role, User } from './models';

const STORAGE_KEY = 'booking-desk.role.v1';

/** The signed-in person. The demo keeps one identity and lets you switch its role. */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly currentRole = signal<Role>(readStoredRole());

  readonly user = computed<User>(() => ({
    id: 'u-1',
    name: 'Alex Rivera',
    role: this.currentRole(),
  }));

  readonly role = this.currentRole.asReadonly();
  readonly isAdmin = computed(() => this.currentRole() === 'admin');

  constructor() {
    effect(() => {
      const role = this.currentRole();
      try {
        localStorage.setItem(STORAGE_KEY, role);
      } catch {
        // Private mode or a blocked storage partition: the role simply stops
        // surviving a reload, which must not break the app.
      }
    });
  }

  setRole(role: Role): void {
    this.currentRole.set(role);
  }
}

function readStoredRole(): Role {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'admin' ? 'admin' : 'employee';
  } catch {
    return 'employee';
  }
}
