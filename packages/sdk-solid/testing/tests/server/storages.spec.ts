import type { RequestEvent } from '../../../src/server/types';
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
		const solidStorages = await import('../../../src/server/storages');
		const coreKeys = Object.keys(coreStorages);

		expect(coreKeys.length).toBeGreaterThan(0);
		expect(Object.keys(solidStorages).sort()).toEqual(coreKeys.sort());

		for (const key of coreKeys) {
			if (key === 'createSessionIdCookieStorage') {
				continue;
			}

			expect(solidStorages[key as keyof typeof solidStorages]).toBe(coreStorages[key as keyof typeof coreStorages]);
		}

		expect(solidStorages.createSessionIdCookieStorage).not.toBe(coreStorages.createSessionIdCookieStorage);
	});

	test('createSessionIdCookieStorage forwards the storage and options to the core implementation, with an adapter reading the event request', async () => {
		const solidStorages = await import('../../../src/server/storages');
		const wrapped = { get: vi.fn() };
		vi.mocked(createSessionIdCookieStorageBase).mockReturnValue(wrapped as never);
		const storage = createMockStorage();
		const options = { defaultCookieOptions: { path: '/' } };

		const result = solidStorages.createSessionIdCookieStorage(storage, options);

		expect(result).toBe(wrapped);
		expect(createSessionIdCookieStorageBase).toHaveBeenCalledTimes(1);

		const [adapter, forwardedStorage, forwardedOptions] = vi.mocked(createSessionIdCookieStorageBase).mock.calls[0];
		expect(forwardedStorage).toBe(storage);
		expect(forwardedOptions).toBe(options);

		const request = new Request('https://brandtegrity.io');
		const event: RequestEvent = { request };
		expect(adapter.toRequest(event)).toBe(request);
	});
});
