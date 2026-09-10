import type { SDKStorage } from '../types/common';
import type { EncryptedCookieStorageOptions, ServerAdapter, ServerCookieOptions, ServerStorage, SessionIdCookieStorageOptions } from '../types/server';
import { encryptString, decryptString } from '../utils/crypto';
import { parseCookieHeader, pushSetCookie, serializeCookie } from '../utils/server';

export const COOKIE_CONTEXT = 'strivacity-session-v1';
export const COOKIE_CHUNK_SIZE = 3900;

/**
 * Creates a simple in-memory state storage implementation, shared across all server adapters.
 *
 * @returns {SDKStorage} An object implementing the SDKStorage interface.
 */
export function createServerStateStorage(): SDKStorage {
	globalThis.sty ??= {} as typeof globalThis.sty;
	globalThis.sty.storage ??= new Map<string, string>();

	return {
		async get(key) {
			return Promise.resolve(globalThis.sty.storage?.get(key) ?? null);
		},
		async set(key, value) {
			globalThis.sty.storage?.set(key, value);

			return Promise.resolve();
		},
		async delete(key) {
			globalThis.sty.storage?.delete(key);

			return Promise.resolve();
		},
	};
}

/**
 * In-memory global storage adapter for session data.
 * Not recommended for production use, as session data will be lost on server restart.
 *
 * @returns {ServerStorage} An object implementing the ServerStorage interface.
 */
export function createServerMemoryStorage(): ServerStorage {
	globalThis.sty ??= {} as typeof globalThis.sty;
	globalThis.sty.storage = new Map<string, string>();

	return {
		get: (key) => {
			return Promise.resolve(globalThis.sty.storage!.get(key) ?? null);
		},
		set: (key, value) => {
			globalThis.sty.storage!.set(key, value);

			return Promise.resolve();
		},
		delete: (key) => {
			globalThis.sty.storage!.delete(key);

			return Promise.resolve();
		},
		deleteByLogoutToken: (logoutToken) => {
			for (const [mapKey, raw] of globalThis.sty.storage!) {
				const claims = JSON.parse(raw)?.claims;

				if ((logoutToken.sid && claims?.sid === logoutToken.sid) || (logoutToken.sub && claims?.sub === logoutToken.sub)) {
					globalThis.sty.storage!.delete(mapKey);
				}
			}

			return Promise.resolve();
		},
	};
}

/**
 * Creates a session storage that puts a session-id value cookie on the client and keeping the actual session data in the given `storage`.
 *
 * @param {ServerAdapter<TEvent>} adapter - The framework adapter used to read the incoming request.
 * @param {ServerStorage<TEvent>} storage - The storage used to persist session data, keyed by a randomly generated session id.
 * @param {SessionIdCookieStorageOptions} [options] - Options for the session ID cookie, including default cookie attributes and a UUID generator function.
 * @param {Partial<ServerCookieOptions>} [options.defaultCookieOptions] - Default cookie attributes for the session ID cookie.
 * @param {() => string} [options.uuidGenerator] - Function to generate a new UUID for the session ID. Defaults to `() => crypto.randomUUID()`.
 * @returns {ServerStorage<TEvent>} An object implementing the `ServerStorage` interface for managing sessions indexed by a session-id cookie.
 */
export function createSessionIdCookieStorage<TEvent = unknown>(
	adapter: ServerAdapter<TEvent>,
	storage: ServerStorage,
	options?: SessionIdCookieStorageOptions,
): ServerStorage<TEvent> {
	const defaultCookieOptions: ServerCookieOptions = {
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		path: '/',
		...options?.defaultCookieOptions,
	};

	if (!adapter.getSessionId) {
		adapter.getSessionId = async (key: string, event?: TEvent) => {
			if (!event) {
				return null;
			}

			const request = await adapter.toRequest(event);
			const cookies = parseCookieHeader(request.headers.get('cookie'));

			return cookies[key];
		};
	}

	return {
		async get(key, event) {
			const id = await adapter.getSessionId!(key, event);

			return id ? await storage.get(id) : null;
		},
		async set(key, value, event) {
			let id = await adapter.getSessionId!(key, event);

			if (!id) {
				id = options?.uuidGenerator?.() ?? globalThis.crypto.randomUUID();
				pushSetCookie(event, serializeCookie(key, id, defaultCookieOptions));
			}

			await storage.set(id, value);
		},
		async delete(key, event) {
			const id = await adapter.getSessionId!(key, event);

			if (id) {
				await storage.delete(id);
			}

			pushSetCookie(event, serializeCookie(key, '', { ...defaultCookieOptions, expires: new Date(0) }));
		},
		async deleteByLogoutToken(token) {
			await storage.deleteByLogoutToken?.(token);
		},
	};
}

