import { describe, test, expect, vi, afterEach } from 'vitest';
import { createMockBaseServerSDK } from '@strivacity/testing/mocks/sdk';
import { appRouteHandlerFactory, pageRouteHandlerFactory } from '../../../../src/server/handlers/route';
import type { BaseServerSDK, PagesRouterRequest } from '../../../../src/server/types';

vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

type Sdk = BaseServerSDK<Request | PagesRouterRequest | undefined>;

afterEach(() => {
	vi.resetModules();
});

describe('appRouteHandlerFactory', () => {
	test('redirects to the bare loginUri when there is no session and no returnTo', async () => {
		const { redirect } = await import('next/navigation');
		const sdk = createMockBaseServerSDK<Sdk>({ options: { loginUri: '/login' } });
		const handler = vi.fn();
		const route = appRouteHandlerFactory(sdk)(handler);

		await route({});

		expect(redirect).toHaveBeenCalledWith('/login');
	});

	test('redirects with an encoded returnTo query param when returnTo is a string', async () => {
		const { redirect } = await import('next/navigation');
		const sdk = createMockBaseServerSDK<Sdk>({ options: { loginUri: '/login' } });
		const handler = vi.fn();
		const route = appRouteHandlerFactory(sdk)(handler, { returnTo: 'https://brandtegrity.io/dashboard' });

		await route({});

		expect(redirect).toHaveBeenCalledWith('/login?returnTo=https%3A%2F%2Fbrandtegrity.io%2Fdashboard');
	});

	test('resolves a function returnTo with the route params before redirecting', async () => {
		const { redirect } = await import('next/navigation');
		const sdk = createMockBaseServerSDK<Sdk>({ options: { loginUri: '/login' } });
		const handler = vi.fn();
		const returnTo = vi.fn().mockResolvedValue('/profile');
		const route = appRouteHandlerFactory(sdk)(handler, { returnTo });
		const params = { params: Promise.resolve({ id: '1' }) };

		await route(params);

		expect(returnTo).toHaveBeenCalledWith(params);
		expect(redirect).toHaveBeenCalledWith('/login?returnTo=%2Fprofile');
	});

	test('still calls the wrapped handler after an unauthenticated redirect that does not itself abort execution', async () => {
		const sdk = createMockBaseServerSDK<Sdk>({ options: { loginUri: '/login' } });
		const handler = vi.fn().mockResolvedValue('handler-result');
		const route = appRouteHandlerFactory(sdk)(handler);
		const params = { id: '1' };

		const result = await route(params);

		expect(handler).toHaveBeenCalledWith({ id: '1', session: null });
		expect(result).toBe('handler-result');
	});

	test('does not call the wrapped handler when the redirect throws, as a real Next.js redirect() does', async () => {
		const { redirect } = await import('next/navigation');
		vi.mocked(redirect).mockImplementationOnce(() => {
			throw new Error('NEXT_REDIRECT');
		});
		const sdk = createMockBaseServerSDK<Sdk>({ options: { loginUri: '/login' } });
		const handler = vi.fn();
		const route = appRouteHandlerFactory(sdk)(handler);

		await expect(route({})).rejects.toThrow('NEXT_REDIRECT');
		expect(handler).not.toHaveBeenCalled();
	});

	test('calls the wrapped handler with the params and session, without redirecting, when there is a session', async () => {
		const { redirect } = await import('next/navigation');
		const session = { access_token: 'access-token' };
		const sdk = createMockBaseServerSDK<Sdk>({ options: { loginUri: '/login' }, getSession: vi.fn().mockResolvedValue(session) });
		const handler = vi.fn().mockResolvedValue('handler-result');
		const route = appRouteHandlerFactory(sdk)(handler);

		const result = await route({ id: '1' });

		expect(redirect).not.toHaveBeenCalled();
		expect(handler).toHaveBeenCalledWith({ id: '1', session });
		expect(result).toBe('handler-result');
	});
});

