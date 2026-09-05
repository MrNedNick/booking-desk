import { Signal, effect, untracked } from '@angular/core';

interface Reloadable {
  reload(): boolean;
}

/**
 * Refetches a resource when something else changes — a write elsewhere in the
 * app, say. `reload()` rather than a change of params on purpose: params reset
 * the value to the default, which blanks a list before the new one arrives.
 *
 * Call from an injection context (a component field or constructor).
 */
export function reloadOn(source: Signal<unknown>, resource: Reloadable): void {
  let first = true;
  effect(() => {
    source();
    if (first) {
      first = false;
      return;
    }
    untracked(() => resource.reload());
  });
}
