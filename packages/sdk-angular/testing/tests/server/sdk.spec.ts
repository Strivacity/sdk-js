import type { Router } from 'express';
import type { AngularServerRequest } from '../../../src/server/types';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createBaseServerSDK } from '@strivacity/sdk-core/server';
import { applyResponse } from '../../../src/server/utils';
import { createServerSDK } from '../../../src/server/sdk';
import { createServerOptions } from '@strivacity/testing/mocks/sdk';

vi.mock('@strivacity/sdk-core/server', async (importOriginal) => ({
	...(await importOriginal<typeof import('@strivacity/sdk-core/server')>()),
	createBaseServerSDK: vi.fn(),
}));

vi.mock('../../../src/server/utils', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../../src/server/utils')>()),
	applyResponse: vi.fn().mockResolvedValue(undefined),
}));

function createBase() {
	return {
		options: { clientId: 'client-id' },
		getSession: vi.fn().mockResolvedValue(null),
		updateSession: vi.fn().mockResolvedValue(undefined),
		refreshSession: vi.fn().mockResolvedValue({ access_token: 'refreshed' }),
		revokeSession: vi.fn().mockResolvedValue(undefined),
		getEntrySession: vi.fn().mockResolvedValue({ sessionId: 'session-1' }),
		completeLogin: vi.fn().mockResolvedValue({ access_token: 'access-token' }),
		logout: vi.fn().mockResolvedValue(undefined),
		handleLogin: vi.fn(),
		handleRegister: vi.fn(),
		handleCallback: vi.fn(),
		handleRefresh: vi.fn(),
		handleRevoke: vi.fn(),
		handleEntry: vi.fn(),
		handleLogout: vi.fn(),
		handleBackChannelLogout: vi.fn(),
		handler: vi.fn().mockResolvedValue(new Response(null)),
	};
}

function getRouteHandler(router: Router, method: string, path: string) {
	const layer = (
		router.stack as Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: (...args: Array<unknown>) => unknown }> } }>
	).find((candidate) => candidate.route?.path === path && candidate.route.methods[method]);

	if (!layer?.route) {
		throw new Error(`No ${method.toUpperCase()} ${path} route registered`);
	}

	return layer.route.stack[0].handle as (req: unknown, res: unknown, next: (error?: unknown) => void) => Promise<void>;
}

beforeEach(() => {
	vi.mocked(createBaseServerSDK).mockReset();
	vi.mocked(applyResponse).mockClear();
});

