import type { CookieOptions as ExpressCookieOptions, Request as ExpressRequest, Response as ExpressResponse } from 'express';
import type { SDKStorage } from '@strivacity/sdk-core/types';
import type { AngularServerRequest, AngularServerStorage, CookieOptions } from './types';
import { encryptString, decryptString } from '@strivacity/sdk-core/utils/crypto';

const CONTEXT = 'strivacity-session-v1';
const CHUNK_SIZE = 3900;

globalThis.sty ??= {} as typeof globalThis.sty;
globalThis.sty.stateStore ??= new Map<string, string>();

/**
 * Reads a single cookie value from either an Express request or the standard Fetch `Request`
 * exposed by Angular's `REQUEST` token during server-side rendering.
 *
 * @param {AngularServerRequest} req - The request to read the cookie from.
 * @param {string} key - The name of the cookie to read.
 * @returns {string | null} The cookie value, or `null` if not present.
 */
export function getCookieFromRequest(req: AngularServerRequest, key: string): string | null {
	const headers = req.headers;
	const cookieHeader =
		typeof (headers as Headers).get === 'function' ? ((headers as Headers).get('cookie') ?? '') : ((headers as ExpressRequest['headers']).cookie ?? '');
	const match = cookieHeader
		.split(';')
		.map((chunk: string) => chunk.trim())
		.find((chunk: string) => chunk.startsWith(`${key}=`));

	return match ? decodeURIComponent(match.slice(key.length + 1)) : null;
}

/**
 * Converts the SDK's generic `CookieOptions` into Express's `res.cookie()` options.
 * Express expects `maxAge` in milliseconds, while the SDK works in seconds.
 */
function toExpressCookieOptions(options: CookieOptions): ExpressCookieOptions {
	return {
		httpOnly: options.httpOnly !== false,
		secure: options.secure !== false,
		path: options.path ?? '/',
		sameSite: options.sameSite ?? 'lax',
		domain: options.domain,
		maxAge: typeof options.maxAge === 'number' ? options.maxAge * 1000 : undefined,
	};
}

/**
 * Creates a simple in-memory state storage implementation for Angular.
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
 * @param {string} secret - The secret key used for encryption and decryption.
 * @param {CookieOptions} defaultCookieOptions - Cookie attributes (maxAge, path, sameSite, etc.).
 * @returns {AngularServerStorage} An object implementing the AngularServerStorage interface for managing encrypted cookies.
 */
export function getEncryptedCookieStorage(secret: string, defaultCookieOptions: CookieOptions = {}): AngularServerStorage {
	defaultCookieOptions = {
		httpOnly: true,
		secure: true,
		path: '/',
		sameSite: 'lax',
		...defaultCookieOptions,
	};

	const storage: AngularServerStorage = {
		async get(key: string, req?: AngularServerRequest): Promise<string | null> {
			if (!req) {
				return null;
			}

			const cookie = getCookieFromRequest(req, key);

			if (cookie) {
				return await decryptString(cookie, secret, CONTEXT);
			}

			const cookieChunks: Array<string> = [];

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

		async set(key: string, value: string, req?: ExpressRequest, res?: ExpressResponse, cookieOptions?: CookieOptions): Promise<void> {
			if (!res) {
				return;
			}

			cookieOptions = { ...defaultCookieOptions, ...cookieOptions };

			// NOTE: Delete existing cookie(s) first to avoid leaving old chunks behind
			await storage.delete(key, req, res);

			const encrypted = await encryptString(value, secret, CONTEXT);

			if (encrypted.length <= CHUNK_SIZE) {
				res.cookie(key, encrypted, toExpressCookieOptions(cookieOptions));
			} else {
				for (let i = 0; i * CHUNK_SIZE < encrypted.length; i++) {
					res.cookie(`${key}.${i}`, encrypted.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE), toExpressCookieOptions(cookieOptions));
				}
			}
		},

		async delete(key: string, req?: ExpressRequest, res?: ExpressResponse, cookieOptions?: CookieOptions): Promise<void> {
			if (!res) {
				return;
			}

			cookieOptions = { ...defaultCookieOptions, ...cookieOptions, maxAge: 0 };

			res.clearCookie(key, toExpressCookieOptions(cookieOptions));

			if (req) {
				for (let i = 0; getCookieFromRequest(req, `${key}.${i}`) !== null; i++) {
					res.clearCookie(`${key}.${i}`, toExpressCookieOptions(cookieOptions));
				}
			}

			return Promise.resolve();
		},
	};

	return storage;
}
