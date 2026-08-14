import type { H3Event } from 'h3';
import type { CookieOptions, SDKStorage } from '@strivacity/sdk-core/types';
import type { NuxtServerStorage } from '../../types';
import { getCookie, setCookie, deleteCookie } from 'h3';
import { encryptString, decryptString } from '@strivacity/sdk-core/utils/crypto';

const CONTEXT = 'strivacity-session-v1';
const CHUNK_SIZE = 3900;

/**
 * Creates a simple in-memory state storage implementation for Nuxt.
 */
export function createServerStateStorage(): SDKStorage {
	globalThis.sty ??= {} as typeof globalThis.sty;
	globalThis.sty.stateStore ??= new Map<string, string>();

	return {
		get: (key) => {
			return Promise.resolve(globalThis.sty.stateStore.get(key) ?? null);
		},
		set: (key, value) => {
			globalThis.sty.stateStore.set(key, value);

			return Promise.resolve();
		},
		delete: (key) => {
			globalThis.sty.stateStore.delete(key);

			return Promise.resolve();
		},
	};
}

/**
 * Creates an encrypted cookie session storage.
 * Only callable in server-side contexts.
 *
 * @param secret - The secret key used for encryption and decryption.
 * @param defaultCookieOptions - Optional default cookie options to be used when setting cookies.
 * @returns An object implementing the NuxtServerStorage interface for managing encrypted cookies in Nuxt.
 */
export function getEncryptedCookieStorage(secret: string, defaultCookieOptions: CookieOptions = {}): NuxtServerStorage {
	defaultCookieOptions = {
		httpOnly: true,
		secure: true,
		path: '/',
		sameSite: 'lax' as const,
		...defaultCookieOptions,
	};

	const storage: NuxtServerStorage = {
		async get(key: string, event: H3Event): Promise<string | null> {
			const cookie = getCookie(event, key) ?? null;

			if (cookie) {
				return await decryptString(cookie, secret, CONTEXT);
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

			return await decryptString(cookieChunks.join(''), secret, CONTEXT);
		},

		async set(key: string, value: string, event: H3Event, cookieOptions: CookieOptions = {}) {
			cookieOptions = { ...defaultCookieOptions, ...cookieOptions };

			// NOTE: Delete existing cookie(s) first to avoid leaving old chunks behind
			deleteCookie(event, key, cookieOptions);

			const encrypted = await encryptString(value, secret, CONTEXT);

			if (encrypted.length <= CHUNK_SIZE) {
				setCookie(event, key, encrypted, cookieOptions);
			} else {
				for (let i = 0; i * CHUNK_SIZE < encrypted.length; i++) {
					setCookie(event, `${key}.${i}`, encrypted.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE), cookieOptions);
				}
			}
		},

		async delete(key: string, event: H3Event, cookieOptions: CookieOptions = {}) {
			deleteCookie(event, key, cookieOptions);

			for (let i = 0; getCookie(event, `${key}.${i}`); i++) {
				deleteCookie(event, `${key}.${i}`, cookieOptions);
			}

			return Promise.resolve();
		},
	};

	return storage;
}