describe('pageRouteHandlerFactory', () => {
	test('returns a redirect to loginUri with the resolvedUrl as returnTo when there is no session and no returnTo option', async () => {
		const sdk = createMockBaseServerSDK<Sdk>({ options: { loginUri: '/login' } });
		const route = pageRouteHandlerFactory(sdk)();

		const result = await route({ resolvedUrl: '/dashboard' } as never);

		expect(result).toEqual({ redirect: { destination: '/login?returnTo=%2Fdashboard', permanent: false } });
	});

	test('prefers the returnTo option over ctx.resolvedUrl', async () => {
		const sdk = createMockBaseServerSDK<Sdk>({ options: { loginUri: '/login' } });
		const route = pageRouteHandlerFactory(sdk)({ returnTo: '/profile' });

		const result = await route({ resolvedUrl: '/dashboard' } as never);

		expect(result).toEqual({ redirect: { destination: '/login?returnTo=%2Fprofile', permanent: false } });
	});

	test('does not call getServerSideProps when there is no session', async () => {
		const sdk = createMockBaseServerSDK<Sdk>({ options: { loginUri: '/login' } });
		const getServerSideProps = vi.fn();
		const route = pageRouteHandlerFactory(sdk)({ getServerSideProps });

		await route({ resolvedUrl: '/dashboard' } as never);

		expect(getServerSideProps).not.toHaveBeenCalled();
	});

	test('returns only the session prop when there is a session and no getServerSideProps', async () => {
		const session = { access_token: 'access-token' };
		const sdk = createMockBaseServerSDK<Sdk>({ getSession: vi.fn().mockResolvedValue(session) });
		const route = pageRouteHandlerFactory(sdk)();

		const result = await route({} as never);

		expect(result).toEqual({ props: { session } });
	});

	test('merges the session into the props returned synchronously by getServerSideProps', async () => {
		const session = { access_token: 'access-token' };
		const sdk = createMockBaseServerSDK<Sdk>({ getSession: vi.fn().mockResolvedValue(session) });
		const getServerSideProps = vi.fn().mockReturnValue({ props: { foo: 'bar' } });
		const route = pageRouteHandlerFactory(sdk)({ getServerSideProps });

		const result = await route({} as never);

		expect(result).toEqual({ props: { session, foo: 'bar' } });
	});

	test('merges the session into props returned as a Promise by getServerSideProps', async () => {
		const session = { access_token: 'access-token' };
		const sdk = createMockBaseServerSDK<Sdk>({ getSession: vi.fn().mockResolvedValue(session) });
		const getServerSideProps = vi.fn().mockReturnValue({ props: Promise.resolve({ foo: 'bar' }) });
		const route = pageRouteHandlerFactory(sdk)({ getServerSideProps });

		const result = await route({} as never);

		expect(result).toEqual({ props: { session, foo: 'bar' } });
	});

	test('awaits an async getServerSideProps that itself returns a Promise', async () => {
		const session = { access_token: 'access-token' };
		const sdk = createMockBaseServerSDK<Sdk>({ getSession: vi.fn().mockResolvedValue(session) });
		const getServerSideProps = vi.fn().mockResolvedValue({ props: { foo: 'bar' } });
		const route = pageRouteHandlerFactory(sdk)({ getServerSideProps });

		const result = await route({} as never);

		expect(result).toEqual({ props: { session, foo: 'bar' } });
	});

	test('still adds a session prop when getServerSideProps returns a result with no props, such as notFound', async () => {
		const session = { access_token: 'access-token' };
		const sdk = createMockBaseServerSDK<Sdk>({ getSession: vi.fn().mockResolvedValue(session) });
		const getServerSideProps = vi.fn().mockReturnValue({ notFound: true });
		const route = pageRouteHandlerFactory(sdk)({ getServerSideProps });

		const result = await route({} as never);

		expect(result).toEqual({ notFound: true, props: { session } });
	});
});
