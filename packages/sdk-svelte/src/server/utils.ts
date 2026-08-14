import type { HttpClientResponse } from '@strivacity/sdk-core/types';

export * from '@strivacity/sdk-core/utils';

export const DISALLOWED_PROXY_HEADERS = new Set(['transfer-encoding', 'connection', 'keep-alive', 'content-encoding']);
export const BACKCHANNEL_LOGOUT_EVENT = 'http://schemas.openid.net/event/backchannel-logout';
export const RETURN_TO_COOKIE = 'sty.returnTo';

/**
 * Proxies an HttpClientResponse to a Web Response, preserving headers and status code.
 *
 * @param {HttpClientResponse<T>} response - The HttpClientResponse to proxy.
 * @returns {Response} A Response object representing the proxied response.
 */
export function proxyResponse<T = unknown>(response: HttpClientResponse<T>, cookies: Array<string> = []): Response {
	const proxyHeaders = new Headers();

	for (const [key, value] of response.headers.entries()) {
		if (key.toLowerCase() === 'set-cookie') {
			continue;
		}

		if (!DISALLOWED_PROXY_HEADERS.has(key.toLowerCase())) {
			proxyHeaders.set(key, value);
		}
	}

	const proxyCookies =
		response.headers
			.get('set-cookie')
			?.split(',')
			.map((cookie) => cookie.trim()) ?? [];

	if (proxyCookies.length) {
		cookies.push(...proxyCookies);
	}

	if (cookies?.length) {
		proxyHeaders.set('set-cookie', cookies.join(', '));
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: proxyHeaders,
	});
}

/**
 * Returns a safe absolute redirect URL only if it shares the same origin as safeBaseUrl, preventing open redirects.
 *
 * @param dangerousRedirect - The untrusted redirect path or URL.
 * @param safeBaseUrl - The trusted base URL whose origin is used as the allowed origin.
 * @returns The resolved URL string if safe, or null.
 */
export function toSafeRedirect(dangerousRedirect: string | undefined | null, safeBaseUrl: string): string | null {
	let url: URL;

	if (!dangerousRedirect) {
		return null;
	}

	try {
		url = new URL(
			dangerousRedirect?.startsWith('/') ? dangerousRedirect.slice(1) : dangerousRedirect,
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
