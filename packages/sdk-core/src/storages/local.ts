import type { SDKStorage } from '../types/common';

/**
 * Creates a storage adapter that uses the browser's `localStorage` API.
 */
export function createLocalStorage(): SDKStorage {
	return {
		get: (key) => Promise.resolve(globalThis.localStorage?.getItem(key) ?? null),
		set: (key, value) => {
			globalThis.localStorage?.setItem(key, value);

			return Promise.resolve();
		},
		delete: (key) => {
			globalThis.localStorage?.removeItem(key);

			return Promise.resolve();
		},
	};
}
