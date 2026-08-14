import type { StyAuthProviderProps, RedirectFlow } from '../../src/types';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { initFlow } from '@strivacity/sdk-core';
import { flushPromises } from '@strivacity/testing/mocks/common';
import { createMockFlow } from '@strivacity/testing/mocks/sdk';
import { mountAuthProvider, settle, unmount } from '../utils/mount';

vi.mock('@strivacity/sdk-core', async (importOriginal) => ({
	...(await importOriginal<typeof import('@strivacity/sdk-core')>()),
	initFlow: vi.fn(),
}));

const options: StyAuthProviderProps['options'] = {
	mode: 'redirect',
	issuer: 'https://brandtegrity.io',
	clientId: 'client-id',
	redirectUri: 'https://brandtegrity.io/callback',
};

describe('createStyAuthProvider', () => {
	beforeEach(() => {
		vi.mocked(initFlow).mockReset();
	});

	test('initializes the underlying flow through core sdk initFlow with the given options', async () => {
		const flow = createMockFlow<RedirectFlow>();
		vi.mocked(initFlow).mockReturnValue(flow as never);

		await mountAuthProvider(options);

		expect(initFlow).toHaveBeenCalledTimes(1);
		expect(initFlow).toHaveBeenCalledWith(options);
	});

	test('subscribes to all sdk events on mount and disposes the subscription on unmount', async () => {
		const dispose = vi.fn();
		const flow = createMockFlow<RedirectFlow>({ subscribeToAllEvents: vi.fn().mockReturnValue({ dispose }) });
		vi.mocked(initFlow).mockReturnValue(flow as never);

		const { instance } = await mountAuthProvider(options);

		expect(flow.subscribeToAllEvents).toHaveBeenCalledTimes(1);
		expect(flow.subscribeToAllEvents).toHaveBeenCalledWith(expect.any(Function));

		await unmount(instance as never);

		expect(dispose).toHaveBeenCalledTimes(1);
	});

	test('provides its context to descendant components via useStrivacity', async () => {
		const flow = createMockFlow<RedirectFlow>();
		vi.mocked(initFlow).mockReturnValue(flow as never);

		const { instance } = await mountAuthProvider(options);

		expect(instance.getChildContextValue()?.sdk).toBe(flow);
	});

	test.each([
		['init', [], undefined],
		['subscribeToEvent', ['loggedIn', vi.fn()], { dispose: vi.fn() }],
		['checkAuthentication', [{ autoRefresh: false }], true],
		['tokenExchange', [{ code: 'abc' }], undefined],
		['handleCallback', ['https://brandtegrity.io/callback?code=abc'], undefined],
		['refresh', [], undefined],
		['revoke', [], undefined],
		['logout', [{ postLogoutRedirectUri: 'https://brandtegrity.io' }], undefined],
		['login', [{ scopes: ['openid'] }], undefined],
		['register', [{ scopes: ['openid'] }], undefined],
		['entry', ['https://brandtegrity.io/entry'], undefined],
	] as const)('%s calls through to the flow instance returned by core sdk', async (method, args, resolvedValue) => {
		const flow = createMockFlow<RedirectFlow>({ [method]: vi.fn().mockReturnValue(resolvedValue) });
		vi.mocked(initFlow).mockReturnValue(flow as never);

		const { instance } = await mountAuthProvider(options);
		const context = instance.getContextValue();

		const result = await (context[method] as (...a: Array<unknown>) => unknown)(...args);

		expect(flow[method as keyof RedirectFlow]).toHaveBeenCalledWith(...args);
		expect(result).toEqual(resolvedValue);
	});

	test('subscribeToAllEvents on the context calls through to the flow instance', async () => {
		const callback = vi.fn();
		const disposeResult = { dispose: vi.fn() };
		const flow = createMockFlow<RedirectFlow>();
		vi.mocked(flow.subscribeToAllEvents).mockReturnValue(disposeResult);
		vi.mocked(initFlow).mockReturnValue(flow as never);

		const { instance } = await mountAuthProvider(options);
		// the mount-time subscription happens first; this is the caller-facing pass-through
		const result = instance.getContextValue().subscribeToAllEvents(callback);

		expect(flow.subscribeToAllEvents).toHaveBeenLastCalledWith(callback);
		expect(result).toBe(disposeResult);
	});

	test('exposes reactive state seeded from the flow instance after the initial session update settles', async () => {
		const flow = createMockFlow<RedirectFlow>({
			isAuthenticated: Promise.resolve(true),
			language: 'hu-HU',
			idTokenClaims: { sub: 'user-1' },
			accessToken: 'access-token',
			refreshToken: 'refresh-token',
			accessTokenExpired: false,
			accessTokenExpirationDate: 1234,
		});
		vi.mocked(initFlow).mockReturnValue(flow as never);

		const { instance } = await mountAuthProvider(options);
		const context = instance.getContextValue();

		expect(context.loading).toBe(false);
		expect(context.isAuthenticated).toBe(true);
		expect(context.language).toBe('hu-HU');
		expect(context.idTokenClaims).toEqual({ sub: 'user-1' });
		expect(context.accessToken).toBe('access-token');
		expect(context.refreshToken).toBe('refresh-token');
		expect(context.accessTokenExpired).toBe(false);
		expect(context.accessTokenExpirationDate).toBe(1234);
	});

	test('reactive state updates when the flow emits an event', async () => {
		const subscribeToAllEvents = vi.fn().mockReturnValue({ dispose: vi.fn() });
		const flow = createMockFlow<RedirectFlow>({ subscribeToAllEvents });
		vi.mocked(initFlow).mockReturnValue(flow as never);

		const { instance } = await mountAuthProvider(options);
		const context = instance.getContextValue();

		const onEvent = subscribeToAllEvents.mock.calls[0][0] as () => Promise<void>;
		const mutableFlow = flow as unknown as { language: string; accessToken: string | null; isAuthenticated: Promise<boolean> };

		mutableFlow.language = 'de-DE';
		mutableFlow.accessToken = 'new-token';
		mutableFlow.isAuthenticated = Promise.resolve(true);

		await onEvent();
		await flushPromises();

		expect(context.language).toBe('de-DE');
		expect(context.accessToken).toBe('new-token');
		expect(context.isAuthenticated).toBe(true);
	});

	describe('session seeding', () => {
		test('assigns the given session to the flow instance once known', async () => {
			const flow = createMockFlow<RedirectFlow>();
			vi.mocked(initFlow).mockReturnValue(flow as never);
			const session = { access_token: 'access-token' } as never;

			await mountAuthProvider(options, session);

			// $state proxies assigned objects, so the flow ends up holding a reactive proxy of `session` rather than
			// the exact same reference; compare by value instead.
			expect(flow.session).toEqual(session);
		});

		test('reacts to the session getter changing after mount', async () => {
			const flow = createMockFlow<RedirectFlow>();
			vi.mocked(initFlow).mockReturnValue(flow as never);

			const { instance } = await mountAuthProvider(options, null);
			expect(flow.session).toBeNull();

			const newSession = { access_token: 'new-access-token' } as never;
			instance.setSession(newSession);
			await settle();

			expect(flow.session).toEqual(newSession);
		});

		test('does not assign a falsy session to the flow instance', async () => {
			const flow = createMockFlow<RedirectFlow>();
			vi.mocked(initFlow).mockReturnValue(flow as never);

			await mountAuthProvider(options, null);

			expect(flow.session).toBeNull();
		});
	});
});
