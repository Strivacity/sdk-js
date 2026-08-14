import type { Response as ExpressResponse } from 'express';
import type { HttpClientResponse } from '@strivacity/sdk-core/types';

const DISALLOWED_PROXY_HEADERS = new Set(['transfer-encoding', 'connection', 'keep-alive', 'content-encoding']);

/**
 * Proxies an `HttpClientResponse` (returned by the SDK's HTTP client) onto an Express response,
 * preserving status code and headers (including any `Set-Cookie` issued by the identity provider).
 *
 * @param {HttpClientResponse<T>} response - The HttpClientResponse to proxy.
 * @param {ExpressResponse} res - The Express response to write to.
 */
export function proxyResponse<T = unknown>(response: HttpClientResponse<T>, res: ExpressResponse): ExpressResponse<T> {
	for (const [key, value] of response.headers.entries()) {
		if (key.toLowerCase() === 'set-cookie' || DISALLOWED_PROXY_HEADERS.has(key.toLowerCase())) {
			continue;
		}

		res.setHeader(key, value);
	}

	const setCookie = response.headers.get('set-cookie');

	if (setCookie) {
		res.setHeader('set-cookie', setCookie);
	}

	return res.status(response.status).send(response.body);
}

/**
 * Returns a safe absolute redirect URL only if it shares the same origin as `safeBaseUrl`, preventing open redirects.
 *
 * @param dangerousRedirect - The untrusted redirect path or URL.
 * @param safeBaseUrl - The trusted base URL whose origin is used as the allowed origin.
 * @returns The resolved URL string if safe, or `null`.
 */
export function toSafeRedirect(dangerousRedirect: string | undefined | null, safeBaseUrl: string): string | null {
	if (!dangerousRedirect) {
		return null;
	}

	let url: URL;

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

/**
 * Returns the origin of an incoming Express request, honoring `X-Forwarded-*` headers set by proxies.
 *
 * @param {{ protocol: string; get(name: string): string | undefined }} req - The incoming Express request.
 * @returns {string} The resolved origin.
 */
export function getOrigin(req: { protocol: string; get(name: string): string | undefined }): string {
	return `${req.protocol}://${req.get('host')}`;
}
