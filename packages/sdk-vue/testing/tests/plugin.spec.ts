import type { RedirectFlow } from '../../src/types';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createApp } from 'vue';
import { initFlow } from '@strivacity/sdk-core';
import { createStrivacitySDK } from '../../src/plugin';
import { flushPromises } from '@strivacity/testing/mocks/common';
import { createMockFlow } from '@strivacity/testing/mocks/sdk';
import { install } from '../utils/common';

vi.mock('@strivacity/sdk-core', async (importOriginal) => ({
	...(await importOriginal<typeof import('@strivacity/sdk-core')>()),
	initFlow: vi.fn(),
}));

describe('createStrivacitySDK', () => {
	beforeEach(() => {
		vi.mocked(initFlow).mockReset();
	});

	test('initializes the underlying flow through core sdk initFlow with the given options', () => {
		const flow = createMockFlow<RedirectFlow>();
		const options = { mode: 'redirect' as const, issuer: 'https://brandtegrity.io', clientId: 'client-id', redirectUri: 'https://brandtegrity.io/callback' };

		vi.mocked(initFlow).mockReturnValue(flow as never);

		const app = createApp({ setup: () => () => null });
		app.use(createStrivacitySDK(options));
		app.mount(document.createElement('div'));

		expect(initFlow).toHaveBeenCalledTimes(1);
		expect(initFlow).toHaveBeenCalledWith(options);
	});

	test('subscribes to all sdk events on install and disposes on unmount', () => {
		const dispose = vi.fn();
		const flow = createMockFlow<RedirectFlow>({ subscribeToAllEvents: vi.fn().mockReturnValue({ dispose }) });
		const { app } = install(flow);

		expect(flow.subscribeToAllEvents).toHaveBeenCalledTimes(1);
		expect(flow.subscribeToAllEvents).toHaveBeenCalledWith(expect.any(Function));

		app.unmount();

		expect(dispose).toHaveBeenCalledTimes(1);
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
		const { context } = install(flow);

		const result = await (context[method] as (...a: Array<unknown>) => unknown)(...args);

		expect(flow[method as keyof RedirectFlow]).toHaveBeenCalledWith(...args);
		expect(result).toEqual(resolvedValue);
	});

	test('subscribeToAllEvents on the context calls through to the flow instance', () => {
		const callback = vi.fn();
		const disposeResult = { dispose: vi.fn() };
		const flow = createMockFlow<RedirectFlow>();
		vi.mocked(flow.subscribeToAllEvents).mockReturnValue(disposeResult);

		const { context } = install(flow);
		// the install-time subscription happens first; this is the caller-facing pass-through
		const result = context.subscribeToAllEvents(callback);

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
		const { context } = install(flow);

		expect(context.loading.value).toBe(true);

		await flushPromises();

		expect(context.loading.value).toBe(false);
		expect(context.isAuthenticated.value).toBe(true);
		expect(context.language.value).toBe('hu-HU');
		expect(context.idTokenClaims.value).toEqual({ sub: 'user-1' });
		expect(context.accessToken.value).toBe('access-token');
		expect(context.refreshToken.value).toBe('refresh-token');
		expect(context.accessTokenExpired.value).toBe(false);
		expect(context.accessTokenExpirationDate.value).toBe(1234);
	});

	test('reactive state updates when the flow emits an event', async () => {
		const subscribeToAllEvents = vi.fn().mockReturnValue({ dispose: vi.fn() });
		const flow = createMockFlow<RedirectFlow>({ subscribeToAllEvents });
		const { context } = install(flow);
		await flushPromises();

		const onEvent = subscribeToAllEvents.mock.calls[0][0];
		const mutableFlow = flow as { language: string; accessToken: string | null; isAuthenticated: Promise<boolean> };

		mutableFlow.language = 'de-DE';
		mutableFlow.accessToken = 'new-token';
		mutableFlow.isAuthenticated = Promise.resolve(true);

		await onEvent();
		await flushPromises();

		expect(context.language.value).toBe('de-DE');
		expect(context.accessToken.value).toBe('new-token');
		expect(context.isAuthenticated.value).toBe(true);
	});
});
