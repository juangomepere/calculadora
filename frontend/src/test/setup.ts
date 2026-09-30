import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './mswServer';

// Restore Node's AbortController/AbortSignal (stashed before jsdom loaded) so the
// signal the API layer passes is one undici's fetch recognizes.
const stash = globalThis as unknown as Record<symbol, unknown>;
const nodeAbortController = stash[Symbol.for('node.AbortController')];
const nodeAbortSignal = stash[Symbol.for('node.AbortSignal')];
if (nodeAbortController) {
  globalThis.AbortController = nodeAbortController as typeof AbortController;
}
if (nodeAbortSignal) {
  globalThis.AbortSignal = nodeAbortSignal as typeof AbortSignal;
}

// jsdom has no matchMedia; the component reads it to decide the default history
// panel state. Stub it as "no match" (mobile-ish) unless a test overrides.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
