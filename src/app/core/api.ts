import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiError, Booking, NewBooking, Room } from './models';

export interface BookingRange {
  readonly from: string;
  readonly to: string;
  /** Admins can ask for everyone's bookings; the server rejects anyone else. */
  readonly scope?: 'mine' | 'all';
}

/** Thrown instead of `HttpErrorResponse` so components never touch transport types. */
export class ApiFailure extends Error {
  constructor(
    override readonly message: string,
    readonly status: number,
    readonly conflict?: ApiError['conflict'],
  ) {
    super(message);
    this.name = 'ApiFailure';
  }
}

/** The only place that knows the API is HTTP. Swapping the mock server for a real one stops here. */
@Injectable({ providedIn: 'root' })
export class BookingApi {
  private readonly http = inject(HttpClient);

  rooms(): Observable<Room[]> {
    return this.http.get<Room[]>('/api/rooms').pipe(catchError(toApiFailure));
  }

  bookings(range: BookingRange): Observable<Booking[]> {
    let params = new HttpParams().set('from', range.from).set('to', range.to);
    if (range.scope) params = params.set('scope', range.scope);
    return this.http.get<Booking[]>('/api/bookings', { params }).pipe(catchError(toApiFailure));
  }

  create(booking: NewBooking): Observable<Booking> {
    return this.http.post<Booking>('/api/bookings', booking).pipe(catchError(toApiFailure));
  }

  cancel(id: string): Observable<void> {
    return this.http.delete<void>(`/api/bookings/${id}`).pipe(catchError(toApiFailure));
  }
}

function toApiFailure(error: unknown): Observable<never> {
  if (error instanceof HttpErrorResponse) {
    const body = asApiError(error.error);
    const message = body?.message ?? describe(error.status);
    return throwError(() => new ApiFailure(message, error.status, body?.conflict));
  }
  return throwError(() => new ApiFailure('Something went wrong.', 0));
}

function describe(status: number): string {
  if (status === 0) return 'The server did not answer. Check your connection and try again.';
  // A 2xx that reaches here means the body was not the JSON we expected.
  if (status >= 200 && status < 300) {
    return 'The answer could not be read. Reload the page and try again.';
  }
  return `The server refused the request (${status}).`;
}

/**
 * A failed request carries our own error body — or, when the network itself
 * broke, a `TypeError`, whose `message` ("Failed to fetch") must not be shown
 * to anyone.
 */
function asApiError(body: unknown): ApiError | null {
  if (typeof body !== 'object' || body === null || body instanceof Error) return null;
  const candidate = body as Partial<ApiError>;
  return typeof candidate.message === 'string' ? (candidate as ApiError) : null;
}
