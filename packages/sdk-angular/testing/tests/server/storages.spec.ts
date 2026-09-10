import type { Request as ExpressRequest } from 'express';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createMockStorage } from '@strivacity/testing/mocks/sdk';
import * as coreStorages from '@strivacity/sdk-core/storages';
import { createSessionIdCookieStorage as createSessionIdCookieStorageBase } from '@strivacity/sdk-core/storages/server';

vi.mock('@strivacity/sdk-core/storages/server', async (importOriginal) => ({
	...(await importOriginal<typeof import('@strivacity/sdk-core/storages/server')>()),
	createSessionIdCookieStorage: vi.fn(),
}));

beforeEach(() => {
	vi.mocked(createSessionIdCookieStorageBase).mockReset();
});

describe('server storages', () => {
	test('re-exports everything from the core storages barrel, with createSessionIdCookieStorage overridden by the local wrapper', async () => {
		const angularStorages = await import('../../../src/server/storages');
		const coreKeys = Object.keys(coreStorages);

		expect(coreKeys.length).toBeGreaterThan(0);
		expect(Object.keys(angularStorages).sort()).toEqual(coreKeys.sort());

		for (const key of coreKeys) {
			if (key === 'createSessionIdCookieStorage') {
				continue;
			}

			expect(angularStorages[key as keyof typeof angularStorages]).toBe(coreStorages[key as keyof typeof coreStorages]);
		}

		expect(angularStorages.createSessionIdCookieStorage).not.toBe(coreStorages.createSessionIdCookieStorage);
	});

	test('createSessionIdCookieStorage forwards the storage and options to the core implementation, with an adapter converting Express requests to standard Requests', async () => {
		const angularStorages = await import('../../../src/server/storages');
		const wrapped = { get: vi.fn() };
		vi.mocked(createSessionIdCookieStorageBase).mockReturnValue(wrapped as never);
		const storage = createMockStorage();
		const options = { defaultCookieOptions: { path: '/' } };

		const result = angularStorages.createSessionIdCookieStorage(storage, options);

		expect(result).toBe(wrapped);
		expect(createSessionIdCookieStorageBase).toHaveBeenCalledTimes(1);

		const [adapter, forwardedStorage, forwardedOptions] = vi.mocked(createSessionIdCookieStorageBase).mock.calls[0];

		expect(forwardedStorage).toBe(storage);
		expect(forwardedOptions).toBe(options);

		const req = { originalUrl: '/callback', protocol: 'https', method: 'GET', headers: {}, get: () => 'brandtegrity.io' } as unknown as ExpressRequest;
		const webRequest = adapter.toRequest(req);

		expect(webRequest.url).toBe('https://brandtegrity.io/callback');
		expect(webRequest.method).toBe('GET');
	});
});
