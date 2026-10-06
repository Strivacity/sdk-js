import type { SDKStorage } from '../types/common';
import type {
	CookieJar,
	EncryptedCookieStorageOptions,
	ServerAdapter,
	ServerCookieOptions,
	ServerStorage,
	SessionIdCookieStorageOptions,
} from '../types/server';
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

	const sessionIdStorage: ServerStorage<TEvent> = {
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

			pushSetCookie(event, serializeCookie(key, '', { ...defaultCookieOptions, maxAge: 0, expires: new Date(0) }));
		},
	};

	// NOTE: only when the inner storage can do it, so the back-channel logout route answers 501 instead of a silent 200
	if (storage.deleteByLogoutToken) {
		sessionIdStorage.deleteByLogoutToken = (token) => storage.deleteByLogoutToken!(token);
	}

	return sessionIdStorage;
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

	const expiredCookieOptions = { ...defaultCookieOptions, maxAge: 0 };

	function createJar(event: TEvent | undefined): CookieJar {
		return {
			get: async (name) => {
				if (!event) {
					return undefined;
				}

				const request = await adapter.toRequest(event);

				return parseCookieHeader(request.headers.get('cookie'))[name];
			},
			set: (name, value, cookieOptions) => pushSetCookie(event, serializeCookie(name, value, cookieOptions)),
			delete: (name) => pushSetCookie(event, serializeCookie(name, '', expiredCookieOptions)),
		};
	}

	return {
		get: (key, event) => readEncryptedCookie(createJar(event), key, secret),
		set: (key, value, event) => writeEncryptedCookie(createJar(event), key, value, secret, defaultCookieOptions),
		delete: (key, event) => deleteEncryptedCookie(createJar(event), key, defaultCookieOptions),
	};
}

/**
 * Reads and decrypts a session written by `writeEncryptedCookie`: a single `key` cookie, or chunks `key.0`, `key.1`, ... joined in order.
 *
 * @param {CookieJar} jar - Access to the request's cookies.
 * @param {string} key - The cookie name.
 * @param {string} secret - The encryption secret.
 * @returns {Promise<string | null>} The decrypted value, or `null` when there is no cookie.
 */
export async function readEncryptedCookie<TOptions>(jar: CookieJar<TOptions>, key: string, secret: string): Promise<string | null> {
	const cookie = await jar.get(key);

	if (cookie) {
		return await decryptString(cookie, secret, COOKIE_CONTEXT);
	}

	const chunks: Array<string> = [];

	for (let i = 0; ; i++) {
		const chunk = await jar.get(`${key}.${i}`);

		if (!chunk) {
			break;
		}

		chunks.push(chunk);
	}

	return chunks.length > 0 ? await decryptString(chunks.join(''), secret, COOKIE_CONTEXT) : null;
}

/**
 * Encrypts a value and writes it as a single `key` cookie, or as `COOKIE_CHUNK_SIZE` chunks (`key.0`, `key.1`, ...) when it is too
 * large for one cookie. The previous cookie and all of its chunks from the request are deleted first, so no stale chunk is left behind.
 *
 * @param {CookieJar} jar - Access to the request's and the response's cookies.
 * @param {string} key - The cookie name.
 * @param {string} value - The plain value.
 * @param {string} secret - The encryption secret.
 * @param {TOptions} options - Cookie attributes for the written cookies (and for deleting the old ones).
 */
export async function writeEncryptedCookie<TOptions>(jar: CookieJar<TOptions>, key: string, value: string, secret: string, options: TOptions): Promise<void> {
	await deleteEncryptedCookie(jar, key, options);

	const encrypted = await encryptString(value, secret, COOKIE_CONTEXT);

	if (encrypted.length <= COOKIE_CHUNK_SIZE) {
		await jar.set(key, encrypted, options);
		return;
	}

	for (let i = 0; i * COOKIE_CHUNK_SIZE < encrypted.length; i++) {
		await jar.set(`${key}.${i}`, encrypted.slice(i * COOKIE_CHUNK_SIZE, (i + 1) * COOKIE_CHUNK_SIZE), options);
	}
}

/**
 * Deletes a session written by `writeEncryptedCookie`: the `key` cookie and every `key.N` chunk present in the request.
 *
 * @param {CookieJar} jar - Access to the request's and the response's cookies.
 * @param {string} key - The cookie name.
 * @param {TOptions} options - Cookie attributes (`path`, `domain`) of the cookies to delete.
 */
export async function deleteEncryptedCookie<TOptions>(jar: CookieJar<TOptions>, key: string, options: TOptions): Promise<void> {
	await jar.delete(key, options);

	for (let i = 0; await jar.get(`${key}.${i}`); i++) {
		await jar.delete(`${key}.${i}`, options);
	}
}
