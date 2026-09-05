import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';

const STORAGE_KEY = 'booking-desk.theme.v1';

export type Theme = 'light' | 'dark';

/**
 * Both themes are driven by one `color-scheme` on `<html>`; every colour in the
 * app is a `light-dark()` token, so nothing needs a second stylesheet.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly current = signal<Theme>(readStoredTheme(this.document));

  readonly theme = this.current.asReadonly();

  constructor() {
    effect(() => {
      const theme = this.current();
      this.document.documentElement.dataset['theme'] = theme;
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        // Storage is unavailable — keep the chosen theme for this session only.
      }
    });
  }

  toggle(): void {
    this.current.update((theme) => (theme === 'dark' ? 'light' : 'dark'));
  }
}

/**
 * The inline script in `index.html` has already resolved the theme before the
 * first paint; read it back from the attribute so the two can never disagree.
 */
function readStoredTheme(document: Document): Theme {
  if (document.documentElement.dataset['theme'] === 'dark') return 'dark';
  if (document.documentElement.dataset['theme'] === 'light') return 'light';

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // Fall through to the system preference.
  }
  const prefersDark = document.defaultView?.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}
