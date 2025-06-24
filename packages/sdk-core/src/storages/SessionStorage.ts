import type { SDKStorage } from '../types';

/**
 * Implements session storage operations using the browser's `sessionStorage`.
 */
export class SessionStorage implements SDKStorage {
	/**
	 * Retrieves a value from session storage by key.
	 * @param {string} key The key to retrieve the value for.
	 * @returns {string | null} The value associated with the key, or null if not found.
	 */
	async get(key: string): Promise<string | null> {
		return Promise.resolve(globalThis?.window?.sessionStorage?.getItem(key));
	}

	/**
	 * Deletes a key-value pair from session storage.
	 * @param {string} key The key to delete.
	 */
	async delete(key: string): Promise<void> {
		await Promise.resolve(globalThis?.window?.sessionStorage.removeItem(key));
	}

	/**
	 * Sets a key-value pair in session storage.
	 * @param {string} key The key to set.
	 * @param {string} value The value to associate with the key.
	 */
	async set(key: string, value: string): Promise<void> {
		await Promise.resolve(globalThis?.window?.sessionStorage.setItem(key, value));
	}
}
