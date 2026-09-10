import type { NextServerStorage, PagesRouterRequest, SessionIdCookieStorageOptions, EncryptedCookieStorageOptions } from './types';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { buildCookieString } from '@strivacity/sdk-core/utils/common';
import { encryptString, decryptString } from '@strivacity/sdk-core/utils/crypto';
import { COOKIE_CONTEXT, COOKIE_CHUNK_SIZE } from '@strivacity/sdk-core/server';
import { createSessionIdCookieStorage as createSessionIdCookieStorageBase } from '@strivacity/sdk-core/storages/server';

export * from '@strivacity/sdk-react/storages';

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
 * Creates a session storage that puts a random unique id value cookie on the client and keeping the actual session data in the given `storage`.
 *
 * @param {NextServerStorage} storage - The storage used to persist session data, keyed by a randomly generated session id.
 * @param {SessionIdCookieStorageOptions} [options] - Options for configuring the session-id cookie storage.
 * @returns {NextServerStorage} An object implementing the ServerStorage interface for managing sessions indexed by a session-id cookie.
 */
export function createSessionIdCookieStorage(storage: NextServerStorage, options?: SessionIdCookieStorageOptions): NextServerStorage {
	return createSessionIdCookieStorageBase<NextRequest | Request | PagesRouterRequest>(
		{
			toRequest: (req) => req as Request,
			redirect: (url, status) => NextResponse.redirect(url, status),
			getSessionId: async (key, req) => {
				if (req) {
					return getCookieFromRequest(req, key) ?? null;
				}

				const store = await cookies();

				return store.get(key)?.value;
			},
		},
		storage,
		options,
	);
}

/**
 * Creates an encrypted cookie session storage.
 * Only callable in server-side contexts (middleware, API routes, or server components).
 *
 * @param secret - The secret key used for encryption and decryption.
 * @param {EncryptedCookieStorageOptions} [options] - Options for configuring the encrypted cookie storage.
 * @param {Partial<ServerCookieOptions>} [options.defaultCookieOptions] - Default cookie attributes for the encrypted cookie.
 * @returns An object implementing the ServerStorage interface for managing encrypted cookies.
 */
export function createEncryptedCookieStorage(secret: string, options?: EncryptedCookieStorageOptions): NextServerStorage {
	const defaultCookieOptions = {
		httpOnly: true,
		secure: true,
		path: '/',
		sameSite: 'lax' as const,
		...options?.defaultCookieOptions,
	};

	const storage: NextServerStorage = {
		async get(key, req) {
			if (req) {
				const cookie = getCookieFromRequest(req, key);

				if (cookie) {
					return await decryptString(cookie, secret, COOKIE_CONTEXT);
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

				return await decryptString(cookieChunks.join(''), secret, COOKIE_CONTEXT);
			} else {
				const store = await cookies();
				const cookie = store.get(key)?.value;

				if (cookie) {
					return await decryptString(cookie, secret, COOKIE_CONTEXT);
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

				return await decryptString(cookieChunks.join(''), secret, COOKIE_CONTEXT);
			}
		},
		async set(key, value, req, res, cookieOptions) {
			cookieOptions = { ...defaultCookieOptions, ...cookieOptions };

			// NOTE: Delete existing cookie(s) first to avoid leaving old chunks behind
			await storage.delete(key, req, res);

			const encrypted = await encryptString(value, secret, COOKIE_CONTEXT);

			if (res instanceof NextResponse) {
				if (encrypted.length <= COOKIE_CHUNK_SIZE) {
					res.cookies.set(key, encrypted, cookieOptions);
				} else {
					for (let i = 0; i * COOKIE_CHUNK_SIZE < encrypted.length; i++) {
						res.cookies.set(`${key}.${i}`, encrypted.slice(i * COOKIE_CHUNK_SIZE, (i + 1) * COOKIE_CHUNK_SIZE), cookieOptions);
					}
				}
			} else if (res) {
				const setCookies: Array<string> = [];

				if (encrypted.length <= COOKIE_CHUNK_SIZE) {
					setCookies.push(buildCookieString(key, encrypted, cookieOptions));
				} else {
					for (let i = 0; i * COOKIE_CHUNK_SIZE < encrypted.length; i++) {
						setCookies.push(buildCookieString(`${key}.${i}`, encrypted.slice(i * COOKIE_CHUNK_SIZE, (i + 1) * COOKIE_CHUNK_SIZE), cookieOptions));
					}
				}

				const existing = res.getHeader('set-cookie');
				const existingArr = Array.isArray(existing) ? existing : existing ? [String(existing)] : [];

				res.setHeader('set-cookie', [...existingArr, ...setCookies]);
			} else {
				const store = await cookies();

				if (encrypted.length <= COOKIE_CHUNK_SIZE) {
					store.set(key, encrypted, cookieOptions);
				} else {
					for (let i = 0; i * COOKIE_CHUNK_SIZE < encrypted.length; i++) {
						store.set(`${key}.${i}`, encrypted.slice(i * COOKIE_CHUNK_SIZE, (i + 1) * COOKIE_CHUNK_SIZE), cookieOptions);
					}
				}
			}
		},
		async delete(key, req, res, cookieOptions) {
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
