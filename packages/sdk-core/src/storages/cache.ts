import type { SDKStorage } from '../types/common';

const DEFAULT_CACHE_NAME = 'strivacity-sdk';
const DUMMY_BASE_URL = 'https://sdk.strivacity/';

/**
 * Creates a storage adapter that uses the browser's `Cache` API (`caches`).
 * Works in both the main thread and in Service Workers.
 *
 * Values are stored as synthetic `Response` objects keyed by a fake URL derived from the storage key.
 *
 * @param {string} [cacheName='sdk-storage'] - The name of the cache bucket to use.
 * @returns {SDKStorage} An object implementing the SDKStorage interface.
 */
export function createCacheAPIStorage(cacheName = DEFAULT_CACHE_NAME): SDKStorage {
	function keyToUrl(key: string): string {
		return DUMMY_BASE_URL + encodeURIComponent(key);
	}

	async function getCache(): Promise<Cache> {
		return globalThis.caches.open(cacheName);
	}

	return {
		get: async (key) => {
			const cache = await getCache();
			const response = await cache.match(keyToUrl(key));

			if (!response) {
				return null;
			}

			return response.text();
		},
		set: async (key, value) => {
			const cache = await getCache();

			await cache.put(keyToUrl(key), new Response(value, { status: 200 }));
		},
		delete: async (key) => {
			const cache = await getCache();

			await cache.delete(keyToUrl(key));
		},
	};
}
