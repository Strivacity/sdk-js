import { describe, test, expect } from 'vitest';
import { createMemoryStorage } from '../../../src/storages';

describe('createMemoryStorage', () => {
	test('should return null when the key does not exist', async () => {
		const storage = createMemoryStorage();

		await expect(storage.get('missing')).resolves.toBeNull();
	});

	test('should store and retrieve a value', async () => {
		const storage = createMemoryStorage();

		await storage.set('key', 'value');

		await expect(storage.get('key')).resolves.toBe('value');
	});

	test('should overwrite an existing value', async () => {
		const storage = createMemoryStorage();

		await storage.set('key', 'value');
		await storage.set('key', 'new-value');

		await expect(storage.get('key')).resolves.toBe('new-value');
	});

	test('should delete a stored value', async () => {
		const storage = createMemoryStorage();

		await storage.set('key', 'value');
		await storage.delete('key');

		await expect(storage.get('key')).resolves.toBeNull();
	});

	test('should not throw when deleting a non-existent key', async () => {
		const storage = createMemoryStorage();

		await expect(storage.delete('missing')).resolves.toBeUndefined();
	});

	test('should isolate state between separate instances', async () => {
		const storageA = createMemoryStorage();
		const storageB = createMemoryStorage();

		await storageA.set('key', 'value');

		await expect(storageB.get('key')).resolves.toBeNull();
	});
});
