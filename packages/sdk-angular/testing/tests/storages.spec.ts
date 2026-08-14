import { test, expect } from 'vitest';
import * as angularStorages from '../../src/lib/storages';
import * as coreStorages from '@strivacity/sdk-core/storages';

test('re-exports the client-safe storages verbatim from the core sdk', () => {
	const expectedExports = [
		'COOKIE_CONTEXT',
		'COOKIE_CHUNK_SIZE',
		'createCacheAPIStorage',
		'createIndexedDBStorage',
		'createLocalStorage',
		'createMemoryStorage',
		'createServerMemoryStorage',
		'createSessionStorage',
		'createWorkerStorage',
		'handleWorkerStorageRequests',
	];

	expect(Object.keys(angularStorages).sort()).toEqual([...expectedExports].sort());

	for (const key of expectedExports) {
		expect(angularStorages[key as keyof typeof angularStorages]).toBe(coreStorages[key as keyof typeof coreStorages]);
	}
});

test('deliberately omits the server-only storages that need a request/cookie adapter', () => {
	// these live in @strivacity/sdk-angular/server instead, where a request adapter is available
	expect(angularStorages).not.toHaveProperty('createEncryptedCookieStorage');
	expect(angularStorages).not.toHaveProperty('createServerStateStorage');
	expect(angularStorages).not.toHaveProperty('createSessionIdCookieStorage');
});
