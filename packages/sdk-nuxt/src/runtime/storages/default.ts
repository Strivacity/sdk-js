import type { H3Event } from 'h3';
import type { CookieJar, EncryptedCookieStorageOptions, ServerStorage, SessionIdCookieStorageOptions } from '@strivacity/sdk-core/types';
import type { CookieOptions, NuxtServerStorage } from '../types';
import { getCookie, setCookie, deleteCookie, toWebRequest } from 'h3';
import {
	createSessionIdCookieStorage as createSessionIdCookieStorageBase,
	readEncryptedCookie,
	writeEncryptedCookie,
	deleteEncryptedCookie,
} from '@strivacity/sdk-core/storages/server';

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

	const createJar = (event: H3Event): CookieJar<CookieOptions> => ({
		get: (name) => getCookie(event, name),
		set: (name, value, cookieOptions) => void setCookie(event, name, value, cookieOptions),
		delete: (name, cookieOptions) => deleteCookie(event, name, cookieOptions),
	});

	return {
		get: async (key, event) => (event ? await readEncryptedCookie(createJar(event), key, secret) : null),
		set: async (key, value, event, cookieOptions = {}) => {
			if (event) {
				await writeEncryptedCookie(createJar(event), key, value, secret, { ...defaultCookieOptions, ...cookieOptions });
			}
		},
		delete: async (key, event, cookieOptions = {}) => {
			if (event) {
				await deleteEncryptedCookie(createJar(event), key, { ...defaultCookieOptions, ...cookieOptions });
			}
		},
	};
}
