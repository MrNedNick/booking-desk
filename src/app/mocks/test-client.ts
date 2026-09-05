import { handlers } from './handlers';

/**
 * Calls the mock API the way the browser would, without a service worker:
 * the request is handed to the same handlers the app runs against, so a test
 * of the rules is a test of the real thing.
 */
export async function callApi(
  method: string,
  path: string,
  options: { headers?: Record<string, string>; body?: unknown } = {},
): Promise<Response> {
  // Same origin the handlers' relative paths are matched against.
  const request = new Request(new URL(path, globalThis.location?.href ?? 'http://localhost/'), {
    method,
    headers: {
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  for (const handler of handlers) {
    const result = await handler.run({ request: request.clone(), requestId: crypto.randomUUID() });
    if (result?.response) return result.response;
  }

  throw new Error(`No mock handler for ${method} ${path}`);
}
