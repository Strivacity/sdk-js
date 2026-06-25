import type { SDKStorage } from '../types/common';

const DEFAULT_DB_NAME = 'sdk-storage';
const DEFAULT_STORE_NAME = 'kv';
const DB_VERSION = 1;

function openDB(dbName: string, storeName: string): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(dbName, DB_VERSION);

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;

			if (!db.objectStoreNames.contains(storeName)) {
				db.createObjectStore(storeName);
			}
		};

		request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
		request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
	});
}

function tx(db: IDBDatabase, storeName: string, mode: IDBTransactionMode): IDBObjectStore {
	return db.transaction(storeName, mode).objectStore(storeName);
}

/**
 * Creates a storage adapter that uses the browser's `IndexedDB` API.
 * Works in both the main thread and in Service Workers.
 *
 * @param {string} [dbName='sdk-storage'] - The name of the IndexedDB database.
 * @param {string} [storeName='kv'] - The name of the object store within the database.
 */
export function createIndexedDBStorage(dbName = DEFAULT_DB_NAME, storeName = DEFAULT_STORE_NAME): SDKStorage {
	let dbPromise: Promise<IDBDatabase> | null = null;

	function getDB(): Promise<IDBDatabase> {
		if (!dbPromise) {
			dbPromise = openDB(dbName, storeName);
		}

		return dbPromise;
	}

	return {
		get: async (key) => {
			const db = await getDB();

			return new Promise((resolve, reject) => {
				const request = tx(db, storeName, 'readonly').get(key);

				request.onsuccess = (event) => resolve((event.target as IDBRequest<string | undefined>).result ?? null);
				request.onerror = (event) => reject((event.target as IDBRequest).error);
			});
		},
		set: async (key, value) => {
			const db = await getDB();

			return new Promise((resolve, reject) => {
				const request = tx(db, storeName, 'readwrite').put(value, key);

				request.onsuccess = () => resolve();
				request.onerror = (event) => reject((event.target as IDBRequest).error);
			});
		},
		delete: async (key) => {
			const db = await getDB();

			return new Promise((resolve, reject) => {
				const request = tx(db, storeName, 'readwrite').delete(key);

				request.onsuccess = () => resolve();
				request.onerror = (event) => reject((event.target as IDBRequest).error);
			});
		},
	};
}
