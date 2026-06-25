import 'fake-indexeddb/auto';
import { describe, test, expect, vi } from 'vitest';
import { createIndexedDBStorage } from '../../../src/storages';

type FakeIDBRequest = { onsuccess: ((event: unknown) => void) | null; onerror: ((event: unknown) => void) | null; error: Error };

let dbIndex = 0;

function uniqueDbName(): string {
	return `test-db-${++dbIndex}`;
}

function createFailingRequest(error: Error): FakeIDBRequest {
	const request: FakeIDBRequest = { onsuccess: null, onerror: null, error };

	queueMicrotask(() => request.onerror?.({ target: request }));

	return request;
}

describe('createIndexedDBStorage', () => {
	test('should return null when the key does not exist', async () => {
		const storage = createIndexedDBStorage(uniqueDbName());

		await expect(storage.get('missing')).resolves.toBeNull();
	});

	test('should store and retrieve a value', async () => {
		const storage = createIndexedDBStorage(uniqueDbName());

		await storage.set('key', 'value');

		await expect(storage.get('key')).resolves.toBe('value');
	});

	test('should overwrite an existing value', async () => {
		const storage = createIndexedDBStorage(uniqueDbName());

		await storage.set('key', 'value');
		await storage.set('key', 'new-value');

		await expect(storage.get('key')).resolves.toBe('new-value');
	});

	test('should delete a stored value', async () => {
		const storage = createIndexedDBStorage(uniqueDbName());

		await storage.set('key', 'value');
		await storage.delete('key');

		await expect(storage.get('key')).resolves.toBeNull();
	});

	test('should not throw when deleting a non-existent key', async () => {
		const storage = createIndexedDBStorage(uniqueDbName());

		await expect(storage.delete('missing')).resolves.toBeUndefined();
	});

	test('should use a custom database and store name when provided', async () => {
		const storage = createIndexedDBStorage(uniqueDbName(), 'custom-store');

		await storage.set('key', 'value');

		await expect(storage.get('key')).resolves.toBe('value');
	});

	test('should reuse the same database connection across calls', async () => {
		const storage = createIndexedDBStorage(uniqueDbName());

		await storage.set('key-1', 'value-1');
		await storage.set('key-2', 'value-2');

		await expect(storage.get('key-1')).resolves.toBe('value-1');
		await expect(storage.get('key-2')).resolves.toBe('value-2');
	});

	test('should reject when opening the database fails', async () => {
		const error = new Error('open failed');
		vi.spyOn(indexedDB, 'open').mockImplementation(() => createFailingRequest(error) as unknown as IDBOpenDBRequest);

		const storage = createIndexedDBStorage(uniqueDbName());

		await expect(storage.get('key')).rejects.toBe(error);
	});

	test('should reject when reading a value fails', async () => {
		const storage = createIndexedDBStorage(uniqueDbName());
		const error = new Error('get failed');

		vi.spyOn(IDBObjectStore.prototype, 'get').mockImplementation(() => createFailingRequest(error) as unknown as IDBRequest);

		await expect(storage.get('key')).rejects.toBe(error);
	});

	test('should reject when writing a value fails', async () => {
		const storage = createIndexedDBStorage(uniqueDbName());
		const error = new Error('put failed');

		vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => createFailingRequest(error) as unknown as IDBRequest);

		await expect(storage.set('key', 'value')).rejects.toBe(error);
	});

	test('should reject when deleting a value fails', async () => {
		const storage = createIndexedDBStorage(uniqueDbName());
		const error = new Error('delete failed');

		vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementation(() => createFailingRequest(error) as unknown as IDBRequest);

		await expect(storage.delete('key')).rejects.toBe(error);
	});
});
