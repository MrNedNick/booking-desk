import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Icons are inline SVG on purpose: no icon font, no request, nothing to load
 * before the first paint, and they inherit `currentColor` in both themes.
 */
const PATHS = {
  'chevron-left': ['M15 5l-7 7 7 7'],
  'chevron-right': ['M9 5l7 7-7 7'],
  sun: [
    'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    'M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4',
  ],
  moon: ['M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1z'],
  calendar: ['M4 6.5h16v14H4z', 'M8 3.5v4M16 3.5v4M4 11h16'],
  users: ['M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z', 'M3 20.5c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5', 'M17 5.5a3 3 0 0 1 0 6M18 15c2 .6 3.5 2.3 3.5 4.5'],
  check: ['M4.5 12.5l5 5 10-11'],
  close: ['M6 6l12 12M18 6L6 18'],
  trash: ['M4 7h16', 'M9.5 7V4.5h5V7', 'M6.5 7l1 13.5h9L18 7'],
  alert: ['M12 3.5 2.5 20.5h19z', 'M12 10v4.5M12 17.5h.01'],
  plus: ['M12 5.5v13M5.5 12h13'],
  lock: ['M5.5 10.5h13v10h-13z', 'M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3'],
  monitor: ['M3 4.5h18v12H3z', 'M9 20.5h6M12 16.5v4'],
  pen: ['M4 20l4.5-1L20 7.5 16.5 4 5 15.5z'],
  video: ['M3 6.5h11v11H3z', 'M14 11l7-4v10l-7-4'],
  info: ['M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z', 'M12 11v5.5M12 7.8h.01'],
} as const;

export type IconName = keyof typeof PATHS;

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      @for (path of paths(); track path) {
        <path [attr.d]="path" />
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
    }
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(20);

  protected readonly paths = () => PATHS[this.name()];
}
