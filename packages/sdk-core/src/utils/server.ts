import type { HttpClientResponse, SDKStorage, ServerCookieOptions, ServerAdapter, ServerSDKOptions, ServerStorage } from '../types';
import { getSDKOptions } from './oidc';
import { createServerStateStorage, createEncryptedCookieStorage } from '../storages/server';
import { ConfigurationError, InternalError } from './errors';

/**
 * Disallowed headers that should not be proxied from the SDK to the client, as they may interfere with the response handling.
 */
export const DISALLOWED_PROXY_HEADERS = new Set(['transfer-encoding', 'connection', 'keep-alive', 'content-encoding']);

/**
 * Returns with the returnTo cookie name used for storing the returnTo URL in the server SDK.
 */
export const RETURN_TO_COOKIE = 'sty.returnTo';

/**
 * Backchannel logout event name used for identifying backchannel logout requests in the server SDK.
 */
export const BACKCHANNEL_LOGOUT_EVENT = 'http://schemas.openid.net/event/backchannel-logout';

/**
 * Default cookie max age in seconds (30 days).
 */
export const DEFAULT_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

/**
 * A WeakMap to store cookies for each request event, allowing for proper cookie management in server-side environments.
 */
const cookieJars = new WeakMap<object, Array<string>>();

/**
 * Returns with the server SDK options merged with the provided options.
 *
 * @param {SDKInitConfig} options - The SDK initialization configuration.
 * @template InitOptions - The type of the SDK initialization configuration.
 * @template Options - The type of the SDK options.
 * @returns {Options} The merged SDK options.
 */
export function getServerSDKOptions<
	TEvent = unknown,
	Storage extends ServerStorage<TEvent> = ServerStorage<TEvent>,
	StateStorage extends SDKStorage = SDKStorage,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
>(adapter: ServerAdapter<TEvent>, options: any): ServerSDKOptions<TEvent, Storage, StateStorage> {
	options.postLoginRedirectUri ??= new URL(options.redirectUri).origin;
	options.postLogoutRedirectUri ??= new URL(options.redirectUri).origin;
	options.cookieMaxAge ??= DEFAULT_COOKIE_MAX_AGE;

	if (!options.storage) {
		if (!options.secret) {
			throw new ConfigurationError('Missing SDK option: secret');
		}

		options.storage = createEncryptedCookieStorage<TEvent>(options.secret, adapter, { defaultCookieOptions: { maxAge: options.cookieMaxAge } });
	}

	options.stateStorage ??= createServerStateStorage();
	options.urlHandler ??= async () => Promise.resolve(undefined);
	options.authUrlPrefix ??= '/auth';
	options.loginUri ??= '/login';

	if (typeof options.serverSessionUri === 'undefined') {
		options.serverSessionUri ??= `${options.authUrlPrefix}/login`;
	}

	return getSDKOptions(options);
}

/**
 * Parses a `Cookie` request header into a plain name/value map.
 *
 * @param {string | null | undefined} header - The raw `Cookie` header value.
 * @returns {Record<string, string>} The parsed cookies.
 */
export function parseCookieHeader(header: string | null | undefined): Record<string, string> {
	const cookies: Record<string, string> = {};

	if (!header) {
		return cookies;
	}

	for (const part of header.split(';')) {
		const index = part.indexOf('=');

		if (index === -1) {
			continue;
		}

		const name = part.slice(0, index).trim();
		const value = part.slice(index + 1).trim();

		if (name) {
			try {
				cookies[name] = decodeURIComponent(value);
			} catch {
				cookies[name] = value;
			}
		}
	}

	return cookies;
}

/**
 * Serializes a name/value pair into a `Set-Cookie` header value.
 *
 * @param {string} name - The cookie name.
 * @param {string} value - The cookie value.
 * @param {ServerCookieOptions} [options] - The cookie attributes.
 * @returns {string} The serialized `Set-Cookie` header value.
 */
