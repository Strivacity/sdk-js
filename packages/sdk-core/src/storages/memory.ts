import type { SDKStorage } from '../types/common';

/**
 * In-memory storage adapter for session data. Not recommended for production use, as session data will be lost on page reload.
 */
export function createMemoryStorage(): SDKStorage {
	const store = new Map<string, string>();

	return {
		get: (key) => Promise.resolve(store.get(key) ?? null),
		set: (key, value) => {
			store.set(key, value);

			return Promise.resolve();
		},
		delete: (key) => {
			store.delete(key);

			return Promise.resolve();
		},
	};
}
