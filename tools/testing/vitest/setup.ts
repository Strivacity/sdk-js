import { beforeAll, afterAll, beforeEach } from 'vitest';
import { worker } from '../mocks/msw';

beforeAll(() => {
	worker.listen({ onUnhandledRequest: 'error' });
});

beforeEach(() => {
	worker.resetHandlers();
});

afterAll(() => {
	worker.close();
});
