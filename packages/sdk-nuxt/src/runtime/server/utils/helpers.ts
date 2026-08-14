import type { H3Event } from 'h3';
import type { HttpClientResponse } from '@strivacity/sdk-core/types';
import { DISALLOWED_PROXY_HEADERS } from '@strivacity/sdk-core/utils';

/**
 * Proxies an HttpClientResponse to a Web Response, preserving headers and status code.
 */
export function proxyResponse<T = unknown>(response: HttpClientResponse<T>): Response {
	const proxyHeaders = new Headers();

	for (const [key, value] of response.headers.entries()) {
		if (key.toLowerCase() === 'set-cookie') continue;
		if (!DISALLOWED_PROXY_HEADERS.has(key.toLowerCase())) {
			proxyHeaders.set(key, value);
		}
	}

	const setCookie = response.headers.get('set-cookie');

	if (setCookie) {
		proxyHeaders.set('set-cookie', setCookie);
	}

	return new Response(response.body ?? null, {
		status: response.status,
		headers: proxyHeaders,
	});
}

/**
 * Extracts the accept-language locale from the event's request headers.
 */
export function getLocaleFromEvent(event: H3Event): string | undefined {
	const acceptLanguage = event.headers.get('accept-language');

	if (!acceptLanguage) return undefined;

	return acceptLanguage.split(',')[0]?.split(';')[0]?.trim();
}

/**
 * Returns a safe absolute redirect URL only if it shares the same origin as safeBaseUrl, preventing open redirects.
 *
 * @param dangerousRedirect - The untrusted redirect path or URL.
 * @param safeBaseUrl - The trusted base URL whose origin is used as the allowed origin.
 * @returns The resolved URL string if safe, or undefined.
 */
export function toSafeRedirect(dangerousRedirect: string | undefined | null, safeBaseUrl: string): string | null {
	let url: URL;

	if (!dangerousRedirect) {
		return null;
	}

	try {
		safeBaseUrl = new URL(safeBaseUrl).origin;
		url = new URL(dangerousRedirect?.startsWith('/') ? dangerousRedirect.slice(1) : dangerousRedirect, safeBaseUrl);
	} catch {
		return null;
	}

	if (url.origin === new URL(safeBaseUrl).origin) {
		return url.toString();
	}

	return null;
}
