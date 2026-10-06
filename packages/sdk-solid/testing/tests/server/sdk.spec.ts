import type { BaseServerSDK } from '@strivacity/sdk-core/types';
import type { RequestEvent, SolidServerSDKInitConfig } from '../../../src/server/types';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { getRequestEvent } from '@solidjs/web';
import { createBaseServerSDK } from '@strivacity/sdk-core/server';
import { pushSetCookie } from '@strivacity/sdk-core/utils';
import { createServerSDK } from '../../../src/server/sdk';
import { createMockBaseServerSDK, createServerOptions } from '@strivacity/testing/mocks/sdk';

vi.mock('@strivacity/sdk-core/server', async (importOriginal) => ({
	...(await importOriginal<typeof import('@strivacity/sdk-core/server')>()),
	createBaseServerSDK: vi.fn(),
}));

vi.mock('@solidjs/web', async (importOriginal) => ({
	...(await importOriginal<typeof import('@solidjs/web')>()),
	getRequestEvent: vi.fn(),
}));

type Event = RequestEvent | undefined;

function installBase(overrides?: Record<string, unknown>) {
	const base = createMockBaseServerSDK<BaseServerSDK<Event>>(overrides);
	vi.mocked(createBaseServerSDK).mockReturnValue(base);

	return base;
}

function initConfig(): SolidServerSDKInitConfig {
	return createServerOptions();
}

function requestEvent(url = 'https://brandtegrity.io'): RequestEvent {
	return { request: new Request(url) } as RequestEvent;
}

function pageRequest(url: string): Request {
	return new Request(url, { headers: { accept: 'text/html,application/xhtml+xml' } });
}

beforeEach(() => {
	vi.mocked(createBaseServerSDK).mockReset();
	vi.mocked(getRequestEvent).mockReset();
});

