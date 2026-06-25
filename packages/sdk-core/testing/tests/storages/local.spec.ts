import { describe, beforeEach, test, expect } from 'vitest';
import { createLocalStorage } from '../../../src/storages';

describe('createLocalStorage', () => {
	beforeEach(() => {
		globalThis.localStorage?.clear();
	});

	test('should return null when the key does not exist', async () => {
		const storage = createLocalStorage();

		await expect(storage.get('missing')).resolves.toBeNull();
	});

	test('should store and retrieve a value', async () => {
		const storage = createLocalStorage();

		await storage.set('key', 'value');

		await expect(storage.get('key')).resolves.toBe('value');
	});

	test('should overwrite an existing value', async () => {
		const storage = createLocalStorage();

		await storage.set('key', 'value');
		await storage.set('key', 'new-value');

		await expect(storage.get('key')).resolves.toBe('new-value');
	});

	test('should delete a stored value', async () => {
		const storage = createLocalStorage();

		await storage.set('key', 'value');
		await storage.delete('key');

		await expect(storage.get('key')).resolves.toBeNull();
	});

	test('should not throw when deleting a non-existent key', async () => {
		const storage = createLocalStorage();

		await expect(storage.delete('missing')).resolves.toBeUndefined();
	});
});
