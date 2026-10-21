import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);

configure({ asyncUtilTimeout: 7_000 });

Object.defineProperty(HTMLElement.prototype, 'innerText', {
  configurable: true,
  get() {
    return this.textContent ?? '';
  },
  set(value: string) {
    this.textContent = value;
  },
});

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
afterAll(() => server.close());