describe('createServerSDK', () => {
	test('creates the base server sdk with the given config, forwarded unchanged', () => {
		installBase();
		const config = initConfig();

		createServerSDK(config);

		expect(createBaseServerSDK).toHaveBeenCalledTimes(1);
		const [, forwardedConfig] = vi.mocked(createBaseServerSDK).mock.calls[0];
		expect(forwardedConfig).toBe(config);
	});

	test('exposes the base server sdk options', () => {
		const base = installBase({ options: { loginUri: '/login' } });
		const sdk = createServerSDK(initConfig());

		expect(sdk.options).toBe(base.options);
	});

	describe('adapter', () => {
		test("toRequest returns the given request event's request unchanged", () => {
			installBase();
			createServerSDK(initConfig());

			const [adapter] = vi.mocked(createBaseServerSDK).mock.calls[0];
			const event = requestEvent();

			expect(adapter.toRequest(event)).toBe(event.request);
		});

		test('redirect builds a real Solid redirect Response to the given url and status', () => {
			installBase();
			createServerSDK(initConfig());

			const [adapter] = vi.mocked(createBaseServerSDK).mock.calls[0];
			const response = adapter.redirect(new URL('https://brandtegrity.io/login'), 303);

			expect(response.status).toBe(303);
			expect(response.headers.get('location')).toBe('https://brandtegrity.io/login');
		});

		test('redirect defaults to a 302 status when none is given', () => {
			installBase();
			createServerSDK(initConfig());

			const [adapter] = vi.mocked(createBaseServerSDK).mock.calls[0];
			const response = adapter.redirect(new URL('https://brandtegrity.io/login'));

			expect(response.status).toBe(302);
		});
	});

	describe('middleware', () => {
		test('serves the base handler response for the ambient request event when it resolves a Response', async () => {
			const response = new Response(null, { status: 200 });
			const base = installBase({ handler: vi.fn().mockResolvedValue(response) });
			const event = requestEvent();
			vi.mocked(getRequestEvent).mockReturnValue(event);
			const sdk = createServerSDK(initConfig());
			const next = vi.fn();

			const result = await sdk.middleware(new Request('https://brandtegrity.io'), next);

			expect(base.handler).toHaveBeenCalledWith(event);
			expect(result).toBe(response);
			expect(next).not.toHaveBeenCalled();
		});

		test('falls through to next() with the original request when the base handler resolves null', async () => {
			const base = installBase({ handler: vi.fn().mockResolvedValue(null) });
			vi.mocked(getRequestEvent).mockReturnValue(requestEvent());
			const nextResponse = new Response('next');
			const next = vi.fn().mockResolvedValue(nextResponse);
			const sdk = createServerSDK(initConfig());
			const request = new Request('https://brandtegrity.io');

			const result = await sdk.middleware(request, next);

			expect(base.handler).toHaveBeenCalled();
			expect(result).toBe(nextResponse);
			expect(next).toHaveBeenCalledWith(request);
		});

		test('flushes a cookie queued while next() runs (e.g. a custom guard calling refreshSession) onto the final response', async () => {
			installBase({ handler: vi.fn().mockResolvedValue(null) });
			const event = requestEvent();
			vi.mocked(getRequestEvent).mockReturnValue(event);
			const next = vi.fn().mockImplementation(async () => {
				pushSetCookie(event, 'sty.session=rotated; Path=/');
				return new Response('next');
			});
			const sdk = createServerSDK(initConfig());

			const result = await sdk.middleware(new Request('https://brandtegrity.io'), next);

			expect(result.headers.getSetCookie()).toEqual(['sty.session=rotated; Path=/']);
		});

		test('refreshes the session before rendering, so the rotated cookie is on the (streamed) response', async () => {
			const event = requestEvent();
			const base = installBase({
				handler: vi.fn().mockResolvedValue(null),
				getSession: vi.fn().mockImplementation(() => {
					pushSetCookie(event, 'sty.session=rotated; Path=/');
					return Promise.resolve({ access_token: 'new' });
				}),
			});
			vi.mocked(getRequestEvent).mockReturnValue(event);
			// A streamed render resolves next() before the page's own session read has finished
			const next = vi.fn().mockImplementation(() => {
				expect(base.getSession).toHaveBeenCalledWith(event);
				return Promise.resolve(new Response('stream'));
			});
			const sdk = createServerSDK(initConfig());

			const result = await sdk.middleware(pageRequest('https://brandtegrity.io/profile'), next);

			expect(result.headers.getSetCookie()).toEqual(['sty.session=rotated; Path=/']);
		});

		test('shares the refresh with server functions called during SSR on a copy of the request event', async () => {
			const event = requestEvent('https://brandtegrity.io/profile');
			const base = installBase({ handler: vi.fn().mockResolvedValue(null), getSession: vi.fn().mockResolvedValue({ access_token: 'new' }) });
			vi.mocked(getRequestEvent).mockReturnValue(event);
			const sdk = createServerSDK(initConfig());
			// Solid invokes a server function during SSR with `{ ...event, locals: { ...event.locals } }`
			const next = vi.fn().mockImplementation(async () => {
				vi.mocked(getRequestEvent).mockReturnValue({ ...event, locals: {} });
				await sdk.getSession();
				return new Response('page');
			});

			await sdk.middleware(pageRequest('https://brandtegrity.io/profile'), next);

			expect(base.getSession).toHaveBeenCalledTimes(2);
			expect(vi.mocked(base.getSession).mock.calls.every(([calledWith]) => calledWith === event)).toBe(true);
		});

		test('does not refresh the session for non-page requests sent in parallel with the page', async () => {
			const base = installBase({ handler: vi.fn().mockResolvedValue(null) });
			vi.mocked(getRequestEvent).mockReturnValue(requestEvent('https://brandtegrity.io/favicon.ico'));
			const next = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
			const sdk = createServerSDK(initConfig());

			await sdk.middleware(new Request('https://brandtegrity.io/favicon.ico', { headers: { accept: 'image/*' } }), next);

			expect(base.getSession).not.toHaveBeenCalled();
			expect(next).toHaveBeenCalledTimes(1);
		});

		test('still renders the page when reading the session fails', async () => {
			installBase({ handler: vi.fn().mockResolvedValue(null), getSession: vi.fn().mockRejectedValue(new Error('bad cookie')) });
			vi.mocked(getRequestEvent).mockReturnValue(requestEvent());
			const next = vi.fn().mockResolvedValue(new Response('page'));
			const sdk = createServerSDK(initConfig());

			const result = await sdk.middleware(pageRequest('https://brandtegrity.io'), next);

			expect(await result.text()).toBe('page');
		});

		test('falls through to next() without calling the base handler when there is no ambient request event', async () => {
			const base = installBase();
			vi.mocked(getRequestEvent).mockReturnValue(undefined);
			const next = vi.fn().mockResolvedValue(new Response('next'));
			const sdk = createServerSDK(initConfig());
			const request = new Request('https://brandtegrity.io');

			await sdk.middleware(request, next);

			expect(base.handler).not.toHaveBeenCalled();
			expect(next).toHaveBeenCalledWith(request);
		});
	});

	const singleEventMethods = [
		'refreshSession',
		'revokeSession',
		'handleLogin',
		'handleRegister',
		'handleCallback',
		'handleRefresh',
		'handleRevoke',
		'handleEntry',
		'handleLogout',
		'handleBackChannelLogout',
		'handler',
	] as const;

	test.each(singleEventMethods)(
		'%s calls through to the base server sdk with an explicitly given event, without consulting the ambient request event',
		async (method) => {
			const base = installBase();
			const sdk = createServerSDK(initConfig());
			const event = requestEvent();

			await (sdk[method] as (e: RequestEvent) => unknown)(event);

			expect(base[method]).toHaveBeenCalledWith(event);
			expect(getRequestEvent).not.toHaveBeenCalled();
		},
	);

	test.each(singleEventMethods)('%s falls back to the ambient request event when none is explicitly given', async (method) => {
		const base = installBase();
		const event = requestEvent();
		vi.mocked(getRequestEvent).mockReturnValue(event);
		const sdk = createServerSDK(initConfig());

		await (sdk[method] as () => unknown)();

		expect(base[method]).toHaveBeenCalledWith(event);
	});

	test('getSession passes its params through, with an explicit or the ambient request event', async () => {
		const base = installBase();
		const ambient = requestEvent();
		const explicit = requestEvent();
		vi.mocked(getRequestEvent).mockReturnValue(ambient);
		const sdk = createServerSDK(initConfig());

		await sdk.getSession(explicit, { autoRefresh: false });
		await sdk.getSession();

		expect(base.getSession).toHaveBeenNthCalledWith(1, explicit, { autoRefresh: false });
		expect(base.getSession).toHaveBeenNthCalledWith(2, ambient, undefined);
	});

	test('getEntrySession calls through to the base server sdk with the given entry url, unaffected by event resolution', async () => {
		const base = installBase();
		const sdk = createServerSDK(initConfig());

		await sdk.getEntrySession('https://brandtegrity.io/entry');

		expect(base.getEntrySession).toHaveBeenCalledWith('https://brandtegrity.io/entry');
		expect(getRequestEvent).not.toHaveBeenCalled();
	});

	test.each([
		['updateSession', [{ access_token: 'a' }]],
		['completeLogin', [{ code: 'abc' }]],
		['logout', ['https://brandtegrity.io']],
	] as const)('%s forwards its first argument and resolves the given event as the second', async (method, args) => {
		const base = installBase();
		const sdk = createServerSDK(initConfig());
		const event = requestEvent();

		await (sdk[method] as (...a: Array<unknown>) => unknown)(...args, event);

		expect(base[method]).toHaveBeenCalledWith(...args, event);
	});

	test.each([
		['updateSession', [{ access_token: 'a' }]],
		['completeLogin', [{ code: 'abc' }]],
		['logout', ['https://brandtegrity.io']],
	] as const)('%s falls back to the ambient request event when none is explicitly given', async (method, args) => {
		const base = installBase();
		const event = requestEvent();
		vi.mocked(getRequestEvent).mockReturnValue(event);
		const sdk = createServerSDK(initConfig());

		await (sdk[method] as (...a: Array<unknown>) => unknown)(...args, undefined);

		expect(base[method]).toHaveBeenCalledWith(...args, event);
	});
});
