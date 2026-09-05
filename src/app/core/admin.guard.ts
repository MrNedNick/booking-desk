import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from './session';

/**
 * Admin-only routes. An employee who types the URL by hand lands on a page that
 * explains what happened instead of an empty screen or a silent redirect home.
 */
export const adminGuard: CanActivateFn = (_route, state) => {
  const session = inject(SessionService);
  const router = inject(Router);

  if (session.isAdmin()) return true;

  return router.createUrlTree(['/no-access'], {
    queryParams: { from: state.url },
  });
};
