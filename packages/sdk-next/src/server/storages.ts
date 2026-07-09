import type { SDKStorage } from '@strivacity/sdk-core';
import type { CookieOptions, PagesRouterRequest, PagesRouterResponse } from '../types';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { decrypt, encrypt } from '@strivacity/sdk-core/utils/crypto';
import { buildCookieString } from './utils';

declare global {
	interface StrivacityFramework {
		stateStore: Map<string, string>;
		accessTokenStore: Map<string, string>;
	}

	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace globalThis {
		// eslint-disable-next-line no-var
		var sty: StrivacityFramework;
	}
}

globalThis.sty ??= {} as typeof globalThis.sty;
globalThis.sty.stateStore ??= new Map<string, string>();
globalThis.sty.accessTokenStore ??= new Map<string, string>();

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

	// Web API Request - use headers.get()
	if (req instanceof Request) {
		const cookieHeader = req.headers.get('cookie') ?? '';
		const match = cookieHeader
			.split(';')
			.map((c) => c.trim())
			.find((c) => c.startsWith(`${key}=`));

		return match ? decodeURIComponent(match.slice(key.length + 1)) : null;
	}

	// IncomingMessage / NextApiRequest - parse cookie header manually
	const cookieHeader = (req as PagesRouterRequest).headers?.cookie ?? '';
	const match = cookieHeader
		.split(';')
		.map((c: string) => c.trim())
		.find((c: string) => c.startsWith(`${key}=`));

	return match ? decodeURIComponent(match.slice(key.length + 1)) : null;
}

/**
 * Creates a simple in-memory state storage implementation for Next.js.
 *
 * @returns An object implementing the SDKStorage interface for managing state in Next.js.
 */
export function createNextServerStateStorage(): SDKStorage {
	return {
		get: async (k) => {
			return Promise.resolve(globalThis.sty.stateStore.get(k) ?? null);
		},
		set: async (k, v) => {
			globalThis.sty.stateStore.set(k, v);

			return Promise.resolve();
		},
		delete: async (k) => {
			globalThis.sty.stateStore.delete(k);

			return Promise.resolve();
		},
	};
}

/**
 * Creates an encrypted cookie storage implementation for Next.js using AES-GCM encryption.
 *
 * @param secret - The secret string used to derive the cryptographic key for encryption and decryption.
 * @param options - Optional cookie attributes to customize the behavior of the cookies.
 * @returns An object implementing the SDKStorage interface for managing encrypted cookies in Next.js.
 */
export function createNextServerEncryptedCookieStorage(secret: string, options: CookieOptions = {}): SDKStorage {
	const CONTEXT = 'strivacity-session-v1';
	const CHUNK_SIZE = 3900;

	return {
		async get(key: string) {
			const store = await cookies();
			const singleCookie = store.get(key)?.value;

			if (singleCookie) {
				return decrypt(singleCookie, secret, CONTEXT);
			}

			const chunks: string[] = [];

			for (let i = 0; ; i++) {
				const chunk = store.get(`${key}.${i}`)?.value;

				if (!chunk) {
					break;
				}

				chunks.push(chunk);
			}

			if (chunks.length === 0) {
				return null;
			}

			return decrypt(chunks.join(''), secret, CONTEXT);
		},
		async set(key: string, value: string) {
			const store = await cookies();
			const encrypted = await encrypt(value, secret, CONTEXT);
			const cookieOptions = {
				httpOnly: true,
				secure: true,
				path: '/',
				sameSite: 'lax' as const,
				...options,
			};

			store.delete(key);

			for (let i = 0; store.get(`${key}.${i}`); i++) {
				store.delete(`${key}.${i}`);
			}

			if (encrypted.length <= CHUNK_SIZE) {
				store.set(key, encrypted, cookieOptions);
			} else {
				for (let i = 0; i * CHUNK_SIZE < encrypted.length; i++) {
					store.set(`${key}.${i}`, encrypted.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE), cookieOptions);
				}
			}
		},
		async delete(key: string) {
			const store = await cookies();

			store.delete(key);

			for (let i = 0; store.get(`${key}.${i}`); i++) {
				store.delete(`${key}.${i}`);
			}
		},
	};
}

/**
 * Reads and decrypts the session cookie directly from a request object.
 * Use this for Pages Router / middleware where `cookies()` from next/headers is unavailable.
 *
 * @param req - The NextRequest or PagesRouterRequest object from which to read the cookie.
 * @param key - The name of the cookie to read.
 * @param secret - The secret string used to derive the cryptographic key for decryption.
 * @returns A promise that resolves to the decrypted session data as a string, or null if the cookie is not found.
 */
export async function getEncryptedSessionFromRequest(req: NextRequest | Request | PagesRouterRequest, key: string, secret: string): Promise<string | null> {
	const CONTEXT = 'strivacity-session-v1';

	const single = getCookieFromRequest(req, key);

	if (single) {
		return decrypt(single, secret, CONTEXT);
	}

	const chunks: string[] = [];

	for (let i = 0; ; i++) {
		const chunk = getCookieFromRequest(req, `${key}.${i}`);

		if (!chunk) {
			break;
		}

		chunks.push(chunk);
	}

	if (chunks.length === 0) {
		return null;
	}

	return decrypt(chunks.join(''), secret, CONTEXT);
}

/**
 * Encrypts and writes the session to a NextResponse (middleware) or a Pages Router response.
 */
export async function setEncryptedSessionToResponse(
	res: NextResponse | PagesRouterResponse,
	key: string,
	value: string,
	secret: string,
	options: CookieOptions = {},
): Promise<void> {
	const CONTEXT = 'strivacity-session-v1';
	const CHUNK_SIZE = 3900;
	const encrypted = await encrypt(value, secret, CONTEXT);
	const cookieOptions: CookieOptions = {
		httpOnly: true,
		secure: true,
		path: '/',
		sameSite: 'lax',
		...options,
	};

	if (res instanceof NextResponse) {
		res.cookies.delete(key);

		if (encrypted.length <= CHUNK_SIZE) {
			res.cookies.set(key, encrypted, cookieOptions);
		} else {
			for (let i = 0; i * CHUNK_SIZE < encrypted.length; i++) {
				res.cookies.set(`${key}.${i}`, encrypted.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE), cookieOptions);
			}
		}
	} else {
		// Pages Router: ServerResponse / NextApiResponse
		const setCookies: string[] = [];

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
	}
}
