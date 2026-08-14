import type { SDKStorage } from '@strivacity/sdk-core/types';
import type { CookieOptions, NextServerStorage, PagesRouterRequest, PagesRouterResponse } from './types';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { buildCookieString } from '@strivacity/sdk-core/utils/common';
import { encryptString, decryptString } from '@strivacity/sdk-core/utils/crypto';

const CONTEXT = 'strivacity-session-v1';
const CHUNK_SIZE = 3900;

/**
 * Reads cookie value(s) for a given key directly from a NextRequest or PagesRouterRequest, without calling `cookies()` from next/headers.
 * Used for Pages Router / middleware support.
 *
 * @param req - The NextRequest or PagesRouterRequest object from which to read the cookie.
 * @param key - The name of the cookie to read.
 * @returns The cookie value as a string, or null if the cookie is not found.
 */
function getCookieFromRequest(req: NextRequest | Request | PagesRouterRequest, key: string): string | null {
	if (req instanceof NextRequest) {
		return req.cookies.get(key)?.value ?? null;
	}

	if (req instanceof Request) {
		const cookieHeader = req.headers.get('cookie') ?? '';
		const match = cookieHeader
			.split(';')
			.map((c) => c.trim())
			.find((c) => c.startsWith(`${key}=`));

		return match ? decodeURIComponent(match.slice(key.length + 1)) : null;
	}

	const cookieHeader = req.headers?.cookie ?? '';
	const match = cookieHeader
		.split(';')
		.map((c: string) => c.trim())
		.find((c: string) => c.startsWith(`${key}=`));

	return match ? decodeURIComponent(match.slice(key.length + 1)) : null;
}

/**
 * Creates a simple in-memory state storage implementation.
 *
 * @returns An object implementing the SDKStorage interface for managing state in Next.js.
 */
export function createServerStateStorage(): SDKStorage {
	globalThis.sty ??= {} as typeof globalThis.sty;
	globalThis.sty.stateStore ??= new Map<string, string>();

	return {
		get: async (key) => {
			return Promise.resolve(globalThis.sty.stateStore.get(key) ?? null);
		},
		set: async (key, value) => {
			globalThis.sty.stateStore.set(key, value);

			return Promise.resolve();
		},
		delete: async (key) => {
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
 * @returns An object implementing the NextServerStorage interface for managing encrypted cookies.
 */
export function getEncryptedCookieStorage(secret: string, defaultCookieOptions: CookieOptions = {}): NextServerStorage {
	defaultCookieOptions = {
		httpOnly: true,
		secure: true,
		path: '/',
		sameSite: 'lax' as const,
		...defaultCookieOptions,
	};

	const storage: NextServerStorage = {
		async get(key: string, req?: NextRequest | Request | PagesRouterRequest): Promise<string | null> {
			if (req) {
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
			} else {
				const store = await cookies();
				const cookie = store.get(key)?.value;

				if (cookie) {
					return await decryptString(cookie, secret, CONTEXT);
				}

				const cookieChunks: Array<string> = [];

				for (let i = 0; ; i++) {
					const chunk = store.get(`${key}.${i}`)?.value;

					if (!chunk) {
						break;
					}

					cookieChunks.push(chunk);
				}

				if (cookieChunks.length === 0) {
					return null;
				}

				return await decryptString(cookieChunks.join(''), secret, CONTEXT);
			}
		},

		async set(
			key: string,
			value: string,
			req?: NextRequest | Request | PagesRouterRequest,
			res?: NextResponse | PagesRouterResponse,
			cookieOptions?: CookieOptions,
		): Promise<void> {
			cookieOptions = { ...defaultCookieOptions, ...cookieOptions };

			// NOTE: Delete existing cookie(s) first to avoid leaving old chunks behind
			await storage.delete(key, req, res);

			const encrypted = await encryptString(value, secret, CONTEXT);

			if (res instanceof NextResponse) {
				if (encrypted.length <= CHUNK_SIZE) {
					res.cookies.set(key, encrypted, cookieOptions);
				} else {
					for (let i = 0; i * CHUNK_SIZE < encrypted.length; i++) {
						res.cookies.set(`${key}.${i}`, encrypted.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE), cookieOptions);
					}
				}
			} else if (res) {
				const setCookies: Array<string> = [];

				if (encrypted.length <= CHUNK_SIZE) {
					setCookies.push(buildCookieString(key, encrypted, cookieOptions));
				} else {
					for (let i = 0; i * CHUNK_SIZE < encrypted.length; i++) {
						setCookies.push(buildCookieString(`${key}.${i}`, encrypted.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE), cookieOptions));
					}
				}

				const existing = res.getHeader('set-cookie');
				const existingArr = Array.isArray(existing) ? existing : existing ? [String(existing)] : [];

				res.setHeader('set-cookie', [...existingArr, ...setCookies]);
			} else {
				const store = await cookies();

				if (encrypted.length <= CHUNK_SIZE) {
					store.set(key, encrypted, cookieOptions);
				} else {
					for (let i = 0; i * CHUNK_SIZE < encrypted.length; i++) {
						store.set(`${key}.${i}`, encrypted.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE), cookieOptions);
					}
				}
			}
		},

		async delete(
			key: string,
			req?: NextRequest | Request | PagesRouterRequest,
			res?: NextResponse | PagesRouterResponse,
			cookieOptions?: CookieOptions,
		): Promise<void> {
			cookieOptions = { ...defaultCookieOptions, ...cookieOptions, maxAge: 0 };

			if (res instanceof NextResponse) {
				res.cookies.delete(key);

				for (let i = 0; res.cookies.get(`${key}.${i}`); i++) {
					res.cookies.delete(`${key}.${i}`);
				}
			} else if (res) {
				const setCookies: Array<string> = [];

				setCookies.push(buildCookieString(key, '', cookieOptions));

				if (req) {
					for (let i = 0; getCookieFromRequest(req, `${key}.${i}`) !== null; i++) {
						setCookies.push(buildCookieString(`${key}.${i}`, '', cookieOptions));
					}
				}

				const existing = res.getHeader('set-cookie');
				const existingArr = Array.isArray(existing) ? existing : existing ? [String(existing)] : [];

				res.setHeader('set-cookie', [...existingArr, ...setCookies]);
			} else {
				const store = await cookies();

				store.delete(key);

				for (let i = 0; store.get(`${key}.${i}`); i++) {
					store.delete(`${key}.${i}`);
				}
			}
		},
	};

	return storage;
}
