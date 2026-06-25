import type { SDKStorage } from '../types/common';

/**
 * Creates a storage adapter that uses the browser's `sessionStorage` API.
 */
export function createSessionStorage(): SDKStorage {
	return {
		get: (key) => Promise.resolve(globalThis.sessionStorage?.getItem(key) ?? null),
		set: (key, value) => {
			globalThis.sessionStorage?.setItem(key, value);

			return Promise.resolve();
		},
		delete: (key) => {
			globalThis.sessionStorage?.removeItem(key);

			return Promise.resolve();
		},
	};
}
