import { describe, beforeEach, test, expect } from 'vitest';
import { createCacheAPIStorage } from '../../../src/storages';

function toCacheKey(url: RequestInfo): string {
	return typeof url === 'string' ? url : url.url;
}

class MockCache implements Partial<Cache> {
	private readonly store = new Map<string, Response>();

	match(url: RequestInfo): Promise<Response | undefined> {
		const response = this.store.get(toCacheKey(url));

		return Promise.resolve(response?.clone());
	}

	put(url: RequestInfo, response: Response): Promise<void> {
		this.store.set(toCacheKey(url), response);

		return Promise.resolve();
	}

	delete(url: RequestInfo): Promise<boolean> {
		return Promise.resolve(this.store.delete(toCacheKey(url)));
	}
}

class MockCacheStorage implements Partial<CacheStorage> {
	private readonly caches = new Map<string, MockCache>();

	open(cacheName: string): Promise<Cache> {
		if (!this.caches.has(cacheName)) {
			this.caches.set(cacheName, new MockCache());
		}

		return Promise.resolve(this.caches.get(cacheName) as unknown as Cache);
	}

	keys(): Promise<string[]> {
		return Promise.resolve([...this.caches.keys()]);
	}

	has(cacheName: string): Promise<boolean> {
		return Promise.resolve(this.caches.has(cacheName));
	}
}

describe('createCacheAPIStorage', () => {
	beforeEach(() => {
		globalThis.caches = new MockCacheStorage() as unknown as CacheStorage;
	});

	test('should return null when the key does not exist', async () => {
		const storage = createCacheAPIStorage();

		await expect(storage.get('missing')).resolves.toBeNull();
	});

	test('should store and retrieve a value', async () => {
		const storage = createCacheAPIStorage();

		await storage.set('key', 'value');

		await expect(storage.get('key')).resolves.toBe('value');
	});

	test('should overwrite an existing value', async () => {
		const storage = createCacheAPIStorage();

		await storage.set('key', 'value');
		await storage.set('key', 'new-value');

		await expect(storage.get('key')).resolves.toBe('new-value');
	});

	test('should delete a stored value', async () => {
		const storage = createCacheAPIStorage();

		await storage.set('key', 'value');
		await storage.delete('key');

		await expect(storage.get('key')).resolves.toBeNull();
	});

	test('should not throw when deleting a non-existent key', async () => {
		const storage = createCacheAPIStorage();

		await expect(storage.delete('missing')).resolves.toBeUndefined();
	});

	test('should use a custom cache name when provided', async () => {
		const storage = createCacheAPIStorage('custom-cache');

		await storage.set('key', 'value');

		await expect(globalThis.caches.has('custom-cache')).resolves.toBe(true);
	});

	test('should isolate values stored under different cache names', async () => {
		const storageA = createCacheAPIStorage('cache-a');
		const storageB = createCacheAPIStorage('cache-b');

		await storageA.set('key', 'value-a');

		await expect(storageB.get('key')).resolves.toBeNull();
	});
});
