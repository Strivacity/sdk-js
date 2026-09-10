import { test, expect } from 'vitest';
import * as index from '../../../src/storages';

test('should export the correct things', () => {
	const expectedExports = [
		'createCacheAPIStorage',
		'createIndexedDBStorage',
		'createLocalStorage',
		'createMemoryStorage',
		'COOKIE_CONTEXT',
		'COOKIE_CHUNK_SIZE',
		'createServerStateStorage',
		'createServerMemoryStorage',
		'createSessionIdCookieStorage',
		'createEncryptedCookieStorage',
		'createSessionStorage',
		'createWorkerStorage',
		'handleWorkerStorageRequests',
	];

	expect(Object.keys(index)).toEqual(expectedExports);
});
