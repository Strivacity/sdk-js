import { afterAll, afterEach, beforeAll } from 'vitest';
import { mockServer } from './msw';

beforeAll(() => mockServer.listen({ onUnhandledRequest: 'error' }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());
