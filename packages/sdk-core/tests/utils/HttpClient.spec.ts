import { describe, test, expect, vi, beforeEach, type MockInstance } from 'vitest';
import { HttpClient } from '../../src/utils/HttpClient';
import { DefaultLogging } from '../../src/utils/Logging';

describe('HttpClient', () => {
	let httpClient: HttpClient;
	let fetchMock: MockInstance;

	beforeEach(() => {
		httpClient = new HttpClient();
		fetchMock = vi.spyOn(global, 'fetch');
	});

	describe('request', () => {
		test('should make a successful request', async () => {
			const mockResponse = {
				headers: new Headers(),
				ok: true,
				status: 200,
				statusText: 'OK',
				url: 'https://example.com/api',
				json: () => ({ data: 'test' }),
				text: () => 'test response',
			};

			fetchMock.mockResolvedValue(mockResponse);

			const response = await httpClient.request('https://example.com/api');

			expect(fetchMock).toHaveBeenCalledWith(new URL('https://example.com/api'), undefined);
			expect(response.ok).toBe(true);
			expect(response.status).toBe(200);
			expect(response.statusText).toBe('OK');
			expect(response.url).toBe('https://example.com/api');
			expect(await response.json()).toEqual({ data: 'test' });
		});

		test('should call text() method correctly', async () => {
			const mockResponse = {
				headers: new Headers(),
				ok: true,
				status: 200,
				statusText: 'OK',
				url: 'https://example.com/api',
				json: () => ({}),
				text: () => 'test text response',
			};

			fetchMock.mockResolvedValue(mockResponse);

			const response = await httpClient.request('https://example.com/api');

			expect(await response.text()).toBe('test text response');
		});

		describe('logging x-event-id header', () => {
			test('should update xEventId when logging is enabled and header is present', async () => {
				const logging = new DefaultLogging();
				httpClient.logging = logging;
				const debugSpy = vi.spyOn(logging, 'debug');

				const mockHeaders = new Headers();
				mockHeaders.set('x-event-id', 'event-123');

				const mockResponse = {
					headers: mockHeaders,
					ok: true,
					status: 200,
					statusText: 'OK',
					url: 'https://example.com/api',
					json: () => ({}),
					text: () => '',
				};

				fetchMock.mockResolvedValue(mockResponse);

				await httpClient.request('https://example.com/api');

				expect(logging.xEventId).toBe('event-123');
				expect(debugSpy).toHaveBeenCalledWith('REQUEST [GET]: https://example.com/api');
				expect(debugSpy).toHaveBeenCalledWith('X-Event-ID updated: event-123');
			});

			test('should not update xEventId when it is already set to the same value', async () => {
				const logging = new DefaultLogging();
				logging.xEventId = 'event-123';
				httpClient.logging = logging;
				const debugSpy = vi.spyOn(logging, 'debug');

				const mockHeaders = new Headers();
				mockHeaders.set('x-event-id', 'event-123');

				const mockResponse = {
					headers: mockHeaders,
					ok: true,
					status: 200,
					statusText: 'OK',
					url: 'https://example.com/api',
					json: () => ({}),
					text: () => '',
				};

				fetchMock.mockResolvedValue(mockResponse);

				await httpClient.request('https://example.com/api');

				expect(logging.xEventId).toBe('event-123');
				expect(debugSpy).toHaveBeenCalledWith('REQUEST [GET]: https://example.com/api');
				expect(debugSpy).not.toHaveBeenCalledWith('X-Event-ID updated: event-123');
			});

			test('should update xEventId when it changes', async () => {
				const logging = new DefaultLogging();
				logging.xEventId = 'event-old';
				httpClient.logging = logging;
				const debugSpy = vi.spyOn(logging, 'debug');

				const mockHeaders = new Headers();
				mockHeaders.set('x-event-id', 'event-new');

				const mockResponse = {
					headers: mockHeaders,
					ok: true,
					status: 200,
					statusText: 'OK',
					url: 'https://example.com/api',
					json: () => ({}),
					text: () => '',
				};

				fetchMock.mockResolvedValue(mockResponse);

				await httpClient.request('https://example.com/api');

				expect(logging.xEventId).toBe('event-new');
				expect(debugSpy).toHaveBeenCalledWith('REQUEST [GET]: https://example.com/api');
				expect(debugSpy).toHaveBeenCalledWith('X-Event-ID updated: event-new');
			});

			test('should not update xEventId when header is not present', async () => {
				const logging = new DefaultLogging();
				httpClient.logging = logging;
				const debugSpy = vi.spyOn(logging, 'debug');

				const mockResponse = {
					headers: new Headers(),
					ok: true,
					status: 200,
					statusText: 'OK',
					url: 'https://example.com/api',
					json: () => ({}),
					text: () => '',
				};

				fetchMock.mockResolvedValue(mockResponse);

				await httpClient.request('https://example.com/api');

				expect(logging.xEventId).toBeUndefined();
				expect(debugSpy).toHaveBeenCalledWith('REQUEST [GET]: https://example.com/api');
				expect(debugSpy).not.toHaveBeenCalledWith(expect.stringContaining('X-Event-ID updated'));
			});
		});
	});
});
