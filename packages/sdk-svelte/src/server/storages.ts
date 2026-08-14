import type { SDKStorage } from '@strivacity/sdk-core/types';
import type { SvelteKitCookieOptions, SvelteKitServerStorage } from './types';
import { encryptString, decryptString } from '@strivacity/sdk-core/utils/crypto';

const CONTEXT = 'strivacity-session-v1';
const CHUNK_SIZE = 3900;

/**
 * Creates a simple in-memory state storage implementation.
 *
 * @returns An object implementing the SDKStorage interface for managing state.
 */
export function createServerStateStorage(): SDKStorage {
	globalThis.sty ??= {} as typeof globalThis.sty;
	globalThis.sty.stateStore ??= new Map<string, string>();

	return {
		async get(key) {
			return Promise.resolve(globalThis.sty.stateStore.get(key) ?? null);
		},
		async set(key, value) {
			globalThis.sty.stateStore.set(key, value);

			return Promise.resolve();
		},
		async delete(key) {
			globalThis.sty.stateStore.delete(key);

			return Promise.resolve();
		},
	};
}

/**
 * Creates an encrypted cookie session storage backed by SvelteKit's `event.cookies`.
 *
 * @param secret - The secret key used for encryption and decryption.
 * @param defaultCookieOptions - Cookie attributes (maxAge, sameSite, etc.). `path` defaults to `'/'`.
 * @returns An object implementing the SvelteKitServerStorage interface for managing encrypted cookies.
 */
export function getEncryptedCookieStorage(secret: string, defaultCookieOptions: Partial<SvelteKitCookieOptions> = {}): SvelteKitServerStorage {
	const baseCookieOptions: SvelteKitCookieOptions = {
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		path: '/',
		...defaultCookieOptions,
	};

	const storage: SvelteKitServerStorage = {
		async get(key, event) {
			if (!event) {
				return null;
			}

			const cookie = event.cookies.get(key);

			if (cookie) {
				return await decryptString(cookie, secret, CONTEXT);
			}

			const chunks: Array<string> = [];

			for (let i = 0; ; i++) {
				const chunk = event.cookies.get(`${key}.${i}`);

				if (!chunk) {
					break;
				}

				chunks.push(chunk);
			}

			if (chunks.length === 0) {
				return null;
			}

			return await decryptString(chunks.join(''), secret, CONTEXT);
		},

		async set(key, value, event, cookieOptions) {
			if (!event) {
				return;
			}

			const options = { ...baseCookieOptions, ...cookieOptions };

			// NOTE: Delete existing cookie(s) first to avoid leaving old chunks behind
			await storage.delete(key, event, options);

			const encrypted = await encryptString(value, secret, CONTEXT);

			if (encrypted.length <= CHUNK_SIZE) {
				event.cookies.set(key, encrypted, options);
			} else {
				for (let i = 0; i * CHUNK_SIZE < encrypted.length; i++) {
					event.cookies.set(`${key}.${i}`, encrypted.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE), options);
				}
			}
		},

		async delete(key, event, cookieOptions) {
			if (!event) {
				return;
			}

			const options = { ...baseCookieOptions, ...cookieOptions, maxAge: 0 };

			event.cookies.delete(key, options);

			for (let i = 0; event.cookies.get(`${key}.${i}`); i++) {
				event.cookies.delete(`${key}.${i}`, options);
			}

			return Promise.resolve();
		},
	};

	return storage;
}
