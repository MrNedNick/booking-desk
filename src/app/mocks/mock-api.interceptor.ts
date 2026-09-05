import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, from, switchMap, throwError } from 'rxjs';

const RETRY_HEADER = 'x-mock-restarted';
let restarting: Promise<void> | null = null;

/**
 * The demo API lives in a service worker, and a service worker can be stopped
 * by the browser or taken over by another tab. When that happens the request
 * falls through to the static host, which answers unknown paths with
 * `index.html` — a 200 the app cannot parse. Restart the worker once and send
 * the request again, so a second tab does not leave the first one broken.
 */
export const mockApiInterceptor: HttpInterceptorFn = (request, next) =>
  next(request).pipe(
    catchError((error: unknown) => {
      const recoverable =
        error instanceof HttpErrorResponse &&
        error.status >= 200 &&
        error.status < 300 &&
        !request.headers.has(RETRY_HEADER);

      if (!recoverable) return throwError(() => error);

      // Imported here, not at the top: the mock server must stay out of the
      // initial bundle.
      restarting ??= import('./browser')
        .then((module) => module.startMockApi())
        .finally(() => {
          restarting = null;
        });

      return from(restarting).pipe(
        switchMap(() => next(request.clone({ setHeaders: { [RETRY_HEADER]: '1' } }))),
      );
    }),
  );
