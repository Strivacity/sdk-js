import type { H3Event } from 'h3';
import { vi } from 'vitest';

/**
 * Builds a minimal fake H3Event backed by a real Node-style req/res pair, since h3's
 * getCookie/setCookie/deleteCookie read and write through `event.node.req`/`event.node.res`
 * rather than through any adapter, and there is no lighter public h3 test helper for this.
 */
export function createFakeH3Event(cookieHeader = ''): H3Event {
	const responseHeaders = new Map<string, string | Array<string>>();

	const res = {
		setHeader: vi.fn((name: string, value: string | Array<string>) => responseHeaders.set(name, value)),
		getHeader: vi.fn((name: string) => responseHeaders.get(name)),
		removeHeader: vi.fn((name: string) => responseHeaders.delete(name)),
		appendHeader: vi.fn((name: string, value: string) => {
			const existing = responseHeaders.get(name);

			if (existing === undefined) {
				responseHeaders.set(name, value);
			} else {
				responseHeaders.set(name, ([] as Array<string>).concat(existing, value));
			}
		}),
	};

	// toWebRequest() (used by createSessionIdCookieStorage) builds a Request from `event.headers` via
	// `new Request(url, { headers })`. Under vitest's happy-dom environment that constructor silently
	// drops the "cookie" header (a forbidden request header per the Fetch spec, unlike real Node's own
	// fetch implementation, which preserves it) - so it's set here via `.set()` on an already-constructed
	// Request instead, then exposed through `event.web.request`, which toWebRequest() returns as-is
	// without reconstructing.
	const webRequest = new Request('http://localhost/');
	if (cookieHeader) {
		webRequest.headers.set('cookie', cookieHeader);
	}

	return {
		node: { req: { url: '/', method: 'GET', headers: { cookie: cookieHeader } }, res },
		context: {},
		path: '/',
		method: 'GET',
		headers: webRequest.headers,
		web: { request: webRequest },
	} as unknown as H3Event;
}

export function getResponseCookies(event: H3Event): Array<string> {
	const setCookie = (event as unknown as { node: { res: { getHeader: (name: string) => string | Array<string> | undefined } } }).node.res.getHeader(
		'set-cookie',
	);

	if (!setCookie) {
		return [];
	}

	return Array.isArray(setCookie) ? setCookie : [setCookie];
}
