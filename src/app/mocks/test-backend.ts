import { HttpBackend, HttpErrorResponse, HttpEvent, HttpRequest, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, from, switchMap } from 'rxjs';
import { callApi } from './test-client';

/**
 * Test-only transport: sends requests to the same mock handlers the browser
 * hits through the service worker. Interceptors, the API client and the server
 * rules all run for real; only the network is short-circuited.
 */
@Injectable()
export class MockApiBackend implements HttpBackend {
  handle(request: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
    const headers: Record<string, string> = {};
    for (const name of request.headers.keys()) {
      const value = request.headers.get(name);
      if (value !== null) headers[name] = value;
    }

    return from(
      callApi(request.method, request.urlWithParams, {
        headers,
        body: request.body === null ? undefined : request.body,
      }),
    ).pipe(
      switchMap(async (response) => {
        const text = await response.text();
        const body: unknown = text ? JSON.parse(text) : null;

        if (!response.ok) {
          throw new HttpErrorResponse({
            status: response.status,
            statusText: response.statusText,
            error: body,
            url: request.url,
          });
        }

        return new HttpResponse({ body, status: response.status, url: request.url });
      }),
    );
  }
}
