import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';

/**
 * The demo carries its own API. It is imported dynamically so the mock server
 * lands in its own chunk instead of the initial bundle, and it has to be
 * answering before the first request leaves the app.
 */
async function start(): Promise<void> {
  try {
    const { startMockApi } = await import('./app/mocks/browser');
    await startMockApi();
  } catch {
    // Without a service worker the app still boots; requests then fail
    // visibly through the error state instead of hanging.
  }
  await bootstrapApplication(App, appConfig);
}

void start().catch((error: unknown) => console.error(error));