describe('createServerSDK', () => {
	test('creates the base server sdk with a toRequest adapter that converts Express requests to standard Requests, and the given config', () => {
		const base = createBase();
		vi.mocked(createBaseServerSDK).mockReturnValue(base as never);
		const initConfig = createServerOptions();

		createServerSDK(initConfig);

		expect(createBaseServerSDK).toHaveBeenCalledTimes(1);
		const [adapter, forwardedConfig] = vi.mocked(createBaseServerSDK).mock.calls[0];

		expect(forwardedConfig).toBe(initConfig);

		const req = {
			originalUrl: '/callback?code=abc',
			protocol: 'https',
			method: 'GET',
			headers: {},
			get: () => 'brandtegrity.io',
		} as unknown as AngularServerRequest;
		const webRequest = adapter.toRequest(req);

		expect(webRequest.url).toBe('https://brandtegrity.io/callback?code=abc');
	});

	test('passes an already-standard Request straight through the toRequest adapter', () => {
		const base = createBase();
		vi.mocked(createBaseServerSDK).mockReturnValue(base as never);
		createServerSDK(createServerOptions());

		const [adapter] = vi.mocked(createBaseServerSDK).mock.calls[0];
		const request = new Request('https://brandtegrity.io');

		expect(adapter.toRequest(request)).toBe(request);
	});

	test('exposes the underlying options', () => {
		const base = createBase();
		vi.mocked(createBaseServerSDK).mockReturnValue(base as never);

		const sdk = createServerSDK(createServerOptions());

		expect(sdk.options).toBe(base.options);
	});

	test.each([
		['getSession', [{} as never], null],
		['updateSession', [{ access_token: 'a' } as never, {} as never], undefined],
		['refreshSession', [{} as never], { access_token: 'refreshed' }],
		['revokeSession', [{} as never], undefined],
		['getEntrySession', ['https://brandtegrity.io/entry'], { sessionId: 'session-1' }],
		['completeLogin', [{ code: 'abc' }, {} as never], { access_token: 'access-token' }],
		['logout', ['https://brandtegrity.io', {} as never], undefined],
		['handleLogin', [{} as never], new Response(null)],
		['handleRegister', [{} as never], new Response(null)],
		['handleCallback', [{} as never], new Response(null)],
		['handleRefresh', [{} as never], new Response(null)],
		['handleRevoke', [{} as never], new Response(null)],
		['handleEntry', [{} as never], new Response(null)],
		['handleLogout', [{} as never], new Response(null)],
		['handleBackChannelLogout', [{} as never], new Response(null)],
	] as const)('%s calls through to the base server sdk with the same arguments and return value', async (method, args) => {
		const base = createBase();
		vi.mocked(createBaseServerSDK).mockReturnValue(base as never);
		const sdk = createServerSDK(createServerOptions());

		const result = await (sdk[method as keyof typeof sdk] as (...a: Array<unknown>) => unknown)(...args);
		const baseMock = base[method as keyof typeof base] as ReturnType<typeof vi.fn>;

		expect(baseMock).toHaveBeenCalledWith(...args);
		expect(result).toEqual(await baseMock.mock.results[0].value);
	});

	test('handler calls through to the base server sdk', async () => {
		const base = createBase();
		vi.mocked(createBaseServerSDK).mockReturnValue(base as never);
		const sdk = createServerSDK(createServerOptions());
		const req = {} as AngularServerRequest;

		const result = await sdk.handler(req);

		expect(base.handler).toHaveBeenCalledWith(req);
		expect(result).toBe(await base.handler.mock.results[0].value);
	});

	describe('handlers router', () => {
		test.each([
			['GET', '/login', 'handleLogin'],
			['GET', '/register', 'handleRegister'],
			['GET', '/callback', 'handleCallback'],
			['GET', '/refresh', 'handleRefresh'],
			['GET', '/revoke', 'handleRevoke'],
			['GET', '/entry', 'handleEntry'],
			['GET', '/logout', 'handleLogout'],
			['POST', '/backchannel-logout', 'handleBackChannelLogout'],
		] as const)('%s %s calls base.%s with the request and applies the resulting response', async (method, path, baseMethod) => {
			const base = createBase();
			const response = new Response(null, { status: 200 });
			vi.mocked(base[baseMethod]).mockResolvedValue(response);
			vi.mocked(createBaseServerSDK).mockReturnValue(base as never);

			const sdk = createServerSDK(createServerOptions());
			const handler = getRouteHandler(sdk.handlers, method.toLowerCase(), path);
			const req = { id: 'req' };
			const res = { id: 'res' };
			const next = vi.fn();

			await handler(req, res, next);

			expect(base[baseMethod]).toHaveBeenCalledWith(req);
			expect(applyResponse).toHaveBeenCalledWith(response, res);
			expect(next).not.toHaveBeenCalled();
		});

		test.each([
			['GET', '/login', 'handleLogin'],
			['GET', '/register', 'handleRegister'],
			['GET', '/callback', 'handleCallback'],
			['GET', '/refresh', 'handleRefresh'],
			['GET', '/revoke', 'handleRevoke'],
			['GET', '/entry', 'handleEntry'],
			['GET', '/logout', 'handleLogout'],
			['POST', '/backchannel-logout', 'handleBackChannelLogout'],
		] as const)('%s %s forwards a rejection from base.%s to next() instead of applying a response', async (method, path, baseMethod) => {
			const base = createBase();
			const error = new Error('boom');
			vi.mocked(base[baseMethod]).mockRejectedValue(error);
			vi.mocked(createBaseServerSDK).mockReturnValue(base as never);

			const sdk = createServerSDK(createServerOptions());
			const handler = getRouteHandler(sdk.handlers, method.toLowerCase(), path);
			const next = vi.fn();

			await handler({}, {}, next);

			expect(next).toHaveBeenCalledWith(error);
			expect(applyResponse).not.toHaveBeenCalled();
		});
	});
});
