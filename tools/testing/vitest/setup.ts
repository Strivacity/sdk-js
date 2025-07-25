import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from '../mocks/msw';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
