import type { SDKStorage } from '@strivacity/sdk-core/types';
import type { CookieOptions } from '@strivacity/sdk-core/types';
import type { RemixServerStorage } from './types';
import { buildCookieString } from '@strivacity/sdk-core/utils/common';
import { encryptString, decryptString } from '@strivacity/sdk-core/utils/crypto';

const CONTEXT = 'strivacity-session-v1';
const CHUNK_SIZE = 3900;

globalThis.sty ??= {} as typeof globalThis.sty;
globalThis.sty.stateStore ??= new Map<string, string>();

/**
 * Reads a cookie value from a Request object.
 *
 * @param req - The Request object from which to read the cookie.
 * @param key - The name of the cookie to read.
 * @returns The cookie value as a string, or null if the cookie is not found.
 */
function getCookieFromRequest(req: Request, key: string): string | null {
	const cookieHeader = req.headers.get('cookie') ?? '';

	for (const cookie of cookieHeader.split(';')) {
		const idx = cookie.indexOf('=');

		if (idx === -1) {
			continue;
		}

		const name = cookie.slice(0, idx).trim();
		const value = cookie.slice(idx + 1).trim();

		if (name === key) {
			return decodeURIComponent(value);
		}
	}

	return null;
}

/**
 * Creates a simple in-memory state storage implementation.
 *
 * @returns An object implementing the SDKStorage interface for managing state in Remix.
 */
export function createServerStateStorage(): SDKStorage {
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
 * Only callable in server-side contexts (middleware, API routes, or server components).
 *
 * @param secret - The secret key used for encryption and decryption.
 * @param defaultCookieOptions - Cookie attributes (maxAge, path, sameSite, etc.).
 * @returns An object implementing the RemixServerStorage interface for managing encrypted cookies.
 */
export function getEncryptedCookieStorage(secret: string, defaultCookieOptions: CookieOptions = {}): RemixServerStorage {
	defaultCookieOptions = {
		httpOnly: true,
		secure: true,
		path: '/',
		sameSite: 'lax' as const,
		...defaultCookieOptions,
	};

	const storage: RemixServerStorage = {
		async get(key: string, req: Request): Promise<string | null> {
			const cookie = getCookieFromRequest(req, key);

			if (cookie) {
				return await decryptString(cookie, secret, CONTEXT);
			}

			const cookieChunks: string[] = [];

			for (let i = 0; ; i++) {
				const chunk = getCookieFromRequest(req, `${key}.${i}`);

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

		async set(key: string, value: string, req: Request, res: Response, cookieOptions?: CookieOptions): Promise<void> {
			cookieOptions = { ...defaultCookieOptions, ...cookieOptions };

			// NOTE: Delete existing cookie(s) first to avoid leaving old chunks behind
			await storage.delete(key, req, res);

			const encrypted = await encryptString(value, secret, CONTEXT);

			if (encrypted.length <= CHUNK_SIZE) {
				res.headers.append('set-cookie', buildCookieString(key, encrypted, cookieOptions));
			} else {
				for (let i = 0; i * CHUNK_SIZE < encrypted.length; i++) {
					res.headers.append('set-cookie', buildCookieString(`${key}.${i}`, encrypted.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE), cookieOptions));
				}
			}
		},

		async delete(key: string, req: Request, res: Response, cookieOptions?: CookieOptions): Promise<void> {
			cookieOptions = { ...defaultCookieOptions, ...cookieOptions, maxAge: 0 };

			res.headers.append('set-cookie', buildCookieString(key, '', cookieOptions));

			if (req) {
				for (let i = 0; getCookieFromRequest(req, `${key}.${i}`) !== null; i++) {
					res.headers.append('set-cookie', buildCookieString(`${key}.${i}`, '', cookieOptions));
				}
			}

			return Promise.resolve();
		},
	};

	return storage;
}
