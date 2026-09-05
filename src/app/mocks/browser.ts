import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

/**
 * The demo ships without a backend: a service worker answers `/api/*` and the
 * data lives in the browser. Point `BookingApi` at a real host and nothing else
 * in the app changes.
 */
export async function startMockApi(): Promise<void> {
  const worker = setupWorker(...handlers);
  await worker.start({
    quiet: true,
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: `${document.baseURI}mockServiceWorker.js` },
  });
}
