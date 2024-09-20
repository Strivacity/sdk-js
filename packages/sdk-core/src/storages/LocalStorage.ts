import type { SDKStorage } from '../types';

/**
 * Implements local storage operations using the browser's `localStorage`.
 */
export class LocalStorage implements SDKStorage {
	/**
	 * Retrieves a value from local storage by key.
	 * @param {string} key The key to retrieve the value for.
	 * @returns {string | null} The value associated with the key, or null if not found.
	 */
	get(key: string) {
		return globalThis?.window?.localStorage?.getItem(key);
	}

	/**
	 * Deletes a key-value pair from local storage.
	 * @param {string} key The key to delete.
	 */
	delete(key: string) {
		globalThis?.window?.localStorage.removeItem(key);
	}

	/**
	 * Sets a key-value pair in local storage.
	 * @param {string} key The key to set.
	 * @param {string} value The value to associate with the key.
	 */
	set(key: string, value: string) {
		globalThis?.window?.localStorage.setItem(key, value);
	}
}
