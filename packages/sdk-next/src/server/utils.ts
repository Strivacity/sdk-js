import type { IncomingMessage } from 'node:http';
import type { NextConfig } from 'next';
import type { NextApiRequest } from 'next/types';
import { NextRequest, NextResponse } from 'next/server';
import type { CookieOptions } from './types';

interface NextUrlShape {
	basePath?: string;
	locale?: string;
	defaultLocale?: string;
	trailingSlash?: boolean;
}

type RequestWithNextUrl = Request & { nextUrl?: NextUrlShape };
type RequestWithDuplex = Request & { duplex?: 'half' };
type RequestInitWithNext = Omit<RequestInit, 'signal' | 'duplex'> & { nextConfig?: NextConfig; duplex?: 'half'; signal?: AbortSignal };

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

export function buildCookieString(name: string, value: string, opts: CookieOptions): string {
	let cookie = `${name}=${encodeURIComponent(value)}`;

	if (opts.httpOnly !== false) cookie += '; HttpOnly';
	if (opts.secure !== false) cookie += '; Secure';
	if (opts.path ?? '/') cookie += `; Path=${opts.path ?? '/'}`;
	if (opts.sameSite) cookie += `; SameSite=${opts.sameSite}`;
	if (opts.maxAge) cookie += `; Max-Age=${opts.maxAge}`;
	if (opts.domain) cookie += `; Domain=${opts.domain}`;

	return cookie;
}
