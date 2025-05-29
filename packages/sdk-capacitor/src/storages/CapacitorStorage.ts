import type { SDKStorage } from '@strivacity/sdk-core';
import { Preferences } from '@capacitor/preferences';

/**
 * Implements storage operations using Capacitor's Preferences API.
 */
export class CapacitorStorage implements SDKStorage {
	/**
	 * Retrieves a value from Preferences by key.
	 * @param {string} key The key to retrieve the value for.
	 * @returns {Promise<string | null>} A promise that resolves to the value associated with the key, or null if not found.
	 */
	async get(key: string): Promise<string | null> {
		const { value } = await Preferences.get({ key });
		return value;
	}

	/**
	 * Deletes a key-value pair from Preferences.
	 * @param {string} key The key to delete.
	 * @returns {Promise<void>} A promise that resolves when the operation is complete.
	 */
	async delete(key: string): Promise<void> {
		await Preferences.remove({ key });
	}

	/**
	 * Sets a key-value pair in Preferences.
	 * @param {string} key The key to set.
	 * @param {string} value The value to associate with the key.
	 * @returns {Promise<void>} A promise that resolves when the operation is complete.
	 */
	async set(key: string, value: string): Promise<void> {
		await Preferences.set({ key, value });
	}
}
