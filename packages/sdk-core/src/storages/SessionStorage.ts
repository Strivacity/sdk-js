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
	get(key: string) {
		return globalThis?.window?.sessionStorage?.getItem(key);
	}

	/**
	 * Deletes a key-value pair from session storage.
	 * @param {string} key The key to delete.
	 */
	delete(key: string) {
		globalThis?.window?.sessionStorage.removeItem(key);
	}

	/**
	 * Sets a key-value pair in session storage.
	 * @param {string} key The key to set.
	 * @param {string} value The value to associate with the key.
	 */
	set(key: string, value: string) {
		globalThis?.window?.sessionStorage.setItem(key, value);
	}
}
