import type { H3Event } from 'h3';
import type { EncryptedCookieStorageOptions, ServerStorage, SessionIdCookieStorageOptions } from '@strivacity/sdk-core/types';
import type { NuxtServerStorage } from '../types';
import { getCookie, setCookie, deleteCookie, toWebRequest } from 'h3';
import { encryptString, decryptString } from '@strivacity/sdk-core/utils/crypto';
import { COOKIE_CONTEXT, COOKIE_CHUNK_SIZE } from '@strivacity/sdk-core/server';
import { createSessionIdCookieStorage as createSessionIdCookieStorageBase } from '@strivacity/sdk-core/storages/server';

/**
 * Creates a session storage that puts a random unique id value cookie on the client and keeping the actual session data in the given `storage`.
 *
 * @param {SDKStorage} storage - The storage used to persist session data, keyed by a randomly generated session id.
 * @param {SessionIdCookieStorageOptions} [options] - Options for configuring the session-id cookie storage.
 * @returns {ServerStorage} An object implementing the ServerStorage interface for managing sessions indexed by a session-id cookie.
 */
export function createSessionIdCookieStorage(storage: ServerStorage, options?: SessionIdCookieStorageOptions) {
	return createSessionIdCookieStorageBase<H3Event>(
		{
			toRequest: (event) => toWebRequest(event),
		},
		storage,
		options,
	);
}

/**
 * Creates an encrypted cookie session storage.
 * Only callable in server-side contexts.
 *
 * @param secret - The secret key used for encryption and decryption.
 * @param {EncryptedCookieStorageOptions} [options] - Options for configuring the encrypted cookie storage.
 * @param {Partial<ServerCookieOptions>} [options.defaultCookieOptions] - Default cookie attributes for the encrypted cookie.
 * @returns An object implementing the NuxtServerStorage interface for managing encrypted cookies in Nuxt.
 */
export function createEncryptedCookieStorage(secret: string, options?: EncryptedCookieStorageOptions): NuxtServerStorage {
	const defaultCookieOptions = {
		httpOnly: true,
		secure: true,
		path: '/',
		sameSite: 'lax' as const,
		...options?.defaultCookieOptions,
	};

	const storage: NuxtServerStorage = {
		async get(key, event) {
			if (!event) {
				return null;
			}

			const cookie = getCookie(event, key) ?? null;

			if (cookie) {
				return await decryptString(cookie, secret, COOKIE_CONTEXT);
			}

			const cookieChunks: Array<string> = [];

			for (let i = 0; ; i++) {
				const chunk = getCookie(event, `${key}.${i}`);

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

		async set(key, value, event, cookieOptions = {}) {
			if (!event) {
				return;
			}

			cookieOptions = { ...defaultCookieOptions, ...cookieOptions };

			await storage.delete(key, event, cookieOptions);

			const encrypted = await encryptString(value, secret, COOKIE_CONTEXT);

			if (encrypted.length <= COOKIE_CHUNK_SIZE) {
				setCookie(event, key, encrypted, cookieOptions);
			} else {
				for (let i = 0; i * COOKIE_CHUNK_SIZE < encrypted.length; i++) {
					setCookie(event, `${key}.${i}`, encrypted.slice(i * COOKIE_CHUNK_SIZE, (i + 1) * COOKIE_CHUNK_SIZE), cookieOptions);
				}
			}
		},

		async delete(key, event, cookieOptions = {}) {
			if (!event) {
				return;
			}

			deleteCookie(event, key, cookieOptions);

			for (let i = 0; getCookie(event, `${key}.${i}`); i++) {
				deleteCookie(event, `${key}.${i}`, cookieOptions);
			}

			return Promise.resolve();
		},
	};

	return storage;
}
