import type { IncomingMessage } from 'node:http';
import type { NextConfig } from 'next';
import type { NextApiRequest } from 'next/types';
import type { HttpClientResponse } from '@strivacity/sdk-core/types';
import { NextRequest, NextResponse } from 'next/server';

interface NextUrlShape {
	basePath?: string;
	locale?: string;
	defaultLocale?: string;
	trailingSlash?: boolean;
}

type RequestWithNextUrl = Request & { nextUrl?: NextUrlShape };
type RequestWithDuplex = Request & { duplex?: 'half' };
type RequestInitWithNext = Omit<RequestInit, 'signal' | 'duplex'> & { nextConfig?: NextConfig; duplex?: 'half'; signal?: AbortSignal };

const DISALLOWED_PROXY_HEADERS = new Set(['transfer-encoding', 'connection', 'keep-alive', 'content-encoding']);

/**
 * Proxies an HttpClientResponse to a NextResponse, preserving headers and status code.
 *
 * @param {HttpClientResponse<T>} response - The HttpClientResponse to proxy.
 * @returns {NextResponse} A NextResponse object representing the proxied response.
 */
export function proxyResponse<T = unknown>(response: HttpClientResponse<T>): NextResponse {
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

	return new NextResponse(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: proxyHeaders,
	});
}

/**
 * Collects Next.js configuration from a Request object, which can be a NextRequest, IncomingMessage, or NextApiRequest.
 *
 * @param input - The Request object from which to collect Next.js configuration.
 * @returns A NextConfig object containing the collected configuration, or undefined if no configuration could be collected.
 */
export function collectFromNextUrl(input?: RequestWithNextUrl | IncomingMessage | NextApiRequest): NextConfig | undefined {
	let config: NextConfig | undefined;

	try {
		const nextUrl = (input as RequestWithNextUrl)?.nextUrl;

		if (nextUrl) {
			// App Router: NextRequest
			if (typeof nextUrl.basePath === 'string' && nextUrl.basePath) {
				config = { basePath: nextUrl.basePath };
			}

			if (typeof nextUrl.locale === 'string' || typeof nextUrl.defaultLocale === 'string') {
				config = {
					...(config || {}),
					i18n: {
						locales: nextUrl.locale ? [nextUrl.locale] : [],
						defaultLocale: nextUrl.defaultLocale ?? '',
					},
				};
			}

			if (typeof nextUrl.trailingSlash === 'boolean') {
				config = { ...(config || {}), trailingSlash: nextUrl.trailingSlash };
			}
		} else {
			// Pages Router: IncomingMessage / NextApiRequest
			const pagesReq = input as NextApiRequest;
			const acceptLanguage = pagesReq?.headers?.['accept-language'];
			const locale = pagesReq?.cookies?.['NEXT_LOCALE'] ?? (typeof acceptLanguage === 'string' ? acceptLanguage.trim() : undefined);

			if (locale) {
				config = { i18n: { locales: [locale], defaultLocale: '' } };
			}
		}
	} catch {
		// ignore inaccessible input
	}

	return config && Object.keys(config).length ? config : undefined;
}

/**
 * Converts a Request or NextRequest to a NextRequest.
 *
 * @param input - The Request or NextRequest object to convert.
 * @returns A NextRequest object representing the input request.
 */
export function toNextRequest(input: Request | NextRequest): NextRequest {
	if (input instanceof NextRequest) {
		return input;
	}

	const nextConfig = collectFromNextUrl(input);

	const init: RequestInitWithNext = {
		method: input.method,
		headers: input.headers,
		body: input.body,
		duplex: (input as RequestWithDuplex).duplex ?? 'half',
		signal: input.signal ?? undefined,
	};

	if (nextConfig) {
		init.nextConfig = nextConfig;
	}

	return new NextRequest(input.url, init);
}

/**
 * Converts a Response or NextResponse to a NextResponse.
 *
 * @param res - The Response or NextResponse object to convert.
 * @returns A NextResponse object representing the response.
 */
export function toNextResponse(res: Response | NextResponse): NextResponse {
	if (res instanceof NextResponse) {
		return res;
	}

	const headers = new Headers(res.headers);

	const nextRes = new NextResponse(res.body, {
		status: res.status,
		statusText: res.statusText,
		headers,
	});

	try {
		if ('url' in res && res.url) {
			(nextRes as NextResponse & { url: string }).url = res.url;
		}
	} catch {
		// ignore if url isn't accessible
	}

	return nextRes;
}

/**
 * Converts an IncomingMessage or NextApiRequest to a Headers object.
 *
 * @param req - The IncomingMessage or NextApiRequest object from which to construct the Headers.
 * @returns A Headers object containing the headers from the request.
 */
export function toHeadersFromIncomingMessage(req: IncomingMessage | NextApiRequest): Headers {
	const headers = new Headers();
	for (const key in req.headers) {
		const value = req.headers[key];
		if (Array.isArray(value)) {
			for (const v of value) {
				headers.append(key, v);
			}
		} else if (value !== undefined) {
			headers.append(key, value);
		}
	}
	return headers;
}

/**
 * Converts an IncomingMessage or NextApiRequest to a URL object.
 *
 * @param req - The IncomingMessage or NextApiRequest object from which to construct the URL.
 * @returns A URL object representing the request URL, or undefined if it cannot be constructed.
 */
export function toUrlFromPagesRouter(req: IncomingMessage | NextApiRequest): URL | undefined {
	try {
		const host = Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host;
		if (!host) return undefined;
		const proto = Array.isArray(req.headers['x-forwarded-proto']) ? req.headers['x-forwarded-proto'][0] : (req.headers['x-forwarded-proto'] as string);
		return new URL(req.url ?? '/', `${proto || 'https'}://${host}`);
	} catch {
		return undefined;
	}
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
