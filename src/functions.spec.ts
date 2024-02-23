import 'vitest-fetch-mock';
import { request as requestFunction } from './functions';

describe('request', () => {
	afterEach(() => {
		fetchMock.resetMocks();
	});

	it('should return error', async () => {
		fetchMock.mockRejectOnce(new Error('error'));

		try {
			await requestFunction('HEAD', 'https://test.com');
		} catch (e: any) {
			// src/functions.ts:68
			expect(e.toString()).toEqual('Error: error');
		}
	});

	it('should ', async () => {
		fetchMock.mockResponseOnce(() => Promise.resolve(''));

		const response = await requestFunction('HEAD', 'https://test.com');

		// src/functions.ts:60
		expect(response).toEqual('');
	});

	it('should 2', async () => {
		fetchMock.mockResponseOnce(() => Promise.resolve(JSON.stringify({ test: 'ok' })));

		const response = await requestFunction('HEAD', 'https://test.com');

		// src/functions.ts:63
		expect(response).toEqual({ test: 'ok' });
	});

	it('should 3', async () => {
		fetchMock.mockRejectOnce(() => Promise.resolve({ statusText: 'Error', status: 404 }));

		try {
			await requestFunction('HEAD', 'https://test.com');
			expect(1).toEqual(2);
		} catch (e: any) {
			// src/functions.ts:50
			expect(e).toEqual({ code: 404, message: 'Error' });
		}
	});

	it('should 4', async () => {
		fetchMock.mockResponseOnce(JSON.stringify({ error: 'Error' }), { statusText: 'Status Error', status: 404 });

		try {
			await requestFunction('GET', 'https://test.com');
			expect(1).toEqual(2);
		} catch (e: any) {
			// src/functions.ts:48
			expect(e).toEqual({ code: 404, message: 'Status Error', error: { error: 'Error' } });
		}
	});

	it('should 5', async () => {
		fetchMock.mockResponseOnce('Service is unavailable');

		try {
			await requestFunction('GET', 'https://test.com');
			expect(1).toEqual(2);
		} catch (e: any) {
			// src/functions.ts:67
			expect(e.toString()).toContain('invalid json');
		}
	});
});
