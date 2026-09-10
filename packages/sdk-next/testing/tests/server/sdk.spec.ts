import type { NextApiRequest, NextApiResponse } from 'next';
import { describe, test, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createBaseServerSDK } from '@strivacity/sdk-core/server';
import { ConfigurationError } from '@strivacity/sdk-core/utils/errors';
import { createMockBaseServerSDK } from '@strivacity/testing/mocks/sdk';
import { createServerSDK } from '../../../src/server/sdk';
import { apiAppRouteHandlerFactory, apiPageRouteHandlerFactory } from '../../../src/server/handlers/api';
import { appRouteHandlerFactory, pageRouteHandlerFactory } from '../../../src/server/handlers/route';
import type { BaseServerSDK, NextServerSDKInitConfig, PagesRouterRequest } from '../../../src/server/types';

vi.mock('@strivacity/sdk-core/server', async (importOriginal) => ({
	...(await importOriginal<typeof import('@strivacity/sdk-core/server')>()),
	createBaseServerSDK: vi.fn(),
}));

vi.mock('../../../src/server/handlers/api', () => ({
	apiAppRouteHandlerFactory: vi.fn(),
	apiPageRouteHandlerFactory: vi.fn(),
}));

vi.mock('../../../src/server/handlers/route', () => ({
	appRouteHandlerFactory: vi.fn(),
	pageRouteHandlerFactory: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies: vi.fn() }));

type Event = NextRequest | Request | PagesRouterRequest | undefined;

const validInitConfig = { issuer: 'https://brandtegrity.io', clientId: 'client-id', redirectUri: 'https://brandtegrity.io/callback', secret: 'my-secret' };

function installBase(overrides?: Record<string, unknown>) {
	const base = createMockBaseServerSDK<BaseServerSDK<Event>>(overrides);
	vi.mocked(createBaseServerSDK).mockReturnValue(base);

	return base;
}

