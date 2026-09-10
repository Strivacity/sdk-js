import type { BaseServerSDK } from '@strivacity/sdk-core/types';
import type { RequestEvent, SolidServerSDKInitConfig } from '../../../src/server/types';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { getRequestEvent } from '@solidjs/web';
import { createBaseServerSDK } from '@strivacity/sdk-core/server';
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
		'getSession',
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