export function serializeCookie(name: string, value: string, options: ServerCookieOptions = {}): string {
	const segments = [`${name}=${encodeURIComponent(value)}`];

	if (typeof options.maxAge === 'number') {
		segments.push(`Max-Age=${Math.floor(options.maxAge)}`);
	}
	if (options.expires) {
		segments.push(`Expires=${options.expires.toUTCString()}`);
	}

	segments.push(`Path=${options.path ?? '/'}`);

	if (options.domain) {
		segments.push(`Domain=${options.domain}`);
	}
	if (options.sameSite) {
		segments.push(`SameSite=${options.sameSite.charAt(0).toUpperCase()}${options.sameSite.slice(1)}`);
	}
	if (options.secure) {
		segments.push('Secure');
	}
	if (options.httpOnly) {
		segments.push('HttpOnly');
	}

	return segments.join('; ');
}

/**
 * Pushes a `Set-Cookie` header value into the cookie jar for the given event.
 *
 * @param {unknown} event - The framework-native request event.
 * @param {string} header - The `Set-Cookie` header value to push.
 */
export function pushSetCookie(event: unknown, header: string): void {
	if (event === null || typeof event !== 'object') {
		throw new InternalError('Server adapter events must be objects to track outgoing cookies');
	}

	const jar = cookieJars.get(event) ?? [];
	jar.push(header);
	cookieJars.set(event, jar);
}

/**
 * Flushes the accumulated `Set-Cookie` headers from the cookie jar into the provided `Response`.
 *
 * @param {unknown} event - The framework-native request event.
 * @param {Response} response - The `Response` object to append the `Set-Cookie` headers to.
 * @returns {Response} The modified `Response` with the appended `Set-Cookie` headers.
 */
export function flushSetCookies(event: unknown, response: Response): Response {
	if (event === null || typeof event !== 'object') {
		throw new InternalError('Server adapter events must be objects to track outgoing cookies');
	}

	const jar = cookieJars.get(event);

	if (jar?.length) {
		for (const header of jar) {
			response.headers.append('set-cookie', header);
		}

		cookieJars.delete(event);
	}

	return response;
}

/**
 * Proxies an `HttpClientResponse` to a Web `Response`, preserving headers and status code.
 *
 * @param {HttpClientResponse<T>} response - The `HttpClientResponse` to proxy.
 * @returns {Response} A `Response` object representing the proxied response.
 */
export function proxyResponse<T = unknown>(response: HttpClientResponse<T>): Response {
	const proxyHeaders = new Headers();

	for (const [key, value] of response.headers.entries()) {
		if (key.toLowerCase() === 'set-cookie') {
			continue;
		}

		if (!DISALLOWED_PROXY_HEADERS.has(key.toLowerCase())) {
			proxyHeaders.set(key, value);
		}
	}

	const proxyCookies = response.headers
		.get('set-cookie')
		?.split(',')
		.map((cookie) => cookie.trim());

	if (proxyCookies?.length) {
		proxyHeaders.set('set-cookie', proxyCookies.join(', '));
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: proxyHeaders,
	});
}

/**
 * Returns a safe absolute redirect URL only if it shares the same origin as `safeBaseUrl`, preventing open redirects.
 *
 * @param {string | undefined | null} dangerousRedirect - The untrusted redirect path or URL.
 * @param {string} safeBaseUrl - The trusted base URL whose origin is used as the allowed origin.
 * @returns {string | null} The resolved URL string if safe, or `null`.
 */
export function toSafeRedirect(dangerousRedirect: string | undefined | null, safeBaseUrl: string): string | null {
	let url: URL;

	if (!dangerousRedirect) {
		return null;
	}

	try {
		url = new URL(
			dangerousRedirect.startsWith('/') ? dangerousRedirect.slice(1) : dangerousRedirect,
			safeBaseUrl && !safeBaseUrl.endsWith('/') ? `${safeBaseUrl}/` : safeBaseUrl,
		);
	} catch {
		return null;
	}

	if (url.origin === new URL(safeBaseUrl).origin) {
		return url.toString();
	}

	return null;
}