describe('createServerSDK', () => {
	test('throws a ConfigurationError when neither a storage nor a secret is given', () => {
		expect(() => createServerSDK({ issuer: 'https://brandtegrity.io', clientId: 'client-id', redirectUri: 'https://brandtegrity.io/callback' })).toThrow(
			new ConfigurationError('Secret is required for encrypted cookie storage'),
		);
		expect(createBaseServerSDK).not.toHaveBeenCalled();
	});

	test('builds a default encrypted cookie storage and a default cookieMaxAge from the secret when no storage is given', () => {
		installBase();

		createServerSDK(validInitConfig);

		const initConfig = vi.mocked(createBaseServerSDK).mock.calls[0][1] as NextServerSDKInitConfig;
		expect(initConfig.storage).toBeDefined();
		expect(initConfig.cookieMaxAge).toBe(30 * 24 * 60 * 60);
	});

	test('does not override an explicitly given cookieMaxAge', () => {
		installBase();

		createServerSDK({ ...validInitConfig, cookieMaxAge: 100 });

		const initConfig = vi.mocked(createBaseServerSDK).mock.calls[0][1] as NextServerSDKInitConfig;
		expect(initConfig.cookieMaxAge).toBe(100);
	});

	test('does not require a secret or build a default storage when a storage is explicitly given', () => {
		installBase();
		const storage = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };

		createServerSDK({
			issuer: 'https://brandtegrity.io',
			clientId: 'client-id',
			redirectUri: 'https://brandtegrity.io/callback',
			storage: storage,
		});

		const initConfig = vi.mocked(createBaseServerSDK).mock.calls[0][1] as NextServerSDKInitConfig;
		expect(initConfig.storage).toBe(storage);
	});

	test('wires a real toRequest/redirect adapter into the (unmocked) base server sdk', async () => {
		const actual = await vi.importActual<typeof import('@strivacity/sdk-core/server')>('@strivacity/sdk-core/server');
		vi.mocked(createBaseServerSDK).mockImplementation(actual.createBaseServerSDK);
		// NOTE: the default encrypted cookie storage's set/delete branch on `res` rather than `req`, so cleaning up the (nonexistent) session
		// during a revoke still falls back to next/headers' cookies(), even though a real request is given here.
		vi.mocked(cookies).mockResolvedValue({ get: vi.fn(), set: vi.fn(), delete: vi.fn() } as never);
		const sdk = createServerSDK(validInitConfig);

		const response = await sdk.handleRevoke(new Request('https://brandtegrity.io/auth/revoke'));

		expect(response.status).toBe(302);
		expect(response.headers.get('location')).toBe('https://brandtegrity.io/');
	});

	test('exposes the base server sdk options', () => {
		const base = installBase({ options: { loginUri: '/login' } });
		const sdk = createServerSDK(validInitConfig);

		expect(sdk.options).toBe(base.options);
	});

	test.each([
		['getSession', [{}]],
		['refreshSession', [{}]],
		['revokeSession', [{}]],
		['getEntrySession', ['https://brandtegrity.io/entry']],
		['completeLogin', [{ code: 'abc' }, {}]],
		['logout', ['https://brandtegrity.io', {}]],
		['handleLogin', [{}]],
		['handleRegister', [{}]],
		['handleCallback', [{}]],
		['handleRefresh', [{}]],
		['handleRevoke', [{}]],
		['handleEntry', [{}]],
		['handleLogout', [{}]],
		['handleBackChannelLogout', [{}]],
	] as const)('%s calls through to the base server sdk with the same arguments', async (method, args) => {
		const base = installBase();
		const sdk = createServerSDK(validInitConfig);

		await (sdk[method] as (...a: Array<unknown>) => unknown)(...args);

		expect(base[method]).toHaveBeenCalledWith(...args);
	});

	test('updateSession calls through to the base server sdk, preserving the (session, event) argument order', async () => {
		const base = installBase();
		const sdk = createServerSDK(validInitConfig);
		const session = { access_token: 'access-token' };
		const event = {};

		await sdk.updateSession(session, event as never);

		expect(base.updateSession).toHaveBeenCalledWith(session, event);
	});

	describe('handler', () => {
		test('returns the base handler response unchanged when it resolves a Response', async () => {
			const response = new Response(null, { status: 200 });
			const base = installBase({ handler: vi.fn().mockResolvedValue(response) });
			const sdk = createServerSDK(validInitConfig);

			await expect(sdk.handler({})).resolves.toBe(response);
			expect(base.handler).toHaveBeenCalledWith({});
		});

		test('returns a 404 NextResponse when the base handler resolves null', async () => {
			installBase({ handler: vi.fn().mockResolvedValue(null) });
			const sdk = createServerSDK(validInitConfig);

			const response = await sdk.handler({});

			expect(response.status).toBe(404);
		});
	});

	describe('withApiAuthRequired', () => {
		test('dispatches to the App Router factory when the request is a Request instance', async () => {
			const base = installBase();
			const sdk = createServerSDK(validInitConfig);
			const wrappedAppRoute = vi.fn().mockResolvedValue(new Response());
			const appRouteHandler = vi.fn().mockReturnValue(wrappedAppRoute);
			vi.mocked(apiAppRouteHandlerFactory).mockReturnValue(appRouteHandler as never);
			const apiRoute = vi.fn();
			const req = new NextRequest('https://brandtegrity.io/api/secret');
			const ctx = { params: Promise.resolve({}) };

			await sdk.withApiAuthRequired(apiRoute)(req, ctx);

			expect(apiAppRouteHandlerFactory).toHaveBeenCalledWith(base);
			expect(appRouteHandler).toHaveBeenCalledWith(apiRoute);
			expect(wrappedAppRoute).toHaveBeenCalledWith(req, ctx);
		});

		test('defaults the App Router context to an empty object when none is given', async () => {
			installBase();
			const sdk = createServerSDK(validInitConfig);
			const wrappedAppRoute = vi.fn().mockResolvedValue(new Response());
			vi.mocked(apiAppRouteHandlerFactory).mockReturnValue(vi.fn().mockReturnValue(wrappedAppRoute) as never);
			const req = new NextRequest('https://brandtegrity.io/api/secret');

			await sdk.withApiAuthRequired(vi.fn())(req);

			expect(wrappedAppRoute).toHaveBeenCalledWith(req, {});
		});

		test('dispatches to the Pages Router factory when the request is not a Request instance', async () => {
			const base = installBase();
			const sdk = createServerSDK(validInitConfig);
			const wrappedPageRoute = vi.fn().mockResolvedValue(undefined);
			const pageRouteHandler = vi.fn().mockReturnValue(wrappedPageRoute);
			vi.mocked(apiPageRouteHandlerFactory).mockReturnValue(pageRouteHandler as never);
			const apiRoute = vi.fn();
			const req = {} as NextApiRequest;
			const res = {} as NextApiResponse;

			await sdk.withApiAuthRequired(apiRoute)(req, res);

			expect(apiPageRouteHandlerFactory).toHaveBeenCalledWith(base);
			expect(pageRouteHandler).toHaveBeenCalledWith(apiRoute);
			expect(wrappedPageRoute).toHaveBeenCalledWith(req, res);
		});
	});

	describe('withAuthGuard', () => {
		test('dispatches to the App Router factory when given a function', () => {
			const base = installBase();
			const sdk = createServerSDK(validInitConfig);
			const wrappedRoute = vi.fn();
			const routeHandler = vi.fn().mockReturnValue(wrappedRoute);
			vi.mocked(appRouteHandlerFactory).mockReturnValue(routeHandler as never);
			const fn = vi.fn();
			const opts = { returnTo: '/profile' };

			const result = sdk.withAuthGuard(fn, opts);

			expect(appRouteHandlerFactory).toHaveBeenCalledWith(base);
			expect(routeHandler).toHaveBeenCalledWith(fn, opts);
			expect(result).toBe(wrappedRoute);
		});

		test('dispatches to the Pages Router factory when given options (or nothing)', () => {
			const base = installBase();
			const sdk = createServerSDK(validInitConfig);
			const wrappedRoute = vi.fn();
			const routeHandler = vi.fn().mockReturnValue(wrappedRoute);
			vi.mocked(pageRouteHandlerFactory).mockReturnValue(routeHandler as never);
			const opts = { returnTo: '/profile' };

			const result = sdk.withAuthGuard(opts);

			expect(pageRouteHandlerFactory).toHaveBeenCalledWith(base);
			expect(routeHandler).toHaveBeenCalledWith(opts);
			expect(result).toBe(wrappedRoute);
		});

		test('dispatches to the Pages Router factory with undefined when called with no arguments', () => {
			installBase();
			const sdk = createServerSDK(validInitConfig);
			const routeHandler = vi.fn().mockReturnValue(vi.fn());
			vi.mocked(pageRouteHandlerFactory).mockReturnValue(routeHandler as never);

			sdk.withAuthGuard();

			expect(routeHandler).toHaveBeenCalledWith(undefined);
		});
	});
});
