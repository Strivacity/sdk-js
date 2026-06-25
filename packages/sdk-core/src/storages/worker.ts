import type { SDKStorage } from '../types/common';

type WorkerStorageRequestType = 'get' | 'set' | 'delete';

type WorkerStorageRequest = {
	requestId: string;
	type: WorkerStorageRequestType;
	key: string;
	value?: string;
};

type WorkerStorageResponse = {
	requestId: string;
	result?: string | null;
	error?: string;
};

/**
 * Creates a storage adapter that delegates all operations to a `Worker` via `postMessage`.
 *
 * The Worker must be initialized with {@link handleWorkerStorageRequests} to handle the incoming messages.
 *
 * @example
 * ```ts
 * const worker = new Worker(new URL('./storage.worker.ts', import.meta.url), { type: 'module' });
 * const storage = createWorkerStorage(worker);
 * ```
 *
 * @param {Worker} worker - The Worker instance to communicate with.
 */
export function createWorkerStorage(worker: Worker): SDKStorage {
	let counter = 0;
	const pending = new Map<string, { resolve: (value: string | null) => void; reject: (reason: Error) => void }>();

	worker.addEventListener('message', (event: MessageEvent<WorkerStorageResponse>) => {
		const { requestId, result, error } = event.data;
		const deferred = pending.get(requestId);

		if (!deferred) {
			return;
		}

		pending.delete(requestId);

		if (error !== undefined) {
			deferred.reject(new Error(error));
		} else {
			deferred.resolve(result ?? null);
		}
	});

	function sendMessage(type: WorkerStorageRequestType, key: string, value?: string): Promise<string | null> {
		return new Promise((resolve, reject) => {
			const requestId = `${type}:${++counter}`;

			pending.set(requestId, { resolve, reject });
			worker.postMessage({ requestId, type, key, value } satisfies WorkerStorageRequest);
		});
	}

	return {
		get: async (key) => {
			return await sendMessage('get', key);
		},
		set: async (key, value) => {
			await sendMessage('set', key, value);
		},
		delete: async (key) => {
			await sendMessage('delete', key);
		},
	};
}

/**
 * Sets up a message listener inside a Worker that handles storage requests sent by {@link createWorkerStorage}.
 *
 * Call this once at the top level of your Worker script. The provided `storage` can be any `SDKStorage`
 * implementation - `createIndexedDBStorage` and `createCacheAPIStorage` are the recommended choices
 * because they are natively available inside Workers.
 *
 * @example
 * ```ts
 * import { handleWorkerStorageRequests, createIndexedDBStorage } from '@strivacity/sdk-core/types';
 *
 * handleWorkerStorageRequests(createIndexedDBStorage());
 * ```
 *
 * @param {SDKStorage} storage - The underlying storage to use inside the Worker.
 */
export function handleWorkerStorageRequests(storage: SDKStorage): void {
	(self as unknown as Worker).addEventListener(
		'message',
		(event: MessageEvent<WorkerStorageRequest>) =>
			void (async () => {
				const { requestId, type, key, value } = event.data;

				if (!requestId || !type || !key) {
					return;
				}

				try {
					let result: string | null | undefined;

					if (type === 'get') {
						result = await storage.get(key);
					} else if (type === 'set') {
						await storage.set(key, value!);
					} else if (type === 'delete') {
						await storage.delete(key);
					} else {
						return;
					}

					(self as unknown as Worker).postMessage({ requestId, result } satisfies WorkerStorageResponse);
				} catch (err) {
					const error = err instanceof Error ? err.message : String(err);

					(self as unknown as Worker).postMessage({ requestId, error } satisfies WorkerStorageResponse);
				}
			})(),
	);
}
