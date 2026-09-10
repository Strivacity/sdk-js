import { test, describe, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { collectFromNextUrl, toNextRequest } from '../../../src/server/utils';

describe('collectFromNextUrl', () => {
	test('returns undefined when no input is given', () => {
		expect(collectFromNextUrl()).toBeUndefined();
	});

	test('returns undefined for a Pages Router request with no locale signal', () => {
		expect(collectFromNextUrl({ headers: {}, cookies: {} } as never)).toBeUndefined();
	});

	test('collects the basePath from a NextRequest whose URL is inside it', () => {
		const req = new NextRequest('https://brandtegrity.io/app/foo', { nextConfig: { basePath: '/app' } });

		// NextURL always reports `locale` as an empty string when no i18n config is set, so the (falsy) i18n block is still collected alongside basePath.
		expect(collectFromNextUrl(req)).toEqual({ basePath: '/app', i18n: { locales: [], defaultLocale: '' } });
	});

	test('collects the locale as i18n config from a NextRequest', () => {
		const req = new NextRequest('https://brandtegrity.io/foo', { nextConfig: { i18n: { locales: ['en', 'hu'], defaultLocale: 'en' } } });

		expect(collectFromNextUrl(req)).toEqual({ i18n: { locales: ['en'], defaultLocale: 'en' } });
	});

	test('collects trailingSlash from a nextUrl-shaped input', () => {
		expect(collectFromNextUrl({ nextUrl: { trailingSlash: true } } as never)).toEqual({ trailingSlash: true });
	});

	test('merges basePath, i18n and trailingSlash when all are present on the nextUrl', () => {
		const input = { nextUrl: { basePath: '/app', locale: 'hu-HU', defaultLocale: 'en-US', trailingSlash: false } };

		expect(collectFromNextUrl(input as never)).toEqual({
			basePath: '/app',
			i18n: { locales: ['hu-HU'], defaultLocale: 'en-US' },
			trailingSlash: false,
		});
	});

	test('collects the locale from the accept-language header on a Pages Router request', () => {
		const input = { headers: { 'accept-language': 'hu-HU' }, cookies: {} };

		expect(collectFromNextUrl(input as never)).toEqual({ i18n: { locales: ['hu-HU'], defaultLocale: '' } });
	});

	test('prefers the NEXT_LOCALE cookie over the accept-language header on a Pages Router request', () => {
		const input = { headers: { 'accept-language': 'hu-HU' }, cookies: { NEXT_LOCALE: 'de-DE' } };

		expect(collectFromNextUrl(input as never)).toEqual({ i18n: { locales: ['de-DE'], defaultLocale: '' } });
	});

	test('returns undefined when reading the input throws', () => {
		const input = new Proxy(
			{},
			{
				get() {
					throw new Error('boom');
				},
			},
		);

		expect(collectFromNextUrl(input as never)).toBeUndefined();
	});
});

describe('toNextRequest', () => {
	test('returns a NextRequest unchanged', () => {
		const req = new NextRequest('https://brandtegrity.io/foo');

		expect(toNextRequest(req)).toBe(req);
	});

	test('builds a NextRequest from a plain Request, preserving method, url and headers', () => {
		const req = new Request('https://brandtegrity.io/foo', { method: 'POST', headers: { 'x-custom': 'value' } });

		const result = toNextRequest(req);

		expect(result).toBeInstanceOf(NextRequest);
		expect(result.method).toBe('POST');
		expect(result.url).toBe('https://brandtegrity.io/foo');
		expect(result.headers.get('x-custom')).toBe('value');
	});

	test('preserves the request body', async () => {
		const req = new Request('https://brandtegrity.io/foo', { method: 'POST', body: 'hello world' });

		const result = toNextRequest(req);

		await expect(result.text()).resolves.toBe('hello world');
	});

	test('preserves a given abort signal', () => {
		const controller = new AbortController();
		const req = new Request('https://brandtegrity.io/foo', { signal: controller.signal });

		const result = toNextRequest(req);

		expect(result.signal).toBe(controller.signal);
	});

	test('collects and applies Next.js config found on the input', () => {
		const req = new Request('https://brandtegrity.io/app/foo') as Request & { nextUrl?: { basePath?: string } };
		req.nextUrl = { basePath: '/app' };

		const result = toNextRequest(req);

		expect(result.nextUrl.basePath).toBe('/app');
	});
});
