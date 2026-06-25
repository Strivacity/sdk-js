import type { SDKStorage } from '../types/common';

export type CookieStorageOptions = {
	/**
	 * The `Path` attribute for the cookie. Defaults to `'/'`.
	 */
	path?: string;

	/**
	 * The `SameSite` attribute for the cookie.
	 * - `'Strict'` - cookie is only sent in a first-party context.
	 * - `'Lax'` - cookie is sent on top-level navigations and same-site requests.
	 * - `'None'` - cookie is sent in all contexts; requires `secure: true`.
	 *
	 * Defaults to `'Lax'`.
	 */
	sameSite?: 'Strict' | 'Lax' | 'None';

	/**
	 * When `true`, the cookie is only sent over HTTPS connections.
	 * Required when `sameSite` is `'None'`.
	 * Defaults to `true`.
	 */
	secure?: boolean;

	/**
	 * The maximum age of the cookie in seconds. When omitted the cookie is a session cookie
	 * and expires when the browser tab is closed.
	 */
	maxAge?: number;

	/**
	 * The `Domain` attribute for the cookie. When omitted the cookie is scoped to the current host.
	 */
	domain?: string;
};

function parseCookies(cookieString: string): Map<string, string> {
	const map = new Map<string, string>();

	for (const part of cookieString.split(';')) {
		const eqIdx = part.indexOf('=');

		if (eqIdx === -1) {
			continue;
		}

		const name = decodeURIComponent(part.slice(0, eqIdx).trim());
		const value = decodeURIComponent(part.slice(eqIdx + 1).trim());

		map.set(name, value);
	}

	return map;
}

function buildCookieString(key: string, value: string, options: Required<Omit<CookieStorageOptions, 'maxAge' | 'domain'>> & CookieStorageOptions): string {
	const parts: string[] = [`${encodeURIComponent(key)}=${encodeURIComponent(value)}`, `Path=${options.path}`, `SameSite=${options.sameSite}`];

	if (options.secure) {
		parts.push('Secure');
	}

	if (options.maxAge !== undefined) {
		parts.push(`Max-Age=${options.maxAge}`);
	}

	if (options.domain !== undefined) {
		parts.push(`Domain=${options.domain}`);
	}

	return parts.join('; ');
}

/**
 * Creates a storage adapter that persists values in browser cookies via `document.cookie`.
 *
 * Note: Cookies are limited to ~4 KB per entry and are sent with every HTTP request to the
 * matching domain and path. This adapter is **not** available inside Service Workers.
 *
 * @param {CookieStorageOptions} [options] - Optional cookie attributes.
 */
export function createCookieStorage(options: CookieStorageOptions = {}): SDKStorage {
	const resolvedOptions = {
		path: options.path ?? '/',
		sameSite: options.sameSite ?? 'Lax',
		secure: options.secure ?? true,
		...(options.maxAge !== undefined ? { maxAge: options.maxAge } : {}),
		...(options.domain !== undefined ? { domain: options.domain } : {}),
	};

	return {
		get: (key) => {
			const cookies = parseCookies(globalThis.document?.cookie ?? '');

			return Promise.resolve(cookies.get(key) ?? null);
		},
		set: (key, value) => {
			globalThis.document.cookie = buildCookieString(key, value, resolvedOptions);

			return Promise.resolve();
		},
		delete: (key) => {
			// Deleting a cookie is done by setting Max-Age=0
			globalThis.document.cookie = buildCookieString(key, '', { ...resolvedOptions, maxAge: 0 });

			return Promise.resolve();
		},
	};
}
