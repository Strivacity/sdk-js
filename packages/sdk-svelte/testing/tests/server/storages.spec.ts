import type { RequestEvent } from '@sveltejs/kit';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createSessionIdCookieStorage as createSessionIdCookieStorageBase } from '@strivacity/sdk-core/storages/server';
import * as coreStorages from '@strivacity/sdk-core/storages';
import * as serverStorages from '../../../src/server/storages';

vi.mock('@strivacity/sdk-core/storages/server', async (importOriginal) => ({
	...(await importOriginal<typeof import('@strivacity/sdk-core/storages/server')>()),
	createSessionIdCookieStorage: vi.fn(),
}));

beforeEach(() => {
	vi.mocked(createSessionIdCookieStorageBase).mockReset();
});

test('re-exports storages from the core sdk, alongside its own createSessionIdCookieStorage wrapper', () => {
	const coreKeys = Object.keys(coreStorages);

	expect(coreKeys.length).toBeGreaterThan(0);
	expect(Object.keys(serverStorages).sort()).toEqual(coreKeys.sort());
});

describe('createSessionIdCookieStorage', () => {
	test('forwards the given storage and options to the core implementation, and returns its result', () => {
		const wrapped = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
		vi.mocked(createSessionIdCookieStorageBase).mockReturnValue(wrapped);
		const storage = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
		const options = { defaultCookieOptions: { path: '/custom' } };

		const result = serverStorages.createSessionIdCookieStorage(storage, options);

		expect(result).toBe(wrapped);
		expect(createSessionIdCookieStorageBase).toHaveBeenCalledTimes(1);
		const [, forwardedStorage, forwardedOptions] = vi.mocked(createSessionIdCookieStorageBase).mock.calls[0];
		expect(forwardedStorage).toBe(storage);
		expect(forwardedOptions).toBe(options);
	});

	test('builds a toRequest adapter that reads the request straight off the SvelteKit event', () => {
		vi.mocked(createSessionIdCookieStorageBase).mockReturnValue({} as never);

		serverStorages.createSessionIdCookieStorage({ get: vi.fn(), set: vi.fn(), delete: vi.fn() });

		const [adapter] = vi.mocked(createSessionIdCookieStorageBase).mock.calls[0];
		const request = new Request('https://brandtegrity.io');
		const event = { request } as RequestEvent;

		expect(adapter.toRequest(event)).toBe(request);
	});
});
