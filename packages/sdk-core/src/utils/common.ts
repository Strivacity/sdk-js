import type { ServerCookieOptions } from '../types/server';

/**
 * Returns the current Unix timestamp (seconds since the epoch).
 *
 * @returns {number} The current timestamp in seconds.
 */
export function timestamp(): number {
	return Math.floor(Date.now() / 1000);
}

/**
 * Unflattens a flat object with dot-separated keys into a nested object.
 *
 * @param {Record<string, unknown>} flatObject - The flat object to unflatten.
 * @returns The nested object.
 */
export function unflattenObject(flatObject: Record<string, unknown>): Record<string, unknown> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const nestedObject: Record<string, any> = {};

	for (const key in flatObject) {
		const keys = key.split('.');

		keys.reduce((acc, part, index) => {
			if (index === keys.length - 1) {
				acc[part] = flatObject[key];
			} else {
				acc[part] = acc[part] || {};
			}

			return acc[part];
		}, nestedObject);
	}

	return nestedObject;
}

/**
 * Builds a cookie string suitable for use in HTTP headers.
 *
 * @param {string} name - The name of the cookie.
 * @param {string} value - The value of the cookie.
 * @param {CookieOptions} options - The cookie options (maxAge, path, domain, sameSite, secure, httpOnly).
 * @returns A string representing the cookie with its attributes.
 */
export function buildCookieString(name: string, value: string, options: ServerCookieOptions): string {
	let cookie = `${name}=${encodeURIComponent(value)}`;

	if (options.httpOnly !== false) cookie += '; HttpOnly';
	if (options.secure !== false) cookie += '; Secure';
	if (options.path ?? '/') cookie += `; Path=${options.path ?? '/'}`;
	if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;
	if (options.maxAge) cookie += `; Max-Age=${options.maxAge}`;
	if (options.domain) cookie += `; Domain=${options.domain}`;

	return cookie;
}
