import type { RedirectFlow } from '../../src/types';
import { PLATFORM_ID, TransferState, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { initFlow } from '@strivacity/sdk-core';
import { StrivacityAuthService } from '../../src/lib/services/auth.service';
import { STRIVACITY_SDK } from '../../src/lib/utils';
import { SESSION_TRANSFER_KEY } from '../../src/server/session';
import { flushPromises } from '@strivacity/testing/mocks/common';
import { createMockFlow, createOptions } from '@strivacity/testing/mocks/sdk';
import { mountWithProviders } from '../utils/testbed';

vi.mock('@strivacity/sdk-core', async (importOriginal) => ({
	...(await importOriginal<typeof import('@strivacity/sdk-core')>()),
	initFlow: vi.fn(),
}));

function configure(flow: RedirectFlow, optionsOverrides: Record<string, unknown> = {}, extraProviders: Array<unknown> = []) {
	vi.mocked(initFlow).mockReturnValue(flow as never);

	const options = createOptions(optionsOverrides) as never;

	TestBed.configureTestingModule({
		providers: [{ provide: STRIVACITY_SDK, useValue: options }, StrivacityAuthService, ...(extraProviders as [])],
	});

	return { authService: TestBed.inject(StrivacityAuthService), options };
}

beforeEach(() => {
	vi.mocked(initFlow).mockReset();
});

describe('StrivacityAuthService', () => {
	test('initializes the underlying flow through core sdk initFlow with the config injected via STRIVACITY_SDK', () => {
		const flow = createMockFlow<RedirectFlow>();
		const { options } = configure(flow);

		expect(initFlow).toHaveBeenCalledTimes(1);
		expect(initFlow).toHaveBeenCalledWith(options);
	});

	test('exposes signals seeded from the flow instance after the initial session update settles', async () => {
		const flow = createMockFlow<RedirectFlow>({
			isAuthenticated: Promise.resolve(true),
			language: 'hu-HU',
			idTokenClaims: { sub: 'user-1' },
			accessToken: 'access-token',
			refreshToken: 'refresh-token',
			accessTokenExpired: false,
			accessTokenExpirationDate: 1234,
		});
		const { authService } = configure(flow);

		expect(authService.loading()).toBe(true);

		await flushPromises();

		expect(authService.loading()).toBe(false);
		expect(authService.isAuthenticated()).toBe(true);
		expect(authService.language()).toBe('hu-HU');
		expect(authService.idTokenClaims()).toEqual({ sub: 'user-1' });
		expect(authService.accessToken()).toBe('access-token');
		expect(authService.refreshToken()).toBe('refresh-token');
		expect(authService.accessTokenExpired()).toBe(false);
		expect(authService.accessTokenExpirationDate()).toBe(1234);
	});

	test('falls back null-ish flow values to the signals default (null) rather than storing them verbatim', async () => {
		const flow = createMockFlow<RedirectFlow>({
			idTokenClaims: undefined,
			accessToken: undefined,
			refreshToken: undefined,
			accessTokenExpirationDate: undefined,
		});
		const { authService } = configure(flow);

		await flushPromises();

		expect(authService.idTokenClaims()).toBeNull();
		expect(authService.accessToken()).toBeNull();
		expect(authService.refreshToken()).toBeNull();
		expect(authService.accessTokenExpirationDate()).toBeNull();
	});

	test('updates signals when the flow emits an event through subscribeToAllEvents', async () => {
		const subscribeToAllEvents = vi.fn().mockReturnValue({ dispose: vi.fn() });
		const flow = createMockFlow<RedirectFlow>({ subscribeToAllEvents });
		const { authService } = configure(flow);
		await flushPromises();

		const onEvent = subscribeToAllEvents.mock.calls[0][0] as () => Promise<void>;
		const mutableFlow = flow as unknown as { language: string; accessToken: string | null; isAuthenticated: Promise<boolean> };

		mutableFlow.language = 'de-DE';
		mutableFlow.accessToken = 'new-token';
		mutableFlow.isAuthenticated = Promise.resolve(true);

		await onEvent();
		await flushPromises();

		expect(authService.language()).toBe('de-DE');
		expect(authService.accessToken()).toBe('new-token');
		expect(authService.isAuthenticated()).toBe(true);
	});

	test('subscribeToAllEvents is subscribed to once on construction, wiring the internal signal-update callback', async () => {
		const flow = createMockFlow<RedirectFlow>();
		configure(flow);
		await flushPromises();

		expect(flow.subscribeToAllEvents).toHaveBeenCalledTimes(1);
		expect(flow.subscribeToAllEvents).toHaveBeenCalledWith(expect.any(Function));
	});

	describe('SSR session hydration via TransferState', () => {
		test('does not touch TransferState when serverSessionUri is not configured', () => {
			const flow = createMockFlow<RedirectFlow>({ session: null });
			const { authService } = configure(flow, { serverSessionUri: false });
			const transferState = TestBed.inject(TransferState);

			expect(transferState.hasKey(SESSION_TRANSFER_KEY)).toBe(false);
			expect(authService.sdk.session).toBeNull();
		});

		test('leaves the flow untouched when serverSessionUri is configured but no session was transferred', () => {
			const flow = createMockFlow<RedirectFlow>({ session: null });
			const { authService } = configure(flow, { serverSessionUri: 'https://brandtegrity.io/session' }, [{ provide: PLATFORM_ID, useValue: 'browser' }]);

			expect(authService.sdk.session).toBeNull();
		});

		test('hydrates the flow session from TransferState and removes the key when running in the browser', () => {
			const flow = createMockFlow<RedirectFlow>({ session: null });
			const session = { access_token: 'transferred-token' };

			vi.mocked(initFlow).mockReturnValue(flow as never);
			TestBed.configureTestingModule({
				providers: [
					{ provide: STRIVACITY_SDK, useValue: createOptions({ serverSessionUri: 'https://brandtegrity.io/session' }) },
					{ provide: PLATFORM_ID, useValue: 'browser' },
					StrivacityAuthService,
				],
			});

			// setting the transferred value before the first inject() matters: StrivacityAuthService only reads it once, in its constructor
			const transferState = TestBed.inject(TransferState);
			transferState.set(SESSION_TRANSFER_KEY, session);

			const authService = TestBed.inject(StrivacityAuthService);

			expect(authService.sdk.session).toBe(session);
			// the browser is done with the transferred value once hydrated - keeping it around would leak stale session data into TransferState's serialized snapshot
			expect(transferState.hasKey(SESSION_TRANSFER_KEY)).toBe(false);
		});

		test('hydrates the flow session from TransferState but keeps the key when running on the server', () => {
			const flow = createMockFlow<RedirectFlow>({ session: null });
			const session = { access_token: 'transferred-token' };

			vi.mocked(initFlow).mockReturnValue(flow as never);
			TestBed.configureTestingModule({
				providers: [
					{ provide: STRIVACITY_SDK, useValue: createOptions({ serverSessionUri: 'https://brandtegrity.io/session' }) },
					{ provide: PLATFORM_ID, useValue: 'server' },
					StrivacityAuthService,
				],
			});

			const transferState = TestBed.inject(TransferState);
			transferState.set(SESSION_TRANSFER_KEY, session);

			const authService = TestBed.inject(StrivacityAuthService);

			expect(authService.sdk.session).toBe(session);
			expect(transferState.hasKey(SESSION_TRANSFER_KEY)).toBe(true);
		});
	});

	test('disposes the subscribeToAllEvents subscription when the owning injector is destroyed', () => {
		const dispose = vi.fn();
		const flow = createMockFlow<RedirectFlow>({ subscribeToAllEvents: vi.fn().mockReturnValue({ dispose }) });

		vi.mocked(initFlow).mockReturnValue(flow as never);
		TestBed.configureTestingModule({ providers: [{ provide: STRIVACITY_SDK, useValue: createOptions() }] });

		// StrivacityAuthService must be provided at the component's own injector (not the TestBed module injector) for
		// fixture.destroy() to actually tear down the injector that owns its DestroyRef - see mountWithProviders' docstring.
		const { destroy } = mountWithProviders([StrivacityAuthService], () => inject(StrivacityAuthService));

		expect(flow.subscribeToAllEvents).toHaveBeenCalledTimes(1);
		expect(dispose).not.toHaveBeenCalled();

		destroy();

		expect(dispose).toHaveBeenCalledTimes(1);
	});

	test.each([
		['init', []],
		['subscribeToEvent', ['loggedIn', vi.fn()]],
		['checkAuthentication', [{ autoRefresh: false }]],
		['tokenExchange', [{ code: 'abc' }]],
		['handleCallback', ['https://brandtegrity.io/callback?code=abc']],
		['refresh', []],
		['revoke', []],
		['logout', [{ postLogoutRedirectUri: 'https://brandtegrity.io' }]],
		['login', [{ scopes: ['openid'] }]],
		['register', [{ scopes: ['openid'] }]],
		['entry', ['https://brandtegrity.io/entry']],
	] as const)('%s calls through to the underlying flow instance with the same arguments and return value', async (method, args) => {
		const resolvedValue = { ok: true };
		const flow = createMockFlow<RedirectFlow>({ [method]: vi.fn().mockResolvedValue(resolvedValue) });
		const { authService } = configure(flow);

		const result = await (authService[method as keyof StrivacityAuthService] as (...a: Array<unknown>) => unknown)(...(args as Array<unknown>));

		expect(flow[method as keyof RedirectFlow]).toHaveBeenCalledWith(...args);
		expect(result).toEqual(resolvedValue);
	});

	test('subscribeToAllEvents on the service calls through to the flow instance for the caller-facing subscription', async () => {
		const callback = vi.fn();
		const disposeResult = { dispose: vi.fn() };
		const flow = createMockFlow<RedirectFlow>();
		vi.mocked(flow.subscribeToAllEvents).mockReturnValue(disposeResult);

		const { authService } = configure(flow);
		await flushPromises();

		const result = authService.subscribeToAllEvents(callback);

		expect(flow.subscribeToAllEvents).toHaveBeenLastCalledWith(callback);
		expect(result).toBe(disposeResult);
	});
});
