import type { IncomingMessage } from 'node:http';
import type { NextConfig } from 'next';
import type { NextApiRequest } from 'next/types';
import { NextRequest } from 'next/server';

interface NextUrlShape {
	basePath?: string;
	locale?: string;
	defaultLocale?: string;
	trailingSlash?: boolean;
}

type RequestWithNextUrl = Request & { nextUrl?: NextUrlShape };
type RequestWithDuplex = Request & { duplex?: 'half' };
type RequestInitWithNext = Omit<RequestInit, 'signal' | 'duplex'> & { nextConfig?: NextConfig; duplex?: 'half'; signal?: AbortSignal };

export * from '@strivacity/sdk-core/utils';

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