/**
 * Creates an encrypted session storage backed by cookies.
 * Built entirely on top of `adapter.toRequest`'s `Request` (reading the `cookie` header) and the outgoing cookie jar (writing `set-cookie` headers).
 *
 * @param {string} secret - The secret key used for encryption and decryption.
 * @param {ServerAdapter<TEvent>} adapter - The framework adapter used to read the incoming request.
 * @param {EncryptedCookieStorageOptions} [options] - Cookie attributes (maxAge, sameSite, etc.). `path` defaults to `'/'`.
 * @param {Partial<ServerCookieOptions>} [options.defaultCookieOptions] - Default cookie attributes for the session ID cookie.
 * @returns {ServerStorage<TEvent>} An object implementing the `ServerStorage` interface for managing encrypted session cookies.
 */
export function createEncryptedCookieStorage<TEvent = unknown>(
	secret: string,
	adapter: ServerAdapter<TEvent>,
	options?: EncryptedCookieStorageOptions,
): ServerStorage<TEvent> {
	const defaultCookieOptions: ServerCookieOptions = {
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		path: '/',
		...options?.defaultCookieOptions,
	};

	async function getIncomingCookie(event: TEvent | undefined, name: string): Promise<string | undefined> {
		if (!event) {
			return undefined;
		}

		const request = await adapter.toRequest(event);
		const cookies = parseCookieHeader(request.headers.get('cookie'));

		return cookies[name];
	}

	const storage: ServerStorage<TEvent> = {
		async get(key, event) {
			const cookie = await getIncomingCookie(event, key);

			if (cookie) {
				// NOTE: If the cookie is present, we can decrypt it directly without checking for chunks.
				return await decryptString(cookie, secret, COOKIE_CONTEXT);
			}

			// NOTE: If the cookie is not present, we check for chunked cookies (e.g., `key.0`, `key.1`, etc.) and concatenate them before decryption.
			const cookieChunks: Array<string> = [];

			for (let i = 0; ; i++) {
				const chunk = await getIncomingCookie(event, `${key}.${i}`);

				if (!chunk) {
					break;
				}

				cookieChunks.push(chunk);
			}

			if (cookieChunks.length === 0) {
				return null;
			}

			return await decryptString(cookieChunks.join(''), secret, COOKIE_CONTEXT);
		},

		async set(key, value, event) {
			// NOTE: Delete existing cookie(s) first to avoid leaving old chunks behind
			await storage.delete(key, event);

			const encrypted = await encryptString(value, secret, COOKIE_CONTEXT);

			if (encrypted.length <= COOKIE_CHUNK_SIZE) {
				pushSetCookie(event, serializeCookie(key, encrypted, defaultCookieOptions));
			} else {
				for (let i = 0; i * COOKIE_CHUNK_SIZE < encrypted.length; i++) {
					pushSetCookie(event, serializeCookie(`${key}.${i}`, encrypted.slice(i * COOKIE_CHUNK_SIZE, (i + 1) * COOKIE_CHUNK_SIZE), defaultCookieOptions));
				}
			}
		},

		async delete(key, event) {
			const expiredOptions = { ...defaultCookieOptions, expires: new Date(0) };

			pushSetCookie(event, serializeCookie(key, '', expiredOptions));

			for (let i = 0; await getIncomingCookie(event, `${key}.${i}`); i++) {
				pushSetCookie(event, serializeCookie(`${key}.${i}`, '', expiredOptions));
			}
		},
	};

	return storage;
}
