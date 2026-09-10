import type { SDKStorage } from '../../../src/types';
import type { WorkerStorageRequest, WorkerStorageResponse } from '../../../src/storages/worker';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { createWorkerStorage, handleWorkerStorageRequests } from '../../../src/storages';

// Simulates a Worker in the same thread: messages posted to one side are dispatched as `message` events on the other.
class MockWorker extends EventTarget implements Partial<Worker> {
	public other!: MockWorker;

	postMessage(message: unknown): void {
		this.other.dispatchEvent(new MessageEvent('message', { data: message }));
	}
}

function createLinkedWorkers(): [mainSide: MockWorker, workerSide: MockWorker] {
	const workerSide = new MockWorker();
	const mainSide = new MockWorker();

	workerSide.other = mainSide;
	mainSide.other = workerSide;

	return [mainSide, workerSide];
}

function createMemoryLikeStorage(): SDKStorage {
	const store = new Map<string, string>();

	return {
		get: (key) => {
			return Promise.resolve(store.get(key) ?? null);
		},
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

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('createWorkerStorage / handleWorkerStorageRequests', () => {
	let mainSide: MockWorker;
	let workerSide: MockWorker;

	beforeEach(() => {
		[mainSide, workerSide] = createLinkedWorkers();
		vi.stubGlobal('self', workerSide);
	});

	test('should return null when the key does not exist', async () => {
		handleWorkerStorageRequests(createMemoryLikeStorage());
		const storage = createWorkerStorage(mainSide);

		await expect(storage.get('missing')).resolves.toBeNull();
	});

	test('should store and retrieve a value', async () => {
		handleWorkerStorageRequests(createMemoryLikeStorage());
		const storage = createWorkerStorage(mainSide);

		await storage.set('key', 'value');

		await expect(storage.get('key')).resolves.toBe('value');
	});

	test('should delete a stored value', async () => {
		handleWorkerStorageRequests(createMemoryLikeStorage());
		const storage = createWorkerStorage(mainSide);

		await storage.set('key', 'value');
		await storage.delete('key');

		await expect(storage.get('key')).resolves.toBeNull();
	});

	test('should reject the pending call when the underlying storage throws', async () => {
		handleWorkerStorageRequests({
			get: () => Promise.reject(new Error('boom')),
			set: () => Promise.resolve(),
			delete: () => Promise.resolve(),
		});
		const storage = createWorkerStorage(mainSide);

		await expect(storage.get('key')).rejects.toThrow('boom');
	});

	test('should ignore incoming messages without a matching pending request', () => {
		createWorkerStorage(mainSide);

		expect(() =>
			mainSide.dispatchEvent(new MessageEvent('message', { data: { requestId: 'unknown', result: 'value' } satisfies WorkerStorageResponse })),
		).not.toThrow();
	});

	test('should ignore malformed requests inside the worker', () => {
		handleWorkerStorageRequests(createMemoryLikeStorage());

		expect(() => workerSide.dispatchEvent(new MessageEvent('message', { data: {} as WorkerStorageRequest }))).not.toThrow();
	});
});
