import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SessionService } from './session';

/**
 * Sends who is asking with every API call. The mock server authorises against
 * these headers, so tightening a rule in the UI alone is not enough to pass —
 * the same check runs on the other side of the wire.
 */
export const identityInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/')) return next(request);

  const user = inject(SessionService).user();
  return next(
    request.clone({
      setHeaders: {
        'x-user-id': user.id,
        'x-user-name': user.name,
        'x-user-role': user.role,
      },
    }),
  );
};
