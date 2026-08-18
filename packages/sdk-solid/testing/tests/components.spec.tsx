import type { SDKContext, RedirectFlow, SessionData } from '../../src/client/types';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { initFlow } from '@strivacity/sdk-core';
import { StyAuthProvider } from '../../src/client/components';
import { useStrivacity } from '../../src/client/hooks';
import { createMockFlow } from '@strivacity/testing/mocks/sdk';
import { flushPromises } from '@strivacity/testing/mocks/common';
import { mount, cleanupMounts } from '../dom';

vi.mock('@strivacity/sdk-core', async (importOriginal) => ({
	...(await importOriginal<typeof import('@strivacity/sdk-core')>()),
	initFlow: vi.fn(),
}));

afterEach(() => {
	cleanupMounts();
});

function install(flow: RedirectFlow, session: SessionData | null = null) {
	vi.mocked(initFlow).mockReturnValue(flow as never);

	let context: SDKContext<RedirectFlow> | undefined;

	function Consumer() {
		context = useStrivacity<RedirectFlow>();
		return null;
	}

	const options = { mode: 'redirect' as const, issuer: 'https://brandtegrity.io', clientId: 'client-id', redirectUri: 'https://brandtegrity.io/callback' };

	mount(() => (
		<StyAuthProvider options={options} session={session ?? undefined}>
			<Consumer />
		</StyAuthProvider>
	));

	return { context: () => context!, options };
}

describe('StyAuthProvider', () => {
	beforeEach(() => {
		vi.mocked(initFlow).mockReset();
	});

	test('initializes the flow through core sdk initFlow with the given options', async () => {
		const flow = createMockFlow<RedirectFlow>();
		const { options } = install(flow);
		await flushPromises();

		expect(initFlow).toHaveBeenCalledTimes(1);
		expect(initFlow).toHaveBeenCalledWith(options);
	});

	test('exposes the flow instance returned by initFlow as sdk', async () => {
		const flow = createMockFlow<RedirectFlow>();
		const { context } = install(flow);
		await flushPromises();

		expect(context().sdk).toBe(flow);
	});

	test('subscribes to all sdk events on mount and disposes on unmount', async () => {
		const dispose = vi.fn();
		const flow = createMockFlow<RedirectFlow>({ subscribeToAllEvents: vi.fn().mockReturnValue({ dispose }) });
		install(flow);
		await flushPromises();

		expect(flow.subscribeToAllEvents).toHaveBeenCalledTimes(1);
		expect(flow.subscribeToAllEvents).toHaveBeenCalledWith(expect.any(Function));

		cleanupMounts();

		expect(dispose).toHaveBeenCalledTimes(1);
	});

	test('seeds the flow session when a session prop is given', async () => {
		const flow = createMockFlow<RedirectFlow>();
		const session = { access_token: 'access-token' } as unknown as SessionData;

		install(flow, session);
		await flushPromises();

		expect(flow.session).toBe(session);
	});

	test.each([
		['init', [], undefined],
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
		await flushPromises();

		const result = await (context()[method] as (...a: Array<unknown>) => unknown)(...args);

		expect(flow[method as keyof RedirectFlow]).toHaveBeenCalledWith(...args);
		expect(result).toEqual(resolvedValue);
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

		expect(context().loading()).toBe(true);

		await flushPromises();

		expect(context().loading()).toBe(false);
		expect(context().isAuthenticated()).toBe(true);
		expect(context().language()).toBe('hu-HU');
		expect(context().idTokenClaims()).toEqual({ sub: 'user-1' });
		expect(context().accessToken()).toBe('access-token');
		expect(context().refreshToken()).toBe('refresh-token');
		expect(context().accessTokenExpired()).toBe(false);
		expect(context().accessTokenExpirationDate()).toBe(1234);
	});

	test('reactive state updates when the flow emits an event', async () => {
		const subscribeToAllEvents = vi.fn().mockReturnValue({ dispose: vi.fn() });
		const flow = createMockFlow<RedirectFlow>({ subscribeToAllEvents });
		const { context } = install(flow);
		await flushPromises();

		const onEvent = subscribeToAllEvents.mock.calls[0][0] as () => Promise<void>;
		const mutableFlow = flow as unknown as { language: string; accessToken: string | null; isAuthenticated: Promise<boolean> };

		mutableFlow.language = 'de-DE';
		mutableFlow.accessToken = 'new-token';
		mutableFlow.isAuthenticated = Promise.resolve(true);

		await onEvent();
		await flushPromises();

		expect(context().language()).toBe('de-DE');
		expect(context().accessToken()).toBe('new-token');
		expect(context().isAuthenticated()).toBe(true);
	});
});
