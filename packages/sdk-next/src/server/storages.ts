import type {
	CookieJar,
	CookieOptions,
	NextServerStorage,
	PagesRouterRequest,
	PagesRouterResponse,
	SessionIdCookieStorageOptions,
	EncryptedCookieStorageOptions,
} from './types';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { buildCookieString } from '@strivacity/sdk-core/utils/common';
import {
	createSessionIdCookieStorage as createSessionIdCookieStorageBase,
	readEncryptedCookie,
	writeEncryptedCookie,
	deleteEncryptedCookie,
} from '@strivacity/sdk-core/storages/server';

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
 * Builds the cookie access for one storage call. Writes go to the given response (App Router `NextResponse` or Pages Router
 * `res`), or to `cookies()` from next/headers when there is none. Reads come from the request, then from the response.
 *
 * @param req - The incoming request, if any.
 * @param res - The outgoing response, if any.
 * @returns The cookie jar.
 */
function createJar(req?: NextRequest | Request | PagesRouterRequest, res?: NextResponse | PagesRouterResponse): CookieJar<CookieOptions> {
	const appendSetCookie = (response: PagesRouterResponse, cookie: string) => {
		const existing = response.getHeader('set-cookie');
		const existingArr = Array.isArray(existing) ? existing : existing ? [String(existing)] : [];

		response.setHeader('set-cookie', [...existingArr, cookie]);
	};

	return {
		async get(name) {
			const fromRequest = req ? getCookieFromRequest(req, name) : null;

			if (fromRequest) {
				return fromRequest;
			}
			if (res instanceof NextResponse) {
				return res.cookies.get(name)?.value;
			}
			if (res || req) {
				return null;
			}

			return (await cookies()).get(name)?.value;
		},
		async set(name, value, cookieOptions) {
			if (res instanceof NextResponse) {
				res.cookies.set(name, value, cookieOptions);
			} else if (res) {
				appendSetCookie(res, buildCookieString(name, value, cookieOptions));
			} else {
				(await cookies()).set(name, value, cookieOptions);
			}
		},
		async delete(name, cookieOptions) {
			if (res instanceof NextResponse) {
				res.cookies.set(name, '', { ...cookieOptions, maxAge: 0 });
			} else if (res) {
				appendSetCookie(res, buildCookieString(name, '', { ...cookieOptions, maxAge: 0 }));
			} else {
				(await cookies()).delete(name);
			}
		},
	};
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

	return {
		get: (key, req) => readEncryptedCookie(createJar(req), key, secret),
		set: (key, value, req, res, cookieOptions) => writeEncryptedCookie(createJar(req, res), key, value, secret, { ...defaultCookieOptions, ...cookieOptions }),
		delete: (key, req, res, cookieOptions) => deleteEncryptedCookie(createJar(req, res), key, { ...defaultCookieOptions, ...cookieOptions }),
	};
}
