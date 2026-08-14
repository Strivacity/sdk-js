import type { HttpClientResponse } from '@strivacity/sdk-core/types';

const DISALLOWED_PROXY_HEADERS = new Set(['transfer-encoding', 'connection', 'keep-alive', 'content-encoding']);

/**
 * Proxies an HttpClientResponse to a standard Response, preserving headers and status code.
 *
 * @param {HttpClientResponse<T>} response - The HttpClientResponse to proxy.
 * @returns {Response} A new Response object with the same body, status, and headers as the original response.
 * @throws {Error} If the response is not a valid HttpClientResponse.
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

	const setCookie = response.headers.get('set-cookie');

	if (setCookie) {
		proxyHeaders.set('set-cookie', setCookie);
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
 * @returns The resolved URL string if safe, or undefined.
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
